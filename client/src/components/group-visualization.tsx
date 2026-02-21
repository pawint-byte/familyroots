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
  getMemberRank,
} from "@shared/treeTypes";
import { Crown, Star, Shield } from "lucide-react";

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
  rank?: number;
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

function buildRelMap(relationships: Relationship[]): Map<string, string> {
  const relMap = new Map<string, string>();
  for (const rel of relationships) {
    if (!relMap.has(rel.fromMemberId)) relMap.set(rel.fromMemberId, rel.relationshipType);
    if (!relMap.has(rel.toMemberId)) relMap.set(rel.toMemberId, rel.relationshipType);
  }
  return relMap;
}

function sortByRank(
  members: FamilyMember[],
  relationships: Relationship[],
  treeType: TreeType
): { rank1: FamilyMember[]; rank2: FamilyMember[]; rank3: FamilyMember[] } {
  const rank1: FamilyMember[] = [];
  const rank2: FamilyMember[] = [];
  const rank3: FamilyMember[] = [];

  for (const m of members) {
    const rank = getMemberRank(m.id, relationships, treeType);
    if (rank === 1) rank1.push(m);
    else if (rank === 2) rank2.push(m);
    else rank3.push(m);
  }

  return { rank1, rank2, rank3 };
}

function calculateCircleLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType
): NodePosition[] {
  if (members.length === 0) return [];
  
  const relMap = buildRelMap(relationships);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType);

  if (members.length === 1) {
    const rank = getMemberRank(members[0].id, relationships, treeType);
    return [{
      x: 500, y: 500, member: members[0],
      relationshipType: relMap.get(members[0].id),
      rank,
    }];
  }

  if (rank1.length > 0) {
    const centerX = 500;
    const topY = 150;
    const positions: NodePosition[] = [];

    rank1.forEach((m, i) => {
      const spacing = 200;
      const totalWidth = (rank1.length - 1) * spacing;
      positions.push({
        x: centerX - totalWidth / 2 + i * spacing,
        y: topY,
        member: m,
        relationshipType: relMap.get(m.id),
        rank: 1,
      });
    });

    const subLeaders = rank2;
    const regularMembers = rank3;
    const allBelow = [...subLeaders, ...regularMembers];

    if (allBelow.length > 0) {
      const radius = Math.max(180, allBelow.length * 30);
      const circleY = topY + radius + 200;

      allBelow.forEach((m, i) => {
        const angle = (2 * Math.PI * i) / allBelow.length - Math.PI / 2;
        const memberRank = getMemberRank(m.id, relationships, treeType);
        positions.push({
          x: centerX + radius * Math.cos(angle),
          y: circleY + radius * Math.sin(angle),
          member: m,
          relationshipType: relMap.get(m.id),
          rank: memberRank,
        });
      });
    }

    return positions;
  }

  const radius = Math.max(200, members.length * 35);
  const centerX = radius + 150;
  const centerY = radius + 150;

  const focusIndex = members.findIndex((m) => m.id === focusId);
  const startIndex = focusIndex >= 0 ? focusIndex : 0;
  const sorted = [...members.slice(startIndex), ...members.slice(0, startIndex)];

  return sorted.map((member, i) => {
    const angle = (2 * Math.PI * i) / sorted.length - Math.PI / 2;
    const memberRank = getMemberRank(member.id, relationships, treeType);
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      member,
      relationshipType: relMap.get(member.id),
      rank: memberRank,
    };
  });
}

function calculateRadialLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType
): NodePosition[] {
  if (members.length === 0) return [];

  const centerX = 600;
  const centerY = 600;
  const ringGap = 180;

  const focusMember = members.find((m) => m.id === focusId) || members[0];
  const others = members.filter((m) => m.id !== focusMember.id);
  const relMap = buildRelMap(relationships);

  const { rank1, rank2, rank3 } = sortByRank(others, relationships, treeType);

  const focusRank = getMemberRank(focusMember.id, relationships, treeType);
  const positions: NodePosition[] = [
    { x: centerX, y: centerY, member: focusMember, relationshipType: relMap.get(focusMember.id), rank: focusRank },
  ];

  const placeRing = (ring: FamilyMember[], radius: number) => {
    ring.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      const memberRank = getMemberRank(m.id, relationships, treeType);
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member: m,
        relationshipType: relMap.get(m.id),
        rank: memberRank,
      });
    });
  };

  if (rank1.length > 0) placeRing(rank1, ringGap);
  if (rank2.length > 0) placeRing(rank2, ringGap * 2);
  if (rank3.length > 0) placeRing(rank3, ringGap * 3);

  return positions;
}

function calculateGridLayout(
  members: FamilyMember[],
  _focusId: string,
  relationships: Relationship[],
  treeType: TreeType
): NodePosition[] {
  if (members.length === 0) return [];

  const colWidth = 180;
  const rowHeight = 200;
  const startX = 100;
  const startY = 100;
  const perRow = 5;

  const relMap = buildRelMap(relationships);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType);

  const positions: NodePosition[] = [];
  let currentRow = 0;

  const placeRow = (group: FamilyMember[], row: number, rank: number) => {
    const offsetX = startX + ((perRow - group.length) * colWidth) / 2;
    group.forEach((m, i) => {
      positions.push({
        x: offsetX + i * colWidth,
        y: startY + row * rowHeight,
        member: m,
        relationshipType: relMap.get(m.id),
        rank,
      });
    });
  };

  if (rank1.length > 0) {
    placeRow(rank1, currentRow, 1);
    currentRow++;
  }
  if (rank2.length > 0) {
    placeRow(rank2, currentRow, 2);
    currentRow++;
  }

  for (let i = 0; i < rank3.length; i += perRow) {
    const chunk = rank3.slice(i, i + perRow);
    placeRow(chunk, currentRow, 3);
    currentRow++;
  }

  return positions;
}

function calculateArcLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType
): NodePosition[] {
  if (members.length === 0) return [];

  const relMap = buildRelMap(relationships);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType);

  const focusMember = members.find((m) => m.id === focusId);
  const focusInRank1 = focusMember && rank1.some(m => m.id === focusMember.id);
  
  const leaders = focusInRank1 ? rank1 : (rank1.length > 0 ? rank1 : (focusMember ? [focusMember] : []));
  const others = [...rank2, ...rank3].filter(m => !leaders.some(l => l.id === m.id));
  if (!focusInRank1 && focusMember) {
    const idx = others.findIndex(m => m.id === focusMember.id);
    if (idx >= 0) others.splice(idx, 1);
    if (!leaders.some(l => l.id === focusMember.id)) {
      others.unshift(focusMember);
    }
  }

  const positions: NodePosition[] = [];

  if (leaders.length > 0) {
    const totalWidth = (leaders.length - 1) * 200;
    const centerX = 500;
    leaders.forEach((m, i) => {
      positions.push({
        x: centerX - totalWidth / 2 + i * 200,
        y: 120,
        member: m,
        relationshipType: relMap.get(m.id),
        rank: getMemberRank(m.id, relationships, treeType),
      });
    });
  }

  if (others.length > 0) {
    const radius = Math.max(300, others.length * 30);
    const centerX = 500;
    const centerY = 200;

    others.forEach((member, i) => {
      const t = others.length > 1 ? i / (others.length - 1) : 0.5;
      const angle = Math.PI * 0.15 + t * Math.PI * 0.7;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member,
        relationshipType: relMap.get(member.id),
        rank: getMemberRank(member.id, relationships, treeType),
      });
    });
  }

  return positions;
}

function calculateNetworkLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType
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

  const relMap = buildRelMap(relationships);

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
      const memberRank = getMemberRank(layerMembers[0].id, relationships, treeType);
      positions.push({
        x: centerX, y: centerY, member: layerMembers[0],
        relationshipType: relMap.get(layerMembers[0].id),
        rank: memberRank,
      });
      return;
    }
    const radius = d === 999 ? (maxRealDist + 2) * layerGap : d * layerGap;
    layerMembers.forEach((m: FamilyMember, i: number) => {
      const angle = (2 * Math.PI * i) / layerMembers.length - Math.PI / 2;
      const memberRank = getMemberRank(m.id, relationships, treeType);
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member: m,
        relationshipType: relMap.get(m.id),
        rank: memberRank,
      });
    });
  });

  return positions;
}

function calculatePositions(
  layout: LayoutShape,
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType
): NodePosition[] {
  switch (layout) {
    case "circle":
      return calculateCircleLayout(members, focusId, relationships, treeType);
    case "radial":
      return calculateRadialLayout(members, focusId, relationships, treeType);
    case "grid":
      return calculateGridLayout(members, focusId, relationships, treeType);
    case "arc":
      return calculateArcLayout(members, focusId, relationships, treeType);
    case "network":
      return calculateNetworkLayout(members, focusId, relationships, treeType);
    default:
      return calculateCircleLayout(members, focusId, relationships, treeType);
  }
}

function RankIcon({ rank, accentColor }: { rank: number; accentColor: string }) {
  if (rank === 1) return <Crown className="h-4 w-4" style={{ color: accentColor }} />;
  if (rank === 2) return <Shield className="h-3.5 w-3.5" style={{ color: accentColor }} />;
  return null;
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
        relationships,
        treeType
      ),
    [visual.layoutShape, deduplicatedMembers, focusId, relationships, treeType]
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

  const getNodeSize = (rank?: number) => {
    if (rank === 1) return { w: isCircleNode ? 120 : 152, h: isCircleNode ? 120 : 170 };
    if (rank === 2) return { w: isCircleNode ? 108 : 140, h: isCircleNode ? 108 : 155 };
    return { w: isCircleNode ? 96 : 128, h: isCircleNode ? 96 : 140 };
  };

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
                <rect
                  x={labelX - 30}
                  y={labelY - 8}
                  width={60}
                  height={16}
                  rx={4}
                  fill="var(--background, white)"
                  fillOpacity={0.85}
                  className="pointer-events-none"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={500}
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
          const memberRank = pos.rank || 3;
          const nodeSize = getNodeSize(memberRank);
          const initials = `${pos.member.firstName?.[0] || ""}${pos.member.lastName?.[0] || ""}`.toUpperCase();
          const relLabel = pos.relationshipType
            ? getRelationshipLabel(pos.relationshipType, treeType)
            : undefined;

          const isLeader = memberRank === 1;
          const isSubLeader = memberRank === 2;

          const borderWidth = isLeader ? 3 : isSubLeader ? 2.5 : 2;
          const glowIntensity = isLeader ? "0 0 20px 4px" : isSubLeader ? "0 0 12px 2px" : "0 0 16px 2px";
          const glowOpacity = isLeader ? "50" : isSubLeader ? "35" : "40";

          return (
            <div
              key={pos.member.id}
              data-member-card
              data-testid={`group-member-${pos.member.id}`}
              className={`absolute flex flex-col items-center gap-1 cursor-pointer transition-all duration-200 hover:scale-105 ${
                isCircleNode
                  ? "rounded-full justify-center"
                  : "rounded-lg p-2 justify-start pt-3"
              } bg-card`}
              style={{
                left: pos.x - nodeSize.w / 2 - bounds.minX,
                top: pos.y - nodeSize.h / 2 - bounds.minY,
                width: nodeSize.w,
                height: nodeSize.h,
                borderWidth: `${borderWidth}px`,
                borderStyle: "solid",
                borderColor: visual.accentColor,
                boxShadow: (isFocus || isLeader || isSubLeader)
                  ? `${glowIntensity} ${visual.accentColor}${glowOpacity}`
                  : undefined,
                zIndex: isLeader ? 3 : isSubLeader ? 2 : 1,
              }}
              onClick={() => onMemberClick(pos.member)}
            >
              {isLeader && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full p-0.5"
                  style={{ backgroundColor: visual.accentColor }}
                  data-testid={`leader-crown-${pos.member.id}`}
                >
                  <Crown className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              {isSubLeader && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full p-0.5"
                  style={{ backgroundColor: visual.accentColor }}
                  data-testid={`subleader-badge-${pos.member.id}`}
                >
                  <Star className="h-3 w-3 text-white" />
                </div>
              )}
              <Avatar
                className={
                  isLeader
                    ? (isCircleNode ? "h-14 w-14" : "h-14 w-14")
                    : isSubLeader
                    ? (isCircleNode ? "h-12 w-12" : "h-13 w-13")
                    : (isCircleNode ? "h-10 w-10" : "h-12 w-12")
                }
              >
                {pos.member.photoUrl && (
                  <AvatarImage
                    src={pos.member.photoUrl}
                    alt={pos.member.firstName}
                  />
                )}
                <AvatarFallback className={isLeader ? "text-sm font-bold" : "text-xs"}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isCircleNode && (
                <>
                  <span className={`text-center leading-tight truncate w-full ${
                    isLeader ? "text-sm font-semibold" : isSubLeader ? "text-xs font-medium" : "text-xs font-medium"
                  }`}>
                    {pos.member.firstName}
                  </span>
                  {relLabel && (
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0 ${isLeader ? "text-[11px] font-semibold" : "text-[10px] scale-90"}`}
                      style={
                        {
                          "--badge-outline": visual.accentColor,
                          color: isLeader ? "white" : visual.accentColor,
                          backgroundColor: isLeader ? visual.accentColor : "transparent",
                          borderColor: visual.accentColor,
                        } as React.CSSProperties
                      }
                    >
                      <RankIcon rank={memberRank} accentColor={isLeader ? "white" : visual.accentColor} />
                      <span className={memberRank <= 2 ? "ml-0.5" : ""}>{relLabel}</span>
                    </Badge>
                  )}
                </>
              )}
              {isCircleNode && (
                <span className={`text-center leading-tight truncate w-full ${
                  isLeader ? "text-xs font-semibold" : "text-[10px] font-medium"
                }`}>
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
