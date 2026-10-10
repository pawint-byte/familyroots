#!/usr/bin/env python3
"""Additive auto-fit fix for the family tree view.

Modifies:
- client/src/components/family-tree-visualization.tsx: adds optional onAutoFitZoom/fitSignal
  props, a fitToScreen() that computes the member-card bounding box and requests the
  optimal scale (capped at 1), then centers the translation.
- client/src/pages/tree-view.tsx: adds fitSignal state, auto-fit triggers (load, data/view-depth
  change, window resize), a "Fit to screen" button, and wires the new props.
"""
import sys


def replace_once(content, old, new, label, path):
    if old not in content:
        print("ERROR: anchor not found [%s] in %s" % (label, path))
        sys.exit(1)
    print("OK: %s" % label)
    return content.replace(old, new, 1)


def main():
    viz_path = "client/src/components/family-tree-visualization.tsx"
    with open(viz_path) as f:
        viz = f.read()

    old_props = """  onMemberPositionChange?: (memberId: string, position: { x: number; y: number }) => void;
  importPreview?: ImportPreviewConfig | null;
}"""
    new_props = """  onMemberPositionChange?: (memberId: string, position: { x: number; y: number }) => void;
  importPreview?: ImportPreviewConfig | null;
  onAutoFitZoom?: (zoom: number) => void;
  fitSignal?: number;
}"""
    viz = replace_once(viz, old_props, new_props, "viz-props-interface", viz_path)

    old_destructure = """  onMemberPositionChange,
  importPreview,
}: FamilyTreeVisualizationProps) {"""
    new_destructure = """  onMemberPositionChange,
  importPreview,
  onAutoFitZoom,
  fitSignal = 0,
}: FamilyTreeVisualizationProps) {"""
    viz = replace_once(viz, old_destructure, new_destructure, "viz-destructure", viz_path)

    old_autocenter = """  // Auto-center tree when layout changes (but not while user is panning)
  useEffect(() => {
    if (positions.length === 0) return;
    userPannedRef.current = false;
    const raf = requestAnimationFrame(() => centerTree());
    return () => cancelAnimationFrame(raf);
  }, [focusMemberId, positions, zoom, nodeWidth, nodeHeight, viewDepth, centerTree]);"""
    new_fit = """  // Fit the entire tree into the visible viewport. Computes the bounding box of all
  // rendered member cards and asks the parent (via onAutoFitZoom) to apply the optimal
  // scale = min(viewportW/bboxW, viewportH/bboxH), capped at 1 so small trees don't blow up,
  // then centers the translation.
  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || positions.length === 0) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of positions) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + nodeWidth);
      maxY = Math.max(maxY, p.y + nodeHeight);
    }
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    if (!isFinite(bboxW) || !isFinite(bboxH) || bboxW <= 0 || bboxH <= 0) return;

    const scale = Math.min(1, rect.width / bboxW, rect.height / bboxH);
    userPannedRef.current = false;
    if (onAutoFitZoom) {
      onAutoFitZoom(scale);
    }
    // Center immediately in case the scale equals the current zoom (no zoom-prop
    // change, so the auto-center effect below would not re-run).
    centerTree();
  }, [positions, nodeWidth, nodeHeight, onAutoFitZoom, centerTree]);

  const fitToScreenRef = useRef(fitToScreen);
  fitToScreenRef.current = fitToScreen;

  // Re-run the fit when the parent requests it (Fit to screen button, tree data or
  // view-depth change, window resize). positions.length is included so the fit waits
  // for the layout to be computed on initial load. A ref is used so manual zoom/pan
  // (which recreates fitToScreen via centerTree) does not re-trigger a fit.
  useEffect(() => {
    if (fitSignal > 0 && positions.length > 0) {
      const raf = requestAnimationFrame(() => fitToScreenRef.current());
      return () => cancelAnimationFrame(raf);
    }
  }, [fitSignal, positions.length]);

  // Auto-center tree when layout changes (but not while user is panning)
  useEffect(() => {
    if (positions.length === 0) return;
    userPannedRef.current = false;
    const raf = requestAnimationFrame(() => centerTree());
    return () => cancelAnimationFrame(raf);
  }, [focusMemberId, positions, zoom, nodeWidth, nodeHeight, viewDepth, centerTree]);"""
    viz = replace_once(viz, old_autocenter, new_fit, "viz-fit-function", viz_path)

    with open(viz_path, "w") as f:
        f.write(viz)
    print("WROTE %s" % viz_path)

    tv_path = "client/src/pages/tree-view.tsx"
    with open(tv_path) as f:
        tv = f.read()

    old_zoom_state = "  const [zoom, setZoom] = useState(getInitialZoom);"
    new_zoom_state = """  const [zoom, setZoom] = useState(getInitialZoom);
  // Increment to request the tree visualization to fit the entire tree into the viewport
  const [fitSignal, setFitSignal] = useState(0);
  const requestFitToScreen = useCallback(() => setFitSignal((s) => s + 1), []);"""
    tv = replace_once(tv, old_zoom_state, new_zoom_state, "tv-fit-state", tv_path)

    old_members = """  const displayMembers = useMemo(() => {
    if (!filterTagId) return allDisplayMembers;
    const taggedMemberIds = new Set(
      treeData?.memberTags?.filter((mt) => mt.tagId === filterTagId).map((mt) => mt.memberId) || []
    );
    return allDisplayMembers.filter((m) => taggedMemberIds.has(m.id));
  }, [allDisplayMembers, filterTagId, treeData?.memberTags]);"""
    new_members = old_members + """

  // Auto-fit the entire tree into the viewport on initial load and whenever the
  // tree data or view depth changes.
  useEffect(() => {
    requestFitToScreen();
  }, [requestFitToScreen, displayMembers, displayRelationships, viewDepth]);

  // Re-run the fit on window resize (debounced).
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(requestFitToScreen, 200);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeout);
    };
  }, [requestFitToScreen]);"""
    tv = replace_once(tv, old_members, new_members, "tv-auto-fit-effects", tv_path)

    old_import = "  Trees, Plus, Search, ArrowLeft, ZoomIn, ZoomOut, Maximize2,"
    new_import = "  Trees, Plus, Search, ArrowLeft, ZoomIn, ZoomOut, Maximize2, Expand,"
    tv = replace_once(tv, old_import, new_import, "tv-expand-import", tv_path)

    zoom_in_anchor = 'data-testid="button-zoom-in"'
    idx = tv.find(zoom_in_anchor)
    if idx == -1:
        print("ERROR: anchor not found [tv-zoom-in-button] in %s" % tv_path)
        sys.exit(1)
    btn_end = tv.find("</Button>", idx)
    if btn_end == -1:
        print("ERROR: </Button> not found after zoom-in in %s" % tv_path)
        sys.exit(1)
    btn_end += len("</Button>")
    fit_button = """
        <Button
          variant="secondary"
          size="icon"
          onClick={requestFitToScreen}
          data-testid="button-fit-to-screen"
          aria-label="Fit to screen"
          title="Fit to screen"
          className="h-10 w-10 sm:h-9 sm:w-9"
        >
          <Expand className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>"""
    tv = tv[:btn_end] + fit_button + tv[btn_end:]
    print("OK: tv-fit-button")

    old_viz_props = """      onMemberPositionChange={canEditTree ? handleMemberPositionChange : undefined}
      importPreview={importPreviewConfig}
    />"""
    new_viz_props = """      onMemberPositionChange={canEditTree ? handleMemberPositionChange : undefined}
      importPreview={importPreviewConfig}
      onAutoFitZoom={setZoom}
      fitSignal={fitSignal}
    />"""
    tv = replace_once(tv, old_viz_props, new_viz_props, "tv-viz-props", tv_path)

    with open(tv_path, "w") as f:
        f.write(tv)
    print("WROTE %s" % tv_path)


if __name__ == "__main__":
    main()
