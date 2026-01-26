import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HelpCircle } from "lucide-react";
import type { FamilyMember, Relationship } from "@shared/schema";

interface FamilyTreeVisualizationProps {
  members: FamilyMember[];
  relationships: Relationship[];
  zoom: number;
  onMemberClick: (member: FamilyMember) => void;
  focusMemberId?: string | null;
}

interface NodePosition {
  x: number;
  y: number;
  member: FamilyMember;
  branchType: 'focus' | 'parent' | 'grandparent' | 'sibling' | 'child' | 'grandchild' | 'spouse' | 'unconnected';
}

interface BranchLabel {
  x: number;
  y: number;
  text: string;
  type: 'parent' | 'sibling' | 'child' | 'unconnected';
}

const BRANCH_COLORS = {
  parent: { line: 'hsl(var(--muted-foreground))', bg: 'bg-card/80 dark:bg-card/60', border: 'border-muted-foreground/30', ring: 'ring-muted-foreground/50', label: 'bg-muted-foreground' },
  grandparent: { line: 'hsl(var(--muted-foreground))', bg: 'bg-card/80 dark:bg-card/60', border: 'border-muted-foreground/30', ring: 'ring-muted-foreground/50', label: 'bg-muted-foreground' },
  sibling: { line: 'hsl(var(--accent-foreground))', bg: 'bg-accent/20 dark:bg-accent/10', border: 'border-accent/50', ring: 'ring-accent/50', label: 'bg-accent' },
  child: { line: 'hsl(var(--primary))', bg: 'bg-primary/10 dark:bg-primary/5', border: 'border-primary/30', ring: 'ring-primary/50', label: 'bg-primary' },
  grandchild: { line: 'hsl(var(--primary))', bg: 'bg-primary/10 dark:bg-primary/5', border: 'border-primary/30', ring: 'ring-primary/50', label: 'bg-primary' },
  spouse: { line: 'hsl(var(--destructive))', bg: 'bg-destructive/10 dark:bg-destructive/5', border: 'border-destructive/30', ring: 'ring-destructive/50', label: 'bg-destructive' },
  focus: { line: 'hsl(var(--primary))', bg: 'bg-primary/20 dark:bg-primary/10', border: 'border-primary', ring: 'ring-primary', label: 'bg-primary' },
  unconnected: { line: 'hsl(var(--muted-foreground))', bg: 'bg-muted/30 dark:bg-muted/20', border: 'border-muted-foreground/20', ring: 'ring-muted-foreground/30', label: 'bg-muted-foreground' },
};

export default function FamilyTreeVisualization({
  members,
  relationships,
  zoom,
  onMemberClick,
  focusMemberId,
}: FamilyTreeVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [branchLabels, setBranchLabels] = useState<BranchLabel[]>([]);
  
  // Dedupe members at the input level to handle any edge cases
  const deduplicatedMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof members = [];
    for (const member of members) {
      if (!seen.has(member.id)) {
        seen.add(member.id);
        result.push(member);
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('[Tree Viz] Duplicate member detected:', member.id, member.firstName, member.lastName);
      }
    }
    return result;
  }, [members]);

  const nodeWidth = 140;
  const nodeHeight = 160;
  const horizontalGap = 60;
  const verticalGap = 120;

  const getRelationshipMaps = useCallback(() => {
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string[]>();
    const spouseMap = new Map<string, string[]>();
    const siblingMap = new Map<string, string[]>();

    relationships.forEach((rel) => {
      if (rel.relationshipType === "parent") {
        // fromMember is the PARENT of toMember
        if (!parentChildMap.has(rel.fromMemberId)) {
          parentChildMap.set(rel.fromMemberId, []);
        }
        parentChildMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        
        if (!childParentMap.has(rel.toMemberId)) {
          childParentMap.set(rel.toMemberId, []);
        }
        childParentMap.get(rel.toMemberId)!.push(rel.fromMemberId);
      } else if (rel.relationshipType === "child") {
        // fromMember is the CHILD of toMember (reverse of parent)
        // So toMember is the parent, fromMember is the child
        if (!parentChildMap.has(rel.toMemberId)) {
          parentChildMap.set(rel.toMemberId, []);
        }
        parentChildMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        if (!childParentMap.has(rel.fromMemberId)) {
          childParentMap.set(rel.fromMemberId, []);
        }
        childParentMap.get(rel.fromMemberId)!.push(rel.toMemberId);
      } else if (rel.relationshipType === "spouse") {
        if (!spouseMap.has(rel.fromMemberId)) {
          spouseMap.set(rel.fromMemberId, []);
        }
        spouseMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!spouseMap.has(rel.toMemberId)) {
          spouseMap.set(rel.toMemberId, []);
        }
        spouseMap.get(rel.toMemberId)!.push(rel.fromMemberId);
      } else if (rel.relationshipType === "sibling") {
        if (!siblingMap.has(rel.fromMemberId)) {
          siblingMap.set(rel.fromMemberId, []);
        }
        siblingMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!siblingMap.has(rel.toMemberId)) {
          siblingMap.set(rel.toMemberId, []);
        }
        siblingMap.get(rel.toMemberId)!.push(rel.fromMemberId);
      }
    });

    return { parentChildMap, childParentMap, spouseMap, siblingMap };
  }, [relationships]);

  const getSiblings = useCallback((memberId: string, parentChildMap: Map<string, string[]>, childParentMap: Map<string, string[]>, siblingMap: Map<string, string[]>): string[] => {
    const siblings = new Set<string>();
    
    const directSiblings = siblingMap.get(memberId) || [];
    directSiblings.forEach(id => siblings.add(id));
    
    const parents = childParentMap.get(memberId) || [];
    parents.forEach(parentId => {
      const parentChildren = parentChildMap.get(parentId) || [];
      parentChildren.forEach(childId => {
        if (childId !== memberId) {
          siblings.add(childId);
        }
      });
    });
    
    return Array.from(siblings);
  }, []);

  const calculateHierarchicalPositions = useCallback(() => {
    if (deduplicatedMembers.length === 0) return { positions: [], labels: [] };

    const positioned: NodePosition[] = [];
    const labels: BranchLabel[] = [];
    const placed = new Set<string>();

    const { parentChildMap, childParentMap, spouseMap, siblingMap } = getRelationshipMaps();

    const focusId = focusMemberId || deduplicatedMembers[0]?.id;
    const focusMember = deduplicatedMembers.find(m => m.id === focusId);
    
    if (!focusMember) return { positions: [], labels: [] };

    const centerX = 400;
    const centerY = 400;

    positioned.push({ x: centerX, y: centerY, member: focusMember, branchType: 'focus' });
    placed.add(focusId);

    const spouses = spouseMap.get(focusId) || [];
    spouses.forEach((spouseId, index) => {
      const spouse = deduplicatedMembers.find(m => m.id === spouseId);
      if (spouse && !placed.has(spouseId)) {
        positioned.push({
          x: centerX + (nodeWidth + horizontalGap) * (index + 1),
          y: centerY,
          member: spouse,
          branchType: 'spouse'
        });
        placed.add(spouseId);
      }
    });

    const parents = childParentMap.get(focusId) || [];
    if (parents.length > 0) {
      const parentY = centerY - verticalGap - nodeHeight;
      const parentStartX = centerX - ((parents.length - 1) * (nodeWidth + horizontalGap)) / 2;
      
      labels.push({ x: centerX, y: parentY + nodeHeight + 40, text: 'Parents', type: 'parent' });
      
      parents.forEach((parentId, index) => {
        const parent = deduplicatedMembers.find(m => m.id === parentId);
        if (parent && !placed.has(parentId)) {
          positioned.push({
            x: parentStartX + index * (nodeWidth + horizontalGap),
            y: parentY,
            member: parent,
            branchType: 'parent'
          });
          placed.add(parentId);

          const grandparents = childParentMap.get(parentId) || [];
          const gpY = parentY - verticalGap - nodeHeight;
          const gpStartX = parentStartX + index * (nodeWidth + horizontalGap) - ((grandparents.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
          
          grandparents.forEach((gpId, gpIndex) => {
            const gp = deduplicatedMembers.find(m => m.id === gpId);
            if (gp && !placed.has(gpId)) {
              positioned.push({
                x: gpStartX + gpIndex * (nodeWidth + horizontalGap / 2),
                y: gpY,
                member: gp,
                branchType: 'grandparent'
              });
              placed.add(gpId);
            }
          });
        }
      });
    }

    // Get siblings but ensure we exclude the focus member and anyone already placed
    const allSiblings = getSiblings(focusId, parentChildMap, childParentMap, siblingMap);
    const siblings = allSiblings.filter(sibId => sibId !== focusId && !placed.has(sibId));
    if (siblings.length > 0) {
      const leftSiblings = siblings.slice(0, Math.ceil(siblings.length / 2));
      const rightSiblings = siblings.slice(Math.ceil(siblings.length / 2));
      
      if (siblings.length > 0) {
        labels.push({ x: centerX - (nodeWidth + horizontalGap) * 2, y: centerY - 30, text: 'Siblings', type: 'sibling' });
      }
      
      leftSiblings.forEach((sibId, index) => {
        const sib = deduplicatedMembers.find(m => m.id === sibId);
        if (sib && !placed.has(sibId)) {
          positioned.push({
            x: centerX - (nodeWidth + horizontalGap) * (index + 1.5),
            y: centerY,
            member: sib,
            branchType: 'sibling'
          });
          placed.add(sibId);
        }
      });
      
      const spouseOffset = spouses.length > 0 ? (spouses.length + 1) : 1;
      rightSiblings.forEach((sibId, index) => {
        const sib = deduplicatedMembers.find(m => m.id === sibId);
        if (sib && !placed.has(sibId)) {
          positioned.push({
            x: centerX + (nodeWidth + horizontalGap) * (index + spouseOffset + 0.5),
            y: centerY,
            member: sib,
            branchType: 'sibling'
          });
          placed.add(sibId);
        }
      });
    }

    const children = parentChildMap.get(focusId) || [];
    const spouseChildren: string[] = [];
    spouses.forEach(spouseId => {
      const sChildren = parentChildMap.get(spouseId) || [];
      sChildren.forEach(cId => {
        if (!children.includes(cId) && !spouseChildren.includes(cId)) {
          spouseChildren.push(cId);
        }
      });
    });
    const allChildren = Array.from(new Set([...children, ...spouseChildren]));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Tree Viz] Focus:', focusId, 'Children:', children, 'SpouseChildren:', spouseChildren, 'AllChildren:', allChildren);
    }
    
    if (allChildren.length > 0) {
      const childY = centerY + verticalGap + nodeHeight;
      // Center children around the focus member
      const childStartX = centerX - ((allChildren.length - 1) * (nodeWidth + horizontalGap)) / 2;
      
      labels.push({ x: centerX, y: childY - 40, text: 'Children', type: 'child' });
      
      allChildren.forEach((childId, index) => {
        const child = deduplicatedMembers.find(m => m.id === childId);
        if (child && !placed.has(childId)) {
          positioned.push({
            x: childStartX + index * (nodeWidth + horizontalGap),
            y: childY,
            member: child,
            branchType: 'child'
          });
          placed.add(childId);

          const grandchildren = parentChildMap.get(childId) || [];
          const gcY = childY + verticalGap + nodeHeight;
          const gcStartX = childStartX + index * (nodeWidth + horizontalGap) - ((grandchildren.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
          
          grandchildren.forEach((gcId, gcIndex) => {
            const gc = deduplicatedMembers.find(m => m.id === gcId);
            if (gc && !placed.has(gcId)) {
              positioned.push({
                x: gcStartX + gcIndex * (nodeWidth + horizontalGap / 2),
                y: gcY,
                member: gc,
                branchType: 'grandchild'
              });
              placed.add(gcId);
            }
          });
        }
      });
    }

    let extraX = centerX + 600;
    let hasUnconnected = false;
    deduplicatedMembers.forEach((member) => {
      if (!placed.has(member.id)) {
        if (!hasUnconnected) {
          labels.push({ x: extraX, y: centerY - 40, text: 'No Relationship Defined', type: 'unconnected' });
          hasUnconnected = true;
        }
        positioned.push({
          x: extraX,
          y: centerY,
          member,
          branchType: 'unconnected'
        });
        extraX += nodeWidth + horizontalGap;
        placed.add(member.id);
      }
    });

    return { positions: positioned, labels };
  }, [deduplicatedMembers, relationships, focusMemberId, getRelationshipMaps, getSiblings, nodeWidth, nodeHeight, horizontalGap, verticalGap]);

  useEffect(() => {
    const result = calculateHierarchicalPositions();
    setPositions(result.positions);
    setBranchLabels(result.labels);
  }, [calculateHierarchicalPositions]);

  useEffect(() => {
    if (!focusMemberId || positions.length === 0 || !containerRef.current) return;
    
    const focusedPosition = positions.find(p => p.member.id === focusMemberId);
    if (!focusedPosition) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    const targetX = containerRect.width / 2 - (focusedPosition.x + nodeWidth / 2) * zoom;
    const targetY = containerRect.height / 2 - (focusedPosition.y + nodeHeight / 2) * zoom;
    
    setOffset({ x: targetX, y: targetY });
  }, [focusMemberId, positions, zoom, nodeWidth, nodeHeight]);

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

  const getCurvedPath = (fromX: number, fromY: number, toX: number, toY: number, type: 'vertical' | 'horizontal') => {
    if (type === 'vertical') {
      const midY = (fromY + toY) / 2;
      const controlOffset = Math.abs(toY - fromY) * 0.4;
      return `M ${fromX} ${fromY} C ${fromX} ${fromY + controlOffset}, ${toX} ${toY - controlOffset}, ${toX} ${toY}`;
    } else {
      const midX = (fromX + toX) / 2;
      return `M ${fromX} ${fromY} Q ${midX} ${fromY}, ${midX} ${(fromY + toY) / 2} Q ${midX} ${toY}, ${toX} ${toY}`;
    }
  };

  const getConnectionLines = () => {
    const lines: JSX.Element[] = [];
    const focusPos = positions.find(p => p.branchType === 'focus');
    if (!focusPos) return lines;

    // === PARENTS: Lines from each parent's BOTTOM to focus's TOP ===
    const parentPositions = positions.filter(p => p.branchType === 'parent');
    parentPositions.forEach(parentPos => {
      const fromX = parentPos.x + nodeWidth / 2;
      const fromY = parentPos.y + nodeHeight; // Bottom of parent
      const toX = focusPos.x + nodeWidth / 2;
      const toY = focusPos.y; // Top of focus
      
      lines.push(
        <path
          key={`parent-to-focus-${parentPos.member.id}`}
          d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
          stroke={BRANCH_COLORS.parent.line}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
      );
    });

    // === GRANDPARENTS: Lines from grandparent's BOTTOM to parent's TOP ===
    const grandparentPositions = positions.filter(p => p.branchType === 'grandparent');
    grandparentPositions.forEach(gpPos => {
      // Find which parent this grandparent connects to
      parentPositions.forEach(parentPos => {
        const { parentChildMap } = getRelationshipMaps();
        const gpChildren = parentChildMap.get(gpPos.member.id) || [];
        if (gpChildren.includes(parentPos.member.id)) {
          const fromX = gpPos.x + nodeWidth / 2;
          const fromY = gpPos.y + nodeHeight;
          const toX = parentPos.x + nodeWidth / 2;
          const toY = parentPos.y;
          
          lines.push(
            <path
              key={`grandparent-to-parent-${gpPos.member.id}-${parentPos.member.id}`}
              d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
              stroke={BRANCH_COLORS.grandparent.line}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
            />
          );
        }
      });
    });

    // === CHILDREN: Lines from focus's BOTTOM to each child's TOP ===
    const childPositions = positions.filter(p => p.branchType === 'child');
    childPositions.forEach(childPos => {
      const fromX = focusPos.x + nodeWidth / 2;
      const fromY = focusPos.y + nodeHeight; // Bottom of focus
      const toX = childPos.x + nodeWidth / 2;
      const toY = childPos.y; // Top of child
      
      lines.push(
        <path
          key={`focus-to-child-${childPos.member.id}`}
          d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
          stroke={BRANCH_COLORS.child.line}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
      );
    });

    // === GRANDCHILDREN: Lines from child's BOTTOM to grandchild's TOP ===
    const grandchildPositions = positions.filter(p => p.branchType === 'grandchild');
    grandchildPositions.forEach(gcPos => {
      // Find which child this grandchild connects to
      const { parentChildMap } = getRelationshipMaps();
      childPositions.forEach(childPos => {
        const childChildren = parentChildMap.get(childPos.member.id) || [];
        if (childChildren.includes(gcPos.member.id)) {
          const fromX = childPos.x + nodeWidth / 2;
          const fromY = childPos.y + nodeHeight;
          const toX = gcPos.x + nodeWidth / 2;
          const toY = gcPos.y;
          
          lines.push(
            <path
              key={`child-to-grandchild-${childPos.member.id}-${gcPos.member.id}`}
              d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
              stroke={BRANCH_COLORS.grandchild.line}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.7"
            />
          );
        }
      });
    });

    // === SIBLINGS: Horizontal lines from sibling's SIDE to focus's SIDE ===
    const siblingPositions = positions.filter(p => p.branchType === 'sibling');
    siblingPositions.forEach(sibPos => {
      const isLeftSibling = sibPos.x < focusPos.x;
      
      // Connect from sibling's edge toward focus
      const fromX = isLeftSibling ? sibPos.x + nodeWidth : sibPos.x; // Right or left edge
      const fromY = sibPos.y + nodeHeight / 2; // Middle height
      const toX = isLeftSibling ? focusPos.x : focusPos.x + nodeWidth; // Left or right edge of focus
      const toY = focusPos.y + nodeHeight / 2; // Middle height
      
      lines.push(
        <path
          key={`sibling-${sibPos.member.id}`}
          d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
          stroke={BRANCH_COLORS.sibling.line}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          strokeDasharray="6 4"
        />
      );
    });

    positions.forEach((pos) => {
      if (pos.branchType === 'spouse') {
        const focusPos = positions.find(p => p.branchType === 'focus');
        if (focusPos) {
          const fromX = focusPos.x + nodeWidth;
          const fromY = focusPos.y + nodeHeight / 2;
          const toX = pos.x;
          const toY = pos.y + nodeHeight / 2;
          
          lines.push(
            <path
              key={`spouse-${pos.member.id}`}
              d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
              stroke={BRANCH_COLORS.spouse.line}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
              className="transition-all duration-300"
            />
          );
          
          const markerX = (fromX + toX) / 2;
          const markerY = fromY;
          lines.push(
            <circle
              key={`spouse-marker-${pos.member.id}`}
              cx={markerX}
              cy={markerY}
              r="6"
              fill={BRANCH_COLORS.spouse.line}
              stroke="hsl(var(--background))"
              strokeWidth="2"
            />
          );
        }
      }
    });

    return lines;
  };

  // SVG dimensions - use the full extent to ensure lines align with cards
  const maxX = positions.length > 0 ? Math.max(...positions.map((p) => p.x)) + nodeWidth + 200 : 1000;
  const maxY = positions.length > 0 ? Math.max(...positions.map((p) => p.y)) + nodeHeight + 200 : 800;
  const svgWidth = maxX;
  const svgHeight = maxY;

  const getBranchStyles = (branchType: NodePosition['branchType']) => {
    const colors = BRANCH_COLORS[branchType];
    return colors;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* CRITICAL: transformOrigin MUST be "0 0" - NOT "center center"
          This ensures SVG connection lines align with HTML member cards.
          See replit.md "Family Tree Visualization" section for details.
          DO NOT CHANGE without testing on both desktop and mobile. */}
      <div
        className="relative"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
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
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {getConnectionLines()}
          
          {branchLabels.map((label, index) => (
            <g key={`label-${index}`}>
              <rect
                x={label.x - 40}
                y={label.y - 12}
                width="80"
                height="24"
                rx="12"
                fill={label.type === 'parent' ? BRANCH_COLORS.parent.line : 
                      label.type === 'sibling' ? BRANCH_COLORS.sibling.line : 
                      label.type === 'unconnected' ? BRANCH_COLORS.unconnected.line :
                      BRANCH_COLORS.child.line}
                opacity="0.9"
              />
              <text
                x={label.x}
                y={label.y + 5}
                textAnchor="middle"
                fill="hsl(var(--primary-foreground))"
                fontSize="12"
                fontWeight="600"
                className="select-none"
              >
                {label.text}
              </text>
            </g>
          ))}
        </svg>

        {positions.map((pos) => {
          const isFocusPerson = pos.branchType === 'focus';
          const styles = getBranchStyles(pos.branchType);
          
          return (
            <div
              key={pos.member.id}
              data-member-node
              className="absolute cursor-pointer transition-all duration-300 hover:z-10"
              style={{
                left: pos.x,
                top: pos.y,
                width: nodeWidth,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onMemberClick(pos.member);
              }}
              data-testid={`node-member-${pos.member.id}`}
            >
              <div 
                className={`relative rounded-md p-3 shadow-md hover-elevate transition-all duration-300 ${
                  pos.member.isUnknown 
                    ? 'bg-muted/50 border-2 border-dashed border-muted-foreground/40' 
                    : `bg-card border ${styles.border}`
                } ${
                  isFocusPerson ? 'ring-4 ring-primary/50 shadow-lg' : ''
                }`}
              >
                <div 
                  className={`absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${isFocusPerson ? 'bg-primary' : 'bg-muted-foreground'}`}
                />
                
                <div className="flex flex-col items-center text-center pt-2">
                  {pos.member.isUnknown ? (
                    <div className="h-14 w-14 mb-2 rounded-full bg-muted/70 flex items-center justify-center ring-2 ring-muted-foreground/30">
                      <HelpCircle className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                  ) : (
                    <Avatar className={`h-14 w-14 mb-2 ring-2 ${styles.ring} shadow-md`}>
                      <AvatarImage src={pos.member.photoUrl || undefined} />
                      <AvatarFallback className="font-serif text-lg bg-muted text-foreground">
                        {pos.member.firstName[0]}
                        {pos.member.lastName?.[0] || ""}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <h3 className={`font-semibold text-sm truncate w-full ${pos.member.isUnknown ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                    {pos.member.isUnknown ? (pos.member.unknownLabel || 'Unknown') : pos.member.firstName}
                  </h3>
                  {!pos.member.isUnknown && (
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {pos.member.lastName || ""}
                    </p>
                  )}
                  {pos.member.birthDate && !pos.member.isUnknown && (
                    <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                      {new Date(pos.member.birthDate).getFullYear()}
                      {pos.member.deathDate && ` - ${new Date(pos.member.deathDate).getFullYear()}`}
                    </p>
                  )}
                  
                  <div 
                    className={`mt-2 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider ${
                      pos.member.isUnknown ? 'bg-muted text-muted-foreground/70' :
                      pos.branchType === 'focus' ? 'bg-primary/20 text-primary' :
                      pos.branchType === 'spouse' ? 'bg-destructive/20 text-destructive' :
                      pos.branchType === 'child' || pos.branchType === 'grandchild' ? 'bg-primary/20 text-primary' :
                      pos.branchType === 'unconnected' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}
                  >
                    {pos.member.isUnknown ? 'placeholder' : 
                     pos.branchType === 'focus' ? 'You' : 
                     pos.branchType === 'unconnected' ? 'Add Relationship' : 
                     pos.branchType}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
