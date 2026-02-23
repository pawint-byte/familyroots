import { useRef, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { FamilyMember, Relationship } from "@shared/schema";
import {
  type TreeType,
  type CustomRelType,
  getTreeTypeConfig,
  type TreeVisualConfig,
  type LayoutShape,
  type LineStyle,
  getRelationshipTypesForTree,
  getMemberRank,
  getMemberDirectionalRole,
  getReverseRelationshipType,
  getDirectionalRoles,
} from "@shared/treeTypes";
import { Crown, Star, Shield } from "lucide-react";

export type GroupLayoutMode = "auto" | "hub" | "top-grid" | "circle" | "radial" | "grid" | "arc" | "network";

interface GroupVisualizationProps {
  members: FamilyMember[];
  relationships: Relationship[];
  zoom: number;
  onMemberClick: (member: FamilyMember) => void;
  onMemberPositionChange?: (memberId: string, position: { x: number; y: number }) => void;
  focusMemberId?: string | null;
  treeType: TreeType;
  layoutOverride?: GroupLayoutMode;
  customRelationshipTypes?: CustomRelType[] | null;
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
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): string {
  const types = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  const found = types.find((t) => t.value === relationshipType);
  return found ? found.label : relationshipType;
}

function buildRelMap(
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): Map<string, string> {
  const relMap = new Map<string, string>();
  const rankMap = new Map<string, number>();
  const types = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  for (const rel of relationships) {
    const { fromRole, toRole } = getDirectionalRoles(treeType, rel.relationshipType, customRelationshipTypes);
    const effectiveFrom = fromRole || rel.relationshipType;
    const effectiveTo = toRole || rel.relationshipType;
    const fromRank = types.find(t => t.value === effectiveFrom)?.rank || 3;
    const toRank = types.find(t => t.value === effectiveTo)?.rank || 3;
    if (!rankMap.has(rel.fromMemberId) || fromRank < (rankMap.get(rel.fromMemberId) || 3)) {
      relMap.set(rel.fromMemberId, effectiveFrom);
      rankMap.set(rel.fromMemberId, fromRank);
    }
    if (!rankMap.has(rel.toMemberId) || toRank < (rankMap.get(rel.toMemberId) || 3)) {
      relMap.set(rel.toMemberId, effectiveTo);
      rankMap.set(rel.toMemberId, toRank);
    }
  }
  return relMap;
}

function sortByRank(
  members: FamilyMember[],
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): { rank1: FamilyMember[]; rank2: FamilyMember[]; rank3: FamilyMember[] } {
  const rank1: FamilyMember[] = [];
  const rank2: FamilyMember[] = [];
  const rank3: FamilyMember[] = [];

  for (const m of members) {
    const rank = getMemberRank(m.id, relationships, treeType, customRelationshipTypes);
    if (rank === 1) rank1.push(m);
    else if (rank === 2) rank2.push(m);
    else rank3.push(m);
  }

  return { rank1, rank2, rank3 };
}

const CIRCLE_SPOKE_THRESHOLD = 12;

function resolveLeadersAndRest(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
) {
  const relMap = buildRelMap(relationships, treeType, customRelationshipTypes);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType, customRelationshipTypes);
  const leaders = rank1.length > 0 ? rank1 : [members.find((m) => m.id === focusId) || members[0]];
  const subLeaders = rank1.length > 0 ? rank2 : [];
  const rest = rank1.length > 0
    ? rank3
    : members.filter((m) => !leaders.some((l) => l.id === m.id));
  return { leaders, subLeaders, rest, relMap };
}

function calculateHubLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (members.length === 0) return [];
  const { leaders, subLeaders, rest, relMap } = resolveLeadersAndRest(members, focusId, relationships, treeType, customRelationshipTypes);

  if (members.length === 1) {
    const rank = getMemberRank(members[0].id, relationships, treeType, customRelationshipTypes);
    return [{ x: 500, y: 300, member: members[0], relationshipType: relMap.get(members[0].id), rank }];
  }

  const allOuter = [...subLeaders, ...rest];
  const outerRadius = Math.max(220, allOuter.length * 40);
  const centerX = outerRadius + 100;
  const centerY = outerRadius + 100;
  const positions: NodePosition[] = [];

  if (leaders.length === 1) {
    positions.push({ x: centerX, y: centerY, member: leaders[0], relationshipType: relMap.get(leaders[0].id), rank: 1 });
  } else {
    const leaderSpread = Math.min(100, outerRadius * 0.3);
    leaders.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / leaders.length - Math.PI / 2;
      positions.push({ x: centerX + leaderSpread * Math.cos(angle), y: centerY + leaderSpread * Math.sin(angle), member: m, relationshipType: relMap.get(m.id), rank: 1 });
    });
  }

  allOuter.forEach((m, i) => {
    const angle = (2 * Math.PI * i) / allOuter.length - Math.PI / 2;
    const memberRank = getMemberRank(m.id, relationships, treeType, customRelationshipTypes);
    positions.push({ x: centerX + outerRadius * Math.cos(angle), y: centerY + outerRadius * Math.sin(angle), member: m, relationshipType: relMap.get(m.id), rank: memberRank });
  });

  return positions;
}

function calculateUnifiedGridLayout(
  members: FamilyMember[],
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (members.length === 0) return [];

  const relMap = buildRelMap(relationships, treeType, customRelationshipTypes);

  if (members.length === 1) {
    const rank = getMemberRank(members[0].id, relationships, treeType, customRelationshipTypes);
    return [{ x: 500, y: 300, member: members[0], relationshipType: relMap.get(members[0].id), rank }];
  }

  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType, customRelationshipTypes);

  const nodeW = 170;
  const nodeH = 190;
  const gapX = 30;
  const gapY = 40;
  const perRow = Math.max(2, Math.ceil(Math.sqrt(members.length * 1.4)));
  const totalGridWidth = perRow * nodeW + (perRow - 1) * gapX;
  const centerX = totalGridWidth / 2 + 100;

  const positions: NodePosition[] = [];
  let currentRow = 0;

  const placeGroup = (group: FamilyMember[], rank: number) => {
    for (let i = 0; i < group.length; i += perRow) {
      const chunk = group.slice(i, i + perRow);
      const rowWidth = chunk.length * nodeW + (chunk.length - 1) * gapX;
      const startX = centerX - rowWidth / 2;
      chunk.forEach((m, col) => {
        positions.push({
          x: startX + col * (nodeW + gapX) + nodeW / 2,
          y: 80 + currentRow * (nodeH + gapY) + nodeH / 2,
          member: m,
          relationshipType: relMap.get(m.id),
          rank,
        });
      });
      currentRow++;
    }
  };

  if (rank1.length > 0) placeGroup(rank1, 1);
  if (rank2.length > 0) placeGroup(rank2, 2);
  if (rank3.length > 0) placeGroup(rank3, 3);

  return positions;
}

function calculateTopGridLayout(
  members: FamilyMember[],
  _focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  return calculateUnifiedGridLayout(members, relationships, treeType, customRelationshipTypes);
}

function calculateCircleLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (members.length === 0) return [];
  const { subLeaders, rest } = resolveLeadersAndRest(members, focusId, relationships, treeType, customRelationshipTypes);
  const nonLeaderCount = subLeaders.length + rest.length;

  if (nonLeaderCount <= CIRCLE_SPOKE_THRESHOLD) {
    return calculateHubLayout(members, focusId, relationships, treeType, customRelationshipTypes);
  }
  return calculateTopGridLayout(members, focusId, relationships, treeType, customRelationshipTypes);
}

function calculateRadialLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (members.length === 0) return [];

  const centerX = 600;
  const centerY = 600;
  const ringGap = 180;

  const relMap = buildRelMap(relationships, treeType, customRelationshipTypes);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType, customRelationshipTypes);

  const focusMember = members.find((m) => m.id === focusId);
  const focusIsLeader = focusMember && rank1.some(m => m.id === focusMember.id);
  const centerMember = focusIsLeader ? focusMember! : (rank1.length > 0 ? rank1[0] : (focusMember || members[0]));

  const remainingRank1 = rank1.filter(m => m.id !== centerMember.id);

  const centerRank = getMemberRank(centerMember.id, relationships, treeType, customRelationshipTypes);
  const positions: NodePosition[] = [
    { x: centerX, y: centerY, member: centerMember, relationshipType: relMap.get(centerMember.id), rank: centerRank },
  ];

  const placeRing = (ring: FamilyMember[], radius: number) => {
    ring.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;
      const memberRank = getMemberRank(m.id, relationships, treeType, customRelationshipTypes);
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        member: m,
        relationshipType: relMap.get(m.id),
        rank: memberRank,
      });
    });
  };

  if (remainingRank1.length > 0) placeRing(remainingRank1, ringGap);
  if (rank2.length > 0) placeRing(rank2, ringGap * (remainingRank1.length > 0 ? 2 : 1));
  if (rank3.length > 0) placeRing(rank3, ringGap * (remainingRank1.length > 0 ? 3 : rank2.length > 0 ? 2 : 1));

  return positions;
}

function calculateGridLayout(
  members: FamilyMember[],
  _focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  return calculateUnifiedGridLayout(members, relationships, treeType, customRelationshipTypes);
}

function calculateArcLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (members.length === 0) return [];

  const relMap = buildRelMap(relationships, treeType, customRelationshipTypes);
  const { rank1, rank2, rank3 } = sortByRank(members, relationships, treeType, customRelationshipTypes);

  const focusMember = members.find((m) => m.id === focusId);
  const leaders = rank1.length > 0 ? rank1 : (focusMember ? [focusMember] : [members[0]]);
  const others = [...rank2, ...rank3].filter(m => !leaders.some(l => l.id === m.id));
  if (focusMember && !leaders.some(l => l.id === focusMember.id)) {
    const idx = others.findIndex(m => m.id === focusMember.id);
    if (idx > 0) {
      others.splice(idx, 1);
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
        rank: getMemberRank(m.id, relationships, treeType, customRelationshipTypes),
      });
    });
  }

  if (others.length > 0) {
    const radius = Math.max(300, others.length * 30);
    const arcCenterX = 500;
    const arcCenterY = 180;

    others.forEach((member, i) => {
      const t = others.length > 1 ? i / (others.length - 1) : 0.5;
      const angle = Math.PI * 0.1 + t * Math.PI * 0.8;
      positions.push({
        x: arcCenterX + radius * Math.cos(angle),
        y: arcCenterY + radius * Math.sin(angle),
        member,
        relationshipType: relMap.get(member.id),
        rank: getMemberRank(member.id, relationships, treeType, customRelationshipTypes),
      });
    });
  }

  return positions;
}

function calculateNetworkLayout(
  members: FamilyMember[],
  focusId: string,
  relationships: Relationship[],
  treeType: TreeType,
  customRelationshipTypes?: CustomRelType[] | null
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

  const relMap = buildRelMap(relationships, treeType, customRelationshipTypes);

  const { rank1 } = sortByRank(members, relationships, treeType, customRelationshipTypes);
  const focusMember = members.find((m) => m.id === focusId);
  const focusIsLeader = focusMember && rank1.some(m => m.id === focusMember.id);
  const startId = focusIsLeader ? focusMember!.id : (rank1.length > 0 ? rank1[0].id : (focusMember?.id || members[0].id));
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
      const memberRank = getMemberRank(layerMembers[0].id, relationships, treeType, customRelationshipTypes);
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
      const memberRank = getMemberRank(m.id, relationships, treeType, customRelationshipTypes);
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
  treeType: TreeType,
  layoutOverride?: GroupLayoutMode,
  customRelationshipTypes?: CustomRelType[] | null
): NodePosition[] {
  if (layoutOverride && layoutOverride !== "auto") {
    switch (layoutOverride) {
      case "hub":
        return calculateHubLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "top-grid":
        return calculateTopGridLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "circle":
        return calculateCircleLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "radial":
        return calculateRadialLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "grid":
        return calculateGridLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "arc":
        return calculateArcLayout(members, focusId, relationships, treeType, customRelationshipTypes);
      case "network":
        return calculateNetworkLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    }
  }

  switch (layout) {
    case "circle":
      return calculateCircleLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    case "radial":
      return calculateRadialLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    case "grid":
      return calculateGridLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    case "arc":
      return calculateArcLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    case "network":
      return calculateNetworkLayout(members, focusId, relationships, treeType, customRelationshipTypes);
    default:
      return calculateCircleLayout(members, focusId, relationships, treeType, customRelationshipTypes);
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
  onMemberPositionChange,
  focusMemberId,
  treeType,
  layoutOverride,
  customRelationshipTypes,
}: GroupVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [draggedPosition, setDraggedPosition] = useState<{ x: number; y: number } | null>(null);
  const memberDragStartRef = useRef<{ pointerX: number; pointerY: number; memberX: number; memberY: number } | null>(null);
  const memberDidDragRef = useRef(false);

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

  const positions = useMemo(() => {
    return calculatePositions(
      visual.layoutShape,
      deduplicatedMembers,
      focusId,
      relationships,
      treeType,
      layoutOverride,
      customRelationshipTypes
    );
  }, [visual.layoutShape, deduplicatedMembers, focusId, relationships, treeType, layoutOverride, customRelationshipTypes]);

  const effectivePositions = useMemo(() => {
    if (!draggedMemberId || !draggedPosition) return positions;
    return positions.map((p) =>
      p.member.id === draggedMemberId
        ? { ...p, x: draggedPosition.x, y: draggedPosition.y }
        : p
    );
  }, [positions, draggedMemberId, draggedPosition]);

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
    for (const p of effectivePositions) map.set(p.member.id, p);
    return map;
  }, [effectivePositions]);

  const isGridLayout = layoutOverride === "top-grid" || layoutOverride === "grid";

  const gridRowLines = useMemo(() => {
    if (!isGridLayout) return [];
    const rowMap = new Map<number, { minX: number; maxX: number; y: number }>();
    for (const pos of effectivePositions) {
      const roundedY = Math.round(pos.y);
      const existing = rowMap.get(roundedY);
      if (existing) {
        existing.minX = Math.min(existing.minX, pos.x);
        existing.maxX = Math.max(existing.maxX, pos.x);
      } else {
        rowMap.set(roundedY, { minX: pos.x, maxX: pos.x, y: pos.y });
      }
    }
    const rows = Array.from(rowMap.values())
      .filter(r => r.minX !== r.maxX)
      .sort((a, b) => a.y - b.y);

    const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const cur = rows[i];
      const next = rows[i + 1];
      const midY = (cur.y + 95 + next.y - 95) / 2;
      const midX = (Math.min(cur.minX, next.minX) + Math.max(cur.maxX, next.maxX)) / 2;
      lines.push({ x1: midX, y1: cur.y + 95, x2: midX, y2: next.y - 95, key: `grid-row-${i}` });
    }
    return lines;
  }, [isGridLayout, effectivePositions]);

  const connectionLines = useMemo(() => {
    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      fromLabel: string;
      toLabel: string;
      key: string;
    }[] = [];

    for (const rel of relationships) {
      const from = positionMap.get(rel.fromMemberId);
      const to = positionMap.get(rel.toMemberId);
      if (from && to) {
        const { fromRole, toRole } = getDirectionalRoles(treeType, rel.relationshipType, customRelationshipTypes);
        const fromLabel = getRelationshipLabel(fromRole, treeType, customRelationshipTypes);
        const toLabel = getRelationshipLabel(toRole, treeType, customRelationshipTypes);
        lines.push({
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          fromLabel,
          toLabel,
          key: rel.id,
        });
      }
    }
    return lines;
  }, [relationships, positionMap, treeType, customRelationshipTypes]);

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

  const handleMemberPointerDown = useCallback(
    (e: React.PointerEvent, memberId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const pos = positionMap.get(memberId);
      if (!pos) return;
      memberDidDragRef.current = false;
      setDraggedMemberId(memberId);
      setDraggedPosition({ x: pos.x, y: pos.y });
      memberDragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        memberX: pos.x,
        memberY: pos.y,
      };
    },
    [positionMap]
  );

  const handleMemberPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggedMemberId || !memberDragStartRef.current) return;
      e.preventDefault();
      const rawDx = e.clientX - memberDragStartRef.current.pointerX;
      const rawDy = e.clientY - memberDragStartRef.current.pointerY;
      if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) {
        memberDidDragRef.current = true;
      }
      const dx = rawDx / zoom;
      const dy = rawDy / zoom;
      setDraggedPosition({
        x: memberDragStartRef.current.memberX + dx,
        y: memberDragStartRef.current.memberY + dy,
      });
    },
    [draggedMemberId, zoom]
  );

  const handleMemberPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggedMemberId) return;
      e.preventDefault();
      if (memberDidDragRef.current && draggedPosition && onMemberPositionChange) {
        onMemberPositionChange(draggedMemberId, draggedPosition);
      }
      setDraggedMemberId(null);
      setDraggedPosition(null);
      memberDragStartRef.current = null;
    },
    [draggedMemberId, draggedPosition, onMemberPositionChange]
  );

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
      const gridNodeW = 170;
      const gridNodeH = 190;
      const gridGapX = 30;
      const gridGapY = 40;
      const gridStepX = gridNodeW + gridGapX;
      const gridStepY = gridNodeH + gridGapY;
      const lines: JSX.Element[] = [];
      for (let r = 0; r <= 6; r++) {
        lines.push(
          <line
            key={`gh-${r}`}
            x1={bounds.minX}
            y1={80 + r * gridStepY}
            x2={bounds.maxX}
            y2={80 + r * gridStepY}
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
            x1={60 + c * gridStepX}
            y1={bounds.minY}
            x2={60 + c * gridStepX}
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
      onPointerMove={handleMemberPointerMove}
      onPointerUp={handleMemberPointerUp}
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

          {gridRowLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={visual.lineColor}
              strokeWidth={1.5}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              opacity={0.4}
            />
          ))}

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

            const hasDirectional = line.fromLabel !== line.toLabel;

            const fromLabelX = line.x1 * 0.65 + cx * 0.2 + line.x2 * 0.15;
            const fromLabelY = line.y1 * 0.65 + cy * 0.2 + line.y2 * 0.15;
            const toLabelX = line.x1 * 0.15 + cx * 0.2 + line.x2 * 0.65;
            const toLabelY = line.y1 * 0.15 + cy * 0.2 + line.y2 * 0.65;

            const midLabelX = (line.x1 + 2 * cx + line.x2) / 4;
            const midLabelY = (line.y1 + 2 * cy + line.y2) / 4;

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
                {hasDirectional ? (
                  <>
                    <rect
                      x={fromLabelX - 30}
                      y={fromLabelY - 8}
                      width={60}
                      height={16}
                      rx={4}
                      fill="var(--background, white)"
                      fillOpacity={0.85}
                      className="pointer-events-none"
                    />
                    <text
                      x={fromLabelX}
                      y={fromLabelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={500}
                      fill={visual.lineColor}
                      className="pointer-events-none"
                    >
                      {line.fromLabel}
                    </text>
                    <rect
                      x={toLabelX - 30}
                      y={toLabelY - 8}
                      width={60}
                      height={16}
                      rx={4}
                      fill="var(--background, white)"
                      fillOpacity={0.85}
                      className="pointer-events-none"
                    />
                    <text
                      x={toLabelX}
                      y={toLabelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={500}
                      fill={visual.lineColor}
                      className="pointer-events-none"
                    >
                      {line.toLabel}
                    </text>
                  </>
                ) : (
                  <>
                    <rect
                      x={midLabelX - 30}
                      y={midLabelY - 8}
                      width={60}
                      height={16}
                      rx={4}
                      fill="var(--background, white)"
                      fillOpacity={0.85}
                      className="pointer-events-none"
                    />
                    <text
                      x={midLabelX}
                      y={midLabelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight={500}
                      fill={visual.lineColor}
                      className="pointer-events-none"
                    >
                      {line.fromLabel}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {effectivePositions.map((pos) => {
          const isFocus = pos.member.id === focusId;
          const memberRank = pos.rank || 3;
          const nodeSize = getNodeSize(memberRank);
          const initials = `${pos.member.firstName?.[0] || ""}${pos.member.lastName?.[0] || ""}`.toUpperCase();
          const relLabel = pos.relationshipType
            ? getRelationshipLabel(pos.relationshipType, treeType, customRelationshipTypes)
            : undefined;

          const isLeader = memberRank === 1;
          const isSubLeader = memberRank === 2;
          const isMemberDragging = draggedMemberId === pos.member.id;

          const borderWidth = isLeader ? 3 : isSubLeader ? 2.5 : 2;
          const glowIntensity = isLeader ? "0 0 20px 4px" : isSubLeader ? "0 0 12px 2px" : "0 0 16px 2px";
          const glowOpacity = isLeader ? "50" : isSubLeader ? "35" : "40";

          return (
            <div
              key={pos.member.id}
              data-member-card
              data-testid={`group-member-${pos.member.id}`}
              className={`absolute flex flex-col items-center gap-1 ${
                isMemberDragging ? "cursor-grabbing" : "cursor-pointer"
              } ${isMemberDragging ? "" : "transition-all duration-200 hover:scale-105"} ${
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
              onPointerDown={(e) => handleMemberPointerDown(e, pos.member.id)}
              onClick={() => {
                if (!memberDidDragRef.current) onMemberClick(pos.member);
              }}
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
