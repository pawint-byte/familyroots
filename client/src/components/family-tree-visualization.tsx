import { useRef, useEffect, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FamilyMember, Relationship } from "@shared/schema";

interface FamilyTreeVisualizationProps {
  members: FamilyMember[];
  relationships: Relationship[];
  zoom: number;
  onMemberClick: (member: FamilyMember) => void;
}

interface NodePosition {
  x: number;
  y: number;
  member: FamilyMember;
}

export default function FamilyTreeVisualization({
  members,
  relationships,
  zoom,
  onMemberClick,
}: FamilyTreeVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<NodePosition[]>([]);

  const calculatePositions = useCallback(() => {
    if (members.length === 0) return [];

    const nodeWidth = 160;
    const nodeHeight = 200;
    const horizontalGap = 40;
    const verticalGap = 80;

    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string[]>();
    const spouseMap = new Map<string, string[]>();

    relationships.forEach((rel) => {
      if (rel.relationshipType === "parent") {
        if (!parentChildMap.has(rel.fromMemberId)) {
          parentChildMap.set(rel.fromMemberId, []);
        }
        parentChildMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        
        if (!childParentMap.has(rel.toMemberId)) {
          childParentMap.set(rel.toMemberId, []);
        }
        childParentMap.get(rel.toMemberId)!.push(rel.fromMemberId);
      } else if (rel.relationshipType === "spouse") {
        if (!spouseMap.has(rel.fromMemberId)) {
          spouseMap.set(rel.fromMemberId, []);
        }
        spouseMap.get(rel.fromMemberId)!.push(rel.toMemberId);
      }
    });

    const rootMembers = members.filter(
      (m) => !childParentMap.has(m.id) || childParentMap.get(m.id)!.length === 0
    );

    const positioned: NodePosition[] = [];
    const visited = new Set<string>();

    const positionSubtree = (
      memberId: string,
      level: number,
      startX: number
    ): number => {
      if (visited.has(memberId)) return startX;
      visited.add(memberId);

      const member = members.find((m) => m.id === memberId);
      if (!member) return startX;

      const children = parentChildMap.get(memberId) || [];
      let subtreeWidth = 0;

      if (children.length > 0) {
        let childX = startX;
        children.forEach((childId) => {
          const childWidth = positionSubtree(childId, level + 1, childX);
          childX += childWidth + horizontalGap;
          subtreeWidth += childWidth + horizontalGap;
        });
        subtreeWidth -= horizontalGap;
      } else {
        subtreeWidth = nodeWidth;
      }

      const x = startX + subtreeWidth / 2 - nodeWidth / 2;
      const y = level * (nodeHeight + verticalGap);

      positioned.push({ x, y, member });

      return subtreeWidth;
    };

    let currentX = 0;
    if (rootMembers.length > 0) {
      rootMembers.forEach((root) => {
        const width = positionSubtree(root.id, 0, currentX);
        currentX += width + horizontalGap * 2;
      });
    }

    members.forEach((member) => {
      if (!visited.has(member.id)) {
        positioned.push({
          x: currentX,
          y: 0,
          member,
        });
        currentX += nodeWidth + horizontalGap;
      }
    });

    return positioned;
  }, [members, relationships]);

  useEffect(() => {
    setPositions(calculatePositions());
  }, [calculatePositions]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-member-node]")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getConnectionLines = () => {
    const lines: JSX.Element[] = [];
    const positionMap = new Map<string, NodePosition>();
    positions.forEach((p) => positionMap.set(p.member.id, p));

    relationships.forEach((rel, index) => {
      const from = positionMap.get(rel.fromMemberId);
      const to = positionMap.get(rel.toMemberId);

      if (!from || !to) return;

      const nodeWidth = 160;
      const nodeHeight = 120;

      const fromX = from.x + nodeWidth / 2;
      const fromY = from.y + nodeHeight;
      const toX = to.x + nodeWidth / 2;
      const toY = to.y;

      if (rel.relationshipType === "parent") {
        const midY = (fromY + toY) / 2;
        lines.push(
          <path
            key={`line-${index}`}
            d={`M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            fill="none"
            strokeDasharray="none"
            opacity="0.4"
          />
        );
      } else if (rel.relationshipType === "spouse") {
        const y = from.y + nodeHeight / 2;
        lines.push(
          <path
            key={`line-${index}`}
            d={`M ${from.x + nodeWidth} ${y} L ${to.x} ${y}`}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        );
      }
    });

    return lines;
  };

  const minX = positions.length > 0 ? Math.min(...positions.map((p) => p.x)) - 100 : 0;
  const maxX = positions.length > 0 ? Math.max(...positions.map((p) => p.x)) + 260 : 800;
  const minY = positions.length > 0 ? Math.min(...positions.map((p) => p.y)) - 50 : 0;
  const maxY = positions.length > 0 ? Math.max(...positions.map((p) => p.y)) + 250 : 600;

  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-gradient-to-br from-background via-card/20 to-background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="relative"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          width={svgWidth}
          height={svgHeight}
          viewBox={`${minX} ${minY} ${svgWidth} ${svgHeight}`}
        >
          {getConnectionLines()}
        </svg>

        {positions.map((pos) => (
          <div
            key={pos.member.id}
            data-member-node
            className="absolute cursor-pointer transition-shadow duration-200 hover:z-10"
            style={{
              left: pos.x,
              top: pos.y,
              width: 160,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMemberClick(pos.member);
            }}
            data-testid={`node-member-${pos.member.id}`}
          >
            <div className="bg-card rounded-xl border border-card-border p-4 shadow-sm hover:shadow-md transition-shadow hover-elevate">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-16 w-16 mb-3 ring-2 ring-background">
                  <AvatarImage src={pos.member.photoUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-serif text-xl">
                    {pos.member.firstName[0]}
                    {pos.member.lastName?.[0] || ""}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-sm truncate w-full">
                  {pos.member.firstName}
                </h3>
                <p className="text-xs text-muted-foreground truncate w-full">
                  {pos.member.lastName || ""}
                </p>
                {pos.member.birthDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(pos.member.birthDate).getFullYear()}
                    {pos.member.deathDate && ` - ${new Date(pos.member.deathDate).getFullYear()}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
