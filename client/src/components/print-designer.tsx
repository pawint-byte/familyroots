import { useState, useRef, useCallback, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, ArrowUp, ArrowDown, RotateCcw, Save, Loader2,
  Move, TreeDeciduous, QrCode, Image, Type, Maximize2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DesignerLayer {
  id: string;
  label: string;
  icon: "tree" | "qr" | "image" | "text";
  imageUrl?: string;
  text?: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface PrintDimensions {
  width: number;
  height: number;
  label: string;
}

const PRODUCT_DIMENSIONS: Record<string, PrintDimensions> = {
  "poster-8x10": { width: 2400, height: 3000, label: '8"×10"' },
  "poster-11x14": { width: 3300, height: 4200, label: '11"×14"' },
  "poster-12x16": { width: 3600, height: 4800, label: '12"×16"' },
  "poster-12x18": { width: 3600, height: 5400, label: '12"×18"' },
  "poster-16x20": { width: 4800, height: 6000, label: '16"×20"' },
  "poster-18x24": { width: 5400, height: 7200, label: '18"×24"' },
  "poster-24x36": { width: 7200, height: 10800, label: '24"×36"' },
  "mug-11oz": { width: 4500, height: 1900, label: "11oz Mug" },
  "mug-15oz": { width: 4500, height: 2100, label: "15oz Mug" },
  "mug-20oz": { width: 4500, height: 2300, label: "20oz Mug" },
  "shirt-front": { width: 3600, height: 4800, label: "Shirt Front" },
  "shirt-back": { width: 3600, height: 4800, label: "Shirt Back" },
  "blanket": { width: 5400, height: 7200, label: "Blanket" },
  "pillow": { width: 4500, height: 4500, label: "Pillow" },
  "tote-front": { width: 3600, height: 4200, label: "Tote Front" },
  "tote-back": { width: 3600, height: 4200, label: "Tote Back" },
  "sticker": { width: 1800, height: 1800, label: "Sticker" },
  "hat": { width: 2400, height: 1200, label: "Hat Front" },
  "default": { width: 3600, height: 3600, label: "Print Area" },
};

function getPrintDimensions(
  productId: number,
  variantName: string,
  printArea?: string,
  category?: string
): PrintDimensions {
  const vLower = variantName.toLowerCase();

  if (productId === 1) {
    if (vLower.includes("8") && vLower.includes("10")) return PRODUCT_DIMENSIONS["poster-8x10"];
    if (vLower.includes("11") && vLower.includes("14")) return PRODUCT_DIMENSIONS["poster-11x14"];
    if (vLower.includes("12") && vLower.includes("16")) return PRODUCT_DIMENSIONS["poster-12x16"];
    if (vLower.includes("12") && vLower.includes("18")) return PRODUCT_DIMENSIONS["poster-12x18"];
    if (vLower.includes("16") && vLower.includes("20")) return PRODUCT_DIMENSIONS["poster-16x20"];
    if (vLower.includes("18") && vLower.includes("24")) return PRODUCT_DIMENSIONS["poster-18x24"];
    if (vLower.includes("24") && vLower.includes("36")) return PRODUCT_DIMENSIONS["poster-24x36"];
    return PRODUCT_DIMENSIONS["poster-18x24"];
  }

  if (productId === 19 || productId === 300) {
    if (vLower.includes("11")) return PRODUCT_DIMENSIONS["mug-11oz"];
    if (vLower.includes("15")) return PRODUCT_DIMENSIONS["mug-15oz"];
    if (vLower.includes("20")) return PRODUCT_DIMENSIONS["mug-20oz"];
    return PRODUCT_DIMENSIONS["mug-11oz"];
  }

  if (printArea === "wrap") return PRODUCT_DIMENSIONS["mug-11oz"];

  if (category === "apparel") {
    if (productId === 77) return PRODUCT_DIMENSIONS["hat"];
    return PRODUCT_DIMENSIONS["shirt-front"];
  }

  if (productId === 395) return PRODUCT_DIMENSIONS["blanket"];
  if (productId === 214) return PRODUCT_DIMENSIONS["pillow"];
  if (productId === 84) return PRODUCT_DIMENSIONS["tote-front"];
  if (productId === 505) return PRODUCT_DIMENSIONS["sticker"];

  return PRODUCT_DIMENSIONS["default"];
}

interface PrintDesignerProps {
  productId: number;
  variantName: string;
  printArea?: string;
  category?: string;
  treeImageUrl?: string;
  qrImageUrl?: string;
  customImageUrl?: string;
  customText?: string;
  onSave: (compositedObjectPath: string) => void;
  onCancel: () => void;
}

export default function PrintDesigner({
  productId,
  variantName,
  printArea,
  category,
  treeImageUrl,
  qrImageUrl,
  customImageUrl,
  customText,
  onSave,
  onCancel,
}: PrintDesignerProps) {
  const { toast } = useToast();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 400 });

  const dims = getPrintDimensions(productId, variantName, printArea, category);
  const aspectRatio = dims.width / dims.height;

  useEffect(() => {
    const updateSize = () => {
      if (!canvasContainerRef.current) return;
      const parentWidth = canvasContainerRef.current.parentElement?.clientWidth || 400;
      const maxW = Math.min(parentWidth - 32, 600);
      const maxH = 500;
      let w = maxW;
      let h = w / aspectRatio;
      if (h > maxH) {
        h = maxH;
        w = h * aspectRatio;
      }
      setContainerSize({ width: Math.round(w), height: Math.round(h) });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [aspectRatio]);

  const scaleFactor = dims.width / containerSize.width;

  const buildDefaultLayers = useCallback((): DesignerLayer[] => {
    const layers: DesignerLayer[] = [];
    let z = 1;
    const cw = containerSize.width;
    const ch = containerSize.height;

    if (treeImageUrl) {
      const w = cw * 0.7;
      const h = ch * 0.65;
      layers.push({
        id: "tree",
        label: "Tree",
        icon: "tree",
        imageUrl: treeImageUrl,
        visible: true,
        x: (cw - w) / 2,
        y: (ch - h) / 2,
        width: w,
        height: h,
        zIndex: z++,
      });
    }

    if (customImageUrl) {
      const w = cw * 0.2;
      const h = ch * 0.2;
      layers.push({
        id: "customImage",
        label: "Logo",
        icon: "image",
        imageUrl: customImageUrl,
        visible: true,
        x: 12,
        y: ch - h - 12,
        width: w,
        height: h,
        zIndex: z++,
      });
    }

    if (qrImageUrl) {
      const size = Math.min(cw, ch) * 0.15;
      layers.push({
        id: "qr",
        label: "QR",
        icon: "qr",
        imageUrl: qrImageUrl,
        visible: true,
        x: cw - size - 12,
        y: ch - size - 12,
        width: size,
        height: size,
        zIndex: z++,
      });
    }

    if (customText && customText.trim()) {
      const w = cw * 0.6;
      const h = 40;
      layers.push({
        id: "text",
        label: "Text",
        icon: "text",
        text: customText.trim(),
        visible: true,
        x: (cw - w) / 2,
        y: 12,
        width: w,
        height: h,
        zIndex: z++,
      });
    }

    return layers;
  }, [containerSize, treeImageUrl, qrImageUrl, customImageUrl, customText]);

  const [layers, setLayers] = useState<DesignerLayer[]>([]);

  useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      setLayers(prev => prev.length === 0 ? buildDefaultLayers() : prev);
    }
  }, [containerSize, buildDefaultLayers]);

  const updateLayer = (id: string, updates: Partial<DesignerLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const toggleVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const moveLayerUp = (id: string) => {
    setLayers(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(l => l.id === id);
      if (idx < sorted.length - 1) {
        const tempZ = sorted[idx].zIndex;
        sorted[idx] = { ...sorted[idx], zIndex: sorted[idx + 1].zIndex };
        sorted[idx + 1] = { ...sorted[idx + 1], zIndex: tempZ };
      }
      return sorted;
    });
  };

  const moveLayerDown = (id: string) => {
    setLayers(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(l => l.id === id);
      if (idx > 0) {
        const tempZ = sorted[idx].zIndex;
        sorted[idx] = { ...sorted[idx], zIndex: sorted[idx - 1].zIndex };
        sorted[idx - 1] = { ...sorted[idx - 1], zIndex: tempZ };
      }
      return sorted;
    });
  };

  const resetLayout = () => {
    setLayers(buildDefaultLayers());
    setSelectedLayerId(null);
  };

  const resolveImageUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    return url.startsWith("/") ? url : `/${url}`;
  };

  const flattenAndSave = async () => {
    setIsSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dims.width, dims.height);

      const visibleLayers = layers
        .filter(l => l.visible)
        .sort((a, b) => a.zIndex - b.zIndex);

      for (const layer of visibleLayers) {
        const px = layer.x * scaleFactor;
        const py = layer.y * scaleFactor;
        const pw = layer.width * scaleFactor;
        const ph = layer.height * scaleFactor;

        if (layer.imageUrl) {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          const src = resolveImageUrl(layer.imageUrl);
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => {
              const fallback = new window.Image();
              fallback.onload = () => {
                ctx.drawImage(fallback, px, py, pw, ph);
                resolve();
              };
              fallback.onerror = () => reject(new Error(`Failed to load image: ${layer.label}`));
              fallback.src = src;
            };
            img.src = src;
          });
          ctx.drawImage(img, px, py, pw, ph);
        } else if (layer.text) {
          const fontSize = Math.max(24, Math.round(ph * 0.6));
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = "#1a1a1a";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const maxWidth = pw - 20;
          const words = layer.text.split(" ");
          let lines: string[] = [];
          let currentLine = "";
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(testLine).width > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
          const lineHeight = fontSize * 1.3;
          const totalHeight = lines.length * lineHeight;
          const startY = py + (ph - totalHeight) / 2 + lineHeight / 2;
          lines.forEach((line, i) => {
            ctx.fillText(line, px + pw / 2, startY + i * lineHeight);
          });
        }
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
          "image/png",
          0.95
        );
      });

      const filename = `composited-${productId}-${Date.now()}.png`;
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: filename,
        size: blob.size,
        contentType: "image/png",
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/png" },
      });

      toast({
        title: "Layout saved",
        description: "Your design has been composited and is ready for printing.",
      });
      onSave(objectPath);
    } catch (err: any) {
      console.error("Flatten failed:", err);
      toast({
        title: "Save failed",
        description: err.message || "Failed to save your design. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getLayerIcon = (icon: DesignerLayer["icon"]) => {
    switch (icon) {
      case "tree": return <TreeDeciduous className="h-3 w-3" />;
      case "qr": return <QrCode className="h-3 w-3" />;
      case "image": return <Image className="h-3 w-3" />;
      case "text": return <Type className="h-3 w-3" />;
    }
  };

  if (layers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="designer-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="print-designer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Print Designer</span>
          <Badge variant="outline" className="text-xs" data-testid="designer-dimensions">
            {dims.label} · {dims.width}×{dims.height}px
          </Badge>
        </div>
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div
          ref={canvasContainerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden flex-shrink-0"
          style={{ width: containerSize.width, height: containerSize.height }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLayerId(null);
          }}
          data-testid="designer-canvas"
        >
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#999" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {layers
            .filter(l => l.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((layer) => (
              <Rnd
                key={layer.id}
                size={{ width: layer.width, height: layer.height }}
                position={{ x: layer.x, y: layer.y }}
                onDragStop={(_e, d) => {
                  updateLayer(layer.id, { x: d.x, y: d.y });
                }}
                onResizeStop={(_e, _dir, ref, _delta, position) => {
                  updateLayer(layer.id, {
                    width: parseFloat(ref.style.width),
                    height: parseFloat(ref.style.height),
                    x: position.x,
                    y: position.y,
                  });
                }}
                bounds="parent"
                minWidth={30}
                minHeight={30}
                style={{ zIndex: layer.zIndex }}
                className={`${selectedLayerId === layer.id ? "ring-2 ring-blue-500" : ""}`}
                onMouseDown={() => setSelectedLayerId(layer.id)}
                data-testid={`designer-layer-${layer.id}`}
              >
                <div className="w-full h-full relative group">
                  {layer.imageUrl && (
                    <img
                      src={resolveImageUrl(layer.imageUrl)}
                      alt={layer.label}
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  )}
                  {layer.text && (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50/80 border border-gray-200 rounded px-2 pointer-events-none">
                      <p className="text-sm font-bold text-gray-800 text-center truncate">
                        {layer.text}
                      </p>
                    </div>
                  )}

                  <div className="absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 shadow-sm">
                      {getLayerIcon(layer.icon)}
                      {layer.label}
                    </Badge>
                  </div>

                  <div className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
                    <Move className="h-3 w-3 text-gray-500" />
                  </div>
                </div>
              </Rnd>
            ))}
        </div>

        <div className="flex-1 min-w-[160px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layers</p>
          <div className="space-y-1">
            {[...layers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => (
              <div
                key={layer.id}
                className={`flex items-center gap-1.5 p-1.5 rounded text-xs cursor-pointer border transition-colors ${
                  selectedLayerId === layer.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-transparent hover:bg-muted/50"
                }`}
                onClick={() => setSelectedLayerId(layer.id)}
                data-testid={`layer-control-${layer.id}`}
              >
                <button
                  className="p-0.5 hover:bg-muted rounded"
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                  data-testid={`layer-visibility-${layer.id}`}
                >
                  {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                </button>
                <span className="flex items-center gap-1 flex-1 truncate">
                  {getLayerIcon(layer.icon)}
                  <span className={layer.visible ? "" : "text-muted-foreground line-through"}>{layer.label}</span>
                </span>
                <button
                  className="p-0.5 hover:bg-muted rounded"
                  onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id); }}
                  data-testid={`layer-up-${layer.id}`}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  className="p-0.5 hover:bg-muted rounded"
                  onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id); }}
                  data-testid={`layer-down-${layer.id}`}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={resetLayout}
              data-testid="button-reset-layout"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Layout
            </Button>
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={flattenAndSave}
              disabled={isSaving || layers.filter(l => l.visible).length === 0}
              data-testid="button-save-layout"
            >
              {isSaving ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
              ) : (
                <><Save className="h-3 w-3 mr-1" />Save Layout</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={onCancel}
              data-testid="button-cancel-designer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Drag elements to reposition. Resize using corner handles. Save to composite into a single print-ready image.
      </p>
    </div>
  );
}
