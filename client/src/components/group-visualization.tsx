import { useRef, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { FamilyMember, Relationship } from "@shared/schema";
import {
  type TreeType,
  getTreeTypeConfig,
  type TreeVisualConfig,
  type LayoutShape,
  type LineStyle,
  getRelationshipTypesForTree,
} from "@shared/treeTypes";

interface GroupVisualizationProps {
  members: FamilyMember[];
  relationships: Relationship[];
  zoom: number;
  onMemberClick: (member: FamilyMember) => void;
  focusMemberId?: string | null;
  treeType: TreeType;
}

interface NodePosition {
  x: number;
  y: number;
  member: FamilyMember;
  relationshipType?: string;
}

function getStrokeDashArray(lineStyle: LineStyle): string {
  if (lineStyle === "dashed") return "8 4";
  if (lineStyle === "dotted") return "3 3";
  return "";
}

function getRelationshipLabel(
  relationshipType: string,
  treeType: TreeType
): string {
  const types = getRelationshipTypesForTree(treeType);
  const found = types.find((t) => t.value === relationshipType);
  return found ? found.label : relationshipType;
}

function getMemberRelationshipType(
  memberId: string,
  relationships: Relationship[]
): string | undefined {
  for (const rel of relationships) {
    if (rel.fromMemberId === memberId) return rel.relationshipType;
    if (rel.toMemberId === memberId) return rel.relationshipType;
  }
  return undefined;
}

function calculateCircleLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  if (members.length === 0) return [];
  if (members.length === 1) {
    return [
      {
        x: 500,
        y: 500,
        member: members[0],
        relationshipType: getMemberRelationshipType(
          members[0].id,
          relationships
        ),
      },
    ];
  }

  const radius = Math.max(200, members.length * 35);
  const centerX = radius + 150;
  const centerY = radius + 150;

  const focusIndex = members.findIndex((m) => m.id === focusId);
  const startIndex = focusIndex >= 0 ? focusIndex : 0;

  const sorted = [
    ...members.slice(startIndex),
    ...members.slice(0, startIndex),
  ];

  return sorted.map((member, i) => {
    const angle = (2 * Math.PI * i) / sorted.length - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      member,
      relationshipType: getMemberRelationshipType(member.id, relationships),
    };
  });
}

function calculateRadialLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  const centerX = 600;
  const centerY = 600;
  const ringGap = 180;

  const leaderTypes = new Set([
    "pastor",
    "elder",
    "ministry_leader",
    "leader",
  ]);
  const middleTypes = new Set(["mentor", "ministry_member", "officer"]);

  const focusMember = members.find((m) => m.id === focusId) || members[0];
  const others = members.filter((m) => m.id !== focusMember.id);

  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    if (!relMap.has(rel.fromMemberId)) relMap.set(rel.fromMemberId, rel.relationshipType);
    if (!relMap.has(rel.toMemberId)) relMap.set(rel.toMemberId, rel.relationshipType);
  }

  const ring1: FamilyMember[] = [];
  const ring2: FamilyMember[] = [];
  const ring3: FamilyMember[] = [];

  for (const m of others) {
    const rt = relMap.get(m.id);
    if (rt && leaderTypes.has(rt)) ring1.push(m);
    else if (rt && middleTypes.has(rt)) ring2.push(m);
    else ring3.push(m);
  }

  const positions: NodePosition[] = [
    {
      x: centerX,
      y: centerY,
      member: focusMember,
      relationshipType: relMap.get(focusMember.id),
    },
  ];

  const placeRing = (ring: FamilyMember[], radius: number) => {
    ring.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member: m,
        relationshipType: relMap.get(m.id),
      });
    });
  };

  if (ring1.length > 0) placeRing(ring1, ringGap);
  if (ring2.length > 0) placeRing(ring2, ringGap * 2);
  if (ring3.length > 0) placeRing(ring3, ringGap * 3);

  return positions;
}

function calculateGridLayout(
  members: FamilyMember[],
  _focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  const colWidth = 180;
  const rowHeight = 200;
  const startX = 100;
  const startY = 100;
  const perRow = 5;

  const coachTypes = new Set(["coach", "manager"]);
  const captainTypes = new Set(["captain"]);

  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    if (!relMap.has(rel.fromMemberId)) relMap.set(rel.fromMemberId, rel.relationshipType);
    if (!relMap.has(rel.toMemberId)) relMap.set(rel.toMemberId, rel.relationshipType);
  }

  const coaches: FamilyMember[] = [];
  const captains: FamilyMember[] = [];
  const players: FamilyMember[] = [];

  for (const m of members) {
    const rt = relMap.get(m.id);
    if (rt && coachTypes.has(rt)) coaches.push(m);
    else if (rt && captainTypes.has(rt)) captains.push(m);
    else players.push(m);
  }

  const positions: NodePosition[] = [];
  let currentRow = 0;

  const placeRow = (group: FamilyMember[], row: number) => {
    const offsetX =
      startX + ((perRow - group.length) * colWidth) / 2;
    group.forEach((m, i) => {
      positions.push({
        x: offsetX + i * colWidth,
        y: startY + row * rowHeight,
        member: m,
        relationshipType: relMap.get(m.id),
      });
    });
  };

  if (coaches.length > 0) {
    placeRow(coaches, currentRow);
    currentRow++;
  }
  if (captains.length > 0) {
    placeRow(captains, currentRow);
    currentRow++;
  }

  for (let i = 0; i < players.length; i += perRow) {
    const chunk = players.slice(i, i + perRow);
    placeRow(chunk, currentRow);
    currentRow++;
  }

  return positions;
}

function calculateArcLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  const leaderTypes = new Set([
    "chapter_president",
    "officer",
    "big",
    "leader",
  ]);

  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    if (!relMap.has(rel.fromMemberId)) relMap.set(rel.fromMemberId, rel.relationshipType);
    if (!relMap.has(rel.toMemberId)) relMap.set(rel.toMemberId, rel.relationshipType);
  }

  const leaders: FamilyMember[] = [];
  const others: FamilyMember[] = [];

  for (const m of members) {
    const rt = relMap.get(m.id);
    if (m.id === focusId || (rt && leaderTypes.has(rt))) leaders.push(m);
    else others.push(m);
  }

  const sorted = [...leaders, ...others];
  const radius = Math.max(300, sorted.length * 30);
  const centerX = radius + 150;
  const centerY = 200;

  return sorted.map((member, i) => {
    const t = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
    const angle = Math.PI * 0.15 + t * Math.PI * 0.7;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      member,
      relationshipType: relMap.get(member.id),
    };
  });
}

function calculateNetworkLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  if (members.length === 0) return [];

  const centerX = 600;
  const centerY = 600;
  const layerGap = 180;

  const adjMap = new Map<string, Set<string>>();
  for (const m of members) adjMap.set(m.id, new Set());
  for (const rel of relationships) {
    adjMap.get(rel.fromMemberId)?.add(rel.toMemberId);
    adjMap.get(rel.toMemberId)?.add(rel.fromMemberId);
  }

  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    if (!relMap.has(rel.fromMemberId)) relMap.set(rel.fromMemberId, rel.relationshipType);
    if (!relMap.has(rel.toMemberId)) relMap.set(rel.toMemberId, rel.relationshipType);
  }

  const startId = members.find((m) => m.id === focusId)?.id || members[0].id;
  const dist = new Map<string, number>();
  dist.set(startId, 0);
  const queue = [startId];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const d = dist.get(cur)!;
    const neighbors = adjMap.get(cur) || new Set<string>();
    neighbors.forEach((nb) => {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    });
  }

  for (const m of members) {
    if (!dist.has(m.id)) dist.set(m.id, 999);
  }

  const layers = new Map<number, FamilyMember[]>();
  for (const m of members) {
    const d = dist.get(m.id)!;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(m);
  }

  const positions: NodePosition[] = [];

  const maxRealDist = Array.from(layers.keys()).filter((k) => k < 999).reduce((a, b) => Math.max(a, b), 1);

  Array.from(layers.entries()).forEach(([d, layerMembers]) => {
    if (d === 0) {
      positions.push({
        x: centerX,
        y: centerY,
        member: layerMembers[0],
        relationshipType: relMap.get(layerMembers[0].id),
      });
      return;
    }
    const radius = d === 999 ? (maxRealDist + 2) * layerGap : d * layerGap;
    layerMembers.forEach((m: FamilyMember, i: number) => {
      const angle = (2 * Math.PI * i) / layerMembers.length - Math.PI / 2;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member: m,
        relationshipType: relMap.get(m.id),
      });
    });
  });

  return positions;
}

function calculatePositions(
  layout: LayoutShape,
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[]
): NodePosition[] {
  switch (layout) {
    case "circle":
      return calculateCircleLayout(members, focusId, relationships);
    case "radial":
      return calculateRadialLayout(members, focusId, relationships);
    case "grid":
      return calculateGridLayout(members, focusId, relationships);
    case "arc":
      return calculateArcLayout(members, focusId, relationships);
    case "network":
      return calculateNetworkLayout(members, focusId, relationships);
    default:
      return calculateCircleLayout(members, focusId, relationships);
  }
}

export default function GroupVisualization({
  members,
  relationships,
  zoom,
  onMemberClick,
  focusMemberId,
  treeType,
}: GroupVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const config = getTreeTypeConfig(treeType);
  const visual = config.visual;

  const deduplicatedMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: FamilyMember[] = [];
    for (const member of members) {
      if (!seen.has(member.id)) {
        seen.add(member.id);
        result.push(member);
      }
    }
    return result;
  }, [members]);

  const focusId = useMemo(() => {
    if (focusMemberId && deduplicatedMembers.some((m) => m.id === focusMemberId)) {
      return focusMemberId;
    }
    return deduplicatedMembers[0]?.id || "";
  }, [focusMemberId, deduplicatedMembers]);

  const positions = useMemo(
    () =>
      calculatePositions(
        visual.layoutShape,
        deduplicatedMembers,
        focusId,
        relationships
      ),
    [visual.layoutShape, deduplicatedMembers, focusId, relationships]
  );

  const bounds = useMemo(() => {
    if (positions.length === 0)
      return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of positions) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = 200;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [positions]);

  const positionMap = useMemo(() => {
    const map = new Map<string, NodePosition>();
    for (const p of positions) map.set(p.member.id, p);
    return map;
  }, [positions]);

  const connectionLines = useMemo(() => {
    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      key: string;
    }[] = [];

    for (const rel of relationships) {
      const from = positionMap.get(rel.fromMemberId);
      const to = positionMap.get(rel.toMemberId);
      if (from && to) {
        lines.push({
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          label: getRelationshipLabel(rel.relationshipType, treeType),
          key: rel.id,
        });
      }
    }
    return lines;
  }, [relationships, positionMap, treeType]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-member-card]")) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest("[data-member-card]")) return;
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      });
    },
    [offset]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (deduplicatedMembers.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground"
        data-testid="group-viz-empty"
      >
        No members yet
      </div>
    );
  }

  const dashArray = getStrokeDashArray(visual.lineStyle);
  const isCircleNode = visual.nodeShape === "circle";
  const nodeW = isCircleNode ? 96 : 128;
  const nodeH = isCircleNode ? 96 : 140;

  const renderBackgroundShape = () => {
    const shapeColor = visual.accentColorLight;
    const opacity = 0.18;

    if (visual.layoutShape === "circle") {
      const cx = positions.length > 1
        ? positions.reduce((s, p) => s + p.x, 0) / positions.length
        : 500;
      const cy = positions.length > 1
        ? positions.reduce((s, p) => s + p.y, 0) / positions.length
        : 500;
      const maxDist = positions.reduce((max, p) => {
        const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        return d > max ? d : max;
      }, 0);
      return (
        <circle
          cx={cx}
          cy={cy}
          r={maxDist + 60}
          fill="none"
          stroke={shapeColor}
          strokeWidth={2}
          opacity={opacity}
        />
      );
    }

    if (visual.layoutShape === "radial") {
      const cx = positions[0]?.x || 600;
      const cy = positions[0]?.y || 600;
      return (
        <>
          <circle cx={cx} cy={cy} r={180} fill="none" stroke={shapeColor} strokeWidth={1.5} opacity={opacity} />
          <circle cx={cx} cy={cy} r={360} fill="none" stroke={shapeColor} strokeWidth={1.5} opacity={opacity} />
          <circle cx={cx} cy={cy} r={540} fill="none" stroke={shapeColor} strokeWidth={1.5} opacity={opacity} />
        </>
      );
    }

    if (visual.layoutShape === "grid") {
      const lines: JSX.Element[] = [];
      for (let r = 0; r <= 6; r++) {
        lines.push(
          <line
            key={`gh-${r}`}
            x1={bounds.minX}
            y1={100 + r * 200}
            x2={bounds.maxX}
            y2={100 + r * 200}
            stroke={shapeColor}
            strokeWidth={1}
            opacity={opacity * 0.7}
          />
        );
      }
      for (let c = 0; c <= 5; c++) {
        lines.push(
          <line
            key={`gv-${c}`}
            x1={100 + c * 180}
            y1={bounds.minY}
            x2={100 + c * 180}
            y2={bounds.maxY}
            stroke={shapeColor}
            strokeWidth={1}
            opacity={opacity * 0.7}
          />
        );
      }
      return <>{lines}</>;
    }

    if (visual.layoutShape === "arc") {
      const cx = positions.length > 0
        ? positions.reduce((s, p) => s + p.x, 0) / positions.length
        : 500;
      const radius = Math.max(300, members.length * 30);
      return (
        <path
          d={`M ${cx - radius} 200 A ${radius} ${radius} 0 0 1 ${cx + radius} 200`}
          fill="none"
          stroke={shapeColor}
          strokeWidth={2}
          opacity={opacity}
        />
      );
    }

    return null;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="group-visualization-canvas"
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          width: bounds.width,
          height: bounds.height,
          position: "relative",
        }}
      >
        <svg
          width={bounds.width}
          height={bounds.height}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 0 }}
        >
          {renderBackgroundShape()}

          {connectionLines.map((line) => {
            const mx = (line.x1 + line.x2) / 2;
            const my = (line.y1 + line.y2) / 2;
            const dx = line.x2 - line.x1;
            const dy = line.y2 - line.y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const curvature = Math.min(dist * 0.25, 80);
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);
            const cx = mx + nx * curvature;
            const cy = my + ny * curvature;

            const labelX = (line.x1 + 2 * cx + line.x2) / 4;
            const labelY = (line.y1 + 2 * cy + line.y2) / 4;

            return (
              <g key={line.key}>
                <path
                  d={`M ${line.x1} ${line.y1} Q ${cx} ${cy} ${line.x2} ${line.y2}`}
                  fill="none"
                  stroke={visual.lineColor}
                  strokeWidth={2}
                  strokeDasharray={dashArray}
                  strokeLinecap="round"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={visual.lineColor}
                  className="pointer-events-none"
                >
                  {line.label}
                </text>
              </g>
            );
          })}
        </svg>

        {positions.map((pos) => {
          const isFocus = pos.member.id === focusId;
          const initials = `${pos.member.firstName?.[0] || ""}${pos.member.lastName?.[0] || ""}`.toUpperCase();
          const relLabel = pos.relationshipType
            ? getRelationshipLabel(pos.relationshipType, treeType)
            : undefined;

          return (
            <div
              key={pos.member.id}
              data-member-card
              data-testid={`group-member-${pos.member.id}`}
              className={`absolute flex flex-col items-center gap-1 cursor-pointer transition-shadow ${
                isCircleNode
                  ? "w-24 h-24 rounded-full justify-center"
                  : "w-32 rounded-lg p-2 justify-start pt-3"
              } bg-card border-2 ${
                isFocus ? "border-[3px] shadow-lg" : ""
              }`}
              style={{
                left: pos.x - nodeW / 2 - bounds.minX,
                top: pos.y - nodeH / 2 - bounds.minY,
                borderColor: visual.accentColor,
                boxShadow: isFocus
                  ? `0 0 16px 2px ${visual.accentColor}40`
                  : undefined,
                zIndex: 1,
              }}
              onClick={() => onMemberClick(pos.member)}
            >
              <Avatar
                className={isCircleNode ? "h-10 w-10" : "h-12 w-12"}
              >
                {pos.member.photoUrl && (
                  <AvatarImage
                    src={pos.member.photoUrl}
                    alt={pos.member.firstName}
                  />
                )}
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isCircleNode && (
                <>
                  <span className="text-xs font-medium text-center leading-tight truncate w-full">
                    {pos.member.firstName}
                  </span>
                  {relLabel && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 scale-90"
                      style={
                        {
                          "--badge-outline": visual.accentColor,
                          color: visual.accentColor,
                        } as React.CSSProperties
                      }
                    >
                      {relLabel}
                    </Badge>
                  )}
                </>
              )}
              {isCircleNode && (
                <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                  {pos.member.firstName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
