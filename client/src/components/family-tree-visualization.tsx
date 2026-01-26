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
  viewDepth?: 'immediate' | 'extended' | 'all';
}

type RelationshipQualifier = 'biological' | 'step' | 'adopted' | 'foster' | 'half' | 'in-law' | null;

interface NodePosition {
  x: number;
  y: number;
  member: FamilyMember;
  branchType: 'focus' | 'parent' | 'stepparent' | 'grandparent' | 'sibling' | 'child' | 'grandchild' | 'spouse' | 'coparent' | 'inlaw' | 'inlaw-grandparent' | 'unconnected';
  qualifier?: RelationshipQualifier;
}

interface BranchLabel {
  x: number;
  y: number;
  text: string;
  type: 'parent' | 'sibling' | 'child' | 'unconnected';
}

const BRANCH_COLORS = {
  parent: { line: 'hsl(var(--muted-foreground))', bg: 'bg-card/80 dark:bg-card/60', border: 'border-muted-foreground/30', ring: 'ring-muted-foreground/50', label: 'bg-muted-foreground' },
  stepparent: { line: 'hsl(200 60% 50%)', bg: 'bg-sky-100/50 dark:bg-sky-900/20', border: 'border-sky-300 dark:border-sky-700', ring: 'ring-sky-400/50', label: 'bg-sky-500' },
  grandparent: { line: 'hsl(var(--muted-foreground))', bg: 'bg-card/80 dark:bg-card/60', border: 'border-muted-foreground/30', ring: 'ring-muted-foreground/50', label: 'bg-muted-foreground' },
  sibling: { line: 'hsl(var(--accent-foreground))', bg: 'bg-accent/20 dark:bg-accent/10', border: 'border-accent/50', ring: 'ring-accent/50', label: 'bg-accent' },
  child: { line: 'hsl(var(--primary))', bg: 'bg-primary/10 dark:bg-primary/5', border: 'border-primary/30', ring: 'ring-primary/50', label: 'bg-primary' },
  grandchild: { line: 'hsl(var(--primary))', bg: 'bg-primary/10 dark:bg-primary/5', border: 'border-primary/30', ring: 'ring-primary/50', label: 'bg-primary' },
  spouse: { line: 'hsl(340 80% 60%)', bg: 'bg-pink-100/50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', ring: 'ring-pink-400/50', label: 'bg-pink-500' },
  coparent: { line: 'hsl(280 60% 50%)', bg: 'bg-purple-100/50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700', ring: 'ring-purple-400/50', label: 'bg-purple-500' },
  focus: { line: 'hsl(var(--primary))', bg: 'bg-primary/20 dark:bg-primary/10', border: 'border-primary', ring: 'ring-primary', label: 'bg-primary' },
  inlaw: { line: 'hsl(var(--muted-foreground))', bg: 'bg-accent/10 dark:bg-accent/5', border: 'border-accent/30', ring: 'ring-accent/30', label: 'bg-accent' },
  'inlaw-grandparent': { line: 'hsl(var(--muted-foreground))', bg: 'bg-accent/5 dark:bg-accent/5', border: 'border-accent/20', ring: 'ring-accent/20', label: 'bg-accent' },
  unconnected: { line: 'hsl(var(--muted-foreground))', bg: 'bg-muted/30 dark:bg-muted/20', border: 'border-muted-foreground/20', ring: 'ring-muted-foreground/30', label: 'bg-muted-foreground' },
};

export default function FamilyTreeVisualization({
  members,
  relationships,
  zoom,
  onMemberClick,
  focusMemberId,
  viewDepth = 'all',
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
    // Map to store qualifier for each relationship: key = "fromId-toId-type", value = qualifier
    const qualifierMap = new Map<string, RelationshipQualifier>();

    relationships.forEach((rel) => {
      const qualifier = (rel.qualifier as RelationshipQualifier) || null;
      
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
        
        // Store qualifier for parent->child relationship
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-parent`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-child`, qualifier);
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
        
        // Store qualifier
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-parent`, qualifier);
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-child`, qualifier);
      } else if (rel.relationshipType === "spouse") {
        if (!spouseMap.has(rel.fromMemberId)) {
          spouseMap.set(rel.fromMemberId, []);
        }
        spouseMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!spouseMap.has(rel.toMemberId)) {
          spouseMap.set(rel.toMemberId, []);
        }
        spouseMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        // Store qualifier for spouse
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-spouse`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-spouse`, qualifier);
      } else if (rel.relationshipType === "sibling") {
        if (!siblingMap.has(rel.fromMemberId)) {
          siblingMap.set(rel.fromMemberId, []);
        }
        siblingMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!siblingMap.has(rel.toMemberId)) {
          siblingMap.set(rel.toMemberId, []);
        }
        siblingMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        // Store qualifier for sibling
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-sibling`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-sibling`, qualifier);
      } else if (rel.relationshipType === "coparent") {
        // Co-parent is a bidirectional relationship (like spouse but not married)
        if (!spouseMap.has(rel.fromMemberId)) {
          spouseMap.set(rel.fromMemberId, []);
        }
        // We'll track co-parents separately using qualifier
        spouseMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!spouseMap.has(rel.toMemberId)) {
          spouseMap.set(rel.toMemberId, []);
        }
        spouseMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        // Mark as co-parent specifically
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-coparent`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-coparent`, qualifier);
      }
    });

    return { parentChildMap, childParentMap, spouseMap, siblingMap, qualifierMap };
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

    // PRE-IDENTIFY siblings to prevent them from being placed as grandparents or other roles
    const focusSiblings = new Set<string>(getSiblings(focusId, parentChildMap, childParentMap, siblingMap));
    focusSiblings.delete(focusId); // Remove focus from their own siblings list
    
    if (process.env.NODE_ENV === 'development') {
      const focusParents = childParentMap.get(focusId) || [];
      console.log('[Tree Viz] Focus ID:', focusId);
      console.log('[Tree Viz] Focus Parents:', focusParents);
      focusParents.forEach(pId => {
        const parentChildren = parentChildMap.get(pId) || [];
        console.log('[Tree Viz] Parent', pId, 'children:', parentChildren);
      });
      console.log('[Tree Viz] Detected Siblings:', Array.from(focusSiblings));
    }

    // View depth controls which generations to show:
    // 'immediate': only parents, spouse, children (1 generation each direction)
    // 'extended': includes grandparents, grandchildren, siblings (2 generations)
    // 'all': show everything including in-laws, great-grandparents, etc.
    const showGrandparents = viewDepth !== 'immediate';
    const showSiblings = viewDepth !== 'immediate';
    const showGrandchildren = viewDepth !== 'immediate';
    const showInlaws = viewDepth === 'all';

    const centerX = 400;
    const centerY = 400;

    positioned.push({ x: centerX, y: centerY, member: focusMember, branchType: 'focus' });
    placed.add(focusId);

    // Get focus person's parents first - they should NEVER be placed as spouses/co-parents
    const focusParentIds = new Set(childParentMap.get(focusId) || []);

    // Get explicitly defined spouses - but EXCLUDE focus person's parents!
    const spouses = (spouseMap.get(focusId) || []).filter(id => !focusParentIds.has(id));
    
    // Also find co-parents: other parents of focus person's children who aren't spouses
    // These are people who share a child with focus but weren't defined as spouse
    // EXCLUDE focus person's own parents - they can't be co-parents of their child
    const focusChildren = parentChildMap.get(focusId) || [];
    const coParentIds = new Set<string>();
    focusChildren.forEach(childId => {
      const childParents = childParentMap.get(childId) || [];
      childParents.forEach(parentId => {
        // Add if not the focus person, not already a defined spouse, and NOT focus's own parent
        if (parentId !== focusId && !spouses.includes(parentId) && !focusParentIds.has(parentId)) {
          coParentIds.add(parentId);
        }
      });
    });
    const coParents = Array.from(coParentIds);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Tree Viz] Spouses (explicit):', spouses);
      console.log('[Tree Viz] Co-Parents (inferred):', coParents);
    }
    
    const spousePositions: { x: number; y: number; spouseId: string }[] = [];
    const coParentPositions: { x: number; y: number; coParentId: string }[] = [];
    
    // Place explicit spouses first
    spouses.forEach((spouseId, index) => {
      const spouse = deduplicatedMembers.find(m => m.id === spouseId);
      if (spouse && !placed.has(spouseId)) {
        const spouseX = centerX + (nodeWidth + horizontalGap) * (index + 1);
        positioned.push({
          x: spouseX,
          y: centerY,
          member: spouse,
          branchType: 'spouse'
        });
        placed.add(spouseId);
        spousePositions.push({ x: spouseX, y: centerY, spouseId });
      }
    });
    
    // Place co-parents after spouses (with offset)
    const coParentStartOffset = spouses.length + 1;
    coParents.forEach((coParentId, index) => {
      const coParent = deduplicatedMembers.find(m => m.id === coParentId);
      if (coParent && !placed.has(coParentId)) {
        const cpX = centerX + (nodeWidth + horizontalGap) * (coParentStartOffset + index);
        positioned.push({
          x: cpX,
          y: centerY,
          member: coParent,
          branchType: 'coparent'
        });
        placed.add(coParentId);
        coParentPositions.push({ x: cpX, y: centerY, coParentId });
      }
    });
    
    // Show in-laws (spouse's parents) at the parent level on the spouse's side - only if viewDepth is 'all'
    if (showInlaws) {
      spousePositions.forEach(({ x: spouseX, spouseId }) => {
        const spouseParents = childParentMap.get(spouseId) || [];
        if (spouseParents.length > 0) {
          const inLawY = centerY - verticalGap - nodeHeight;
          const inLawStartX = spouseX - ((spouseParents.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
          
          spouseParents.forEach((inLawId, inLawIndex) => {
            const inLaw = deduplicatedMembers.find(m => m.id === inLawId);
            if (inLaw && !placed.has(inLawId)) {
              positioned.push({
                x: inLawStartX + inLawIndex * (nodeWidth + horizontalGap / 2),
                y: inLawY,
                member: inLaw,
                branchType: 'inlaw' // Use distinct type for in-laws (not 'parent')
              });
              placed.add(inLawId);
              
              // Also show in-law's parents (spouse's grandparents)
              const inLawGrandparents = childParentMap.get(inLawId) || [];
              if (inLawGrandparents.length > 0) {
                const ilGpY = inLawY - verticalGap - nodeHeight;
                const ilGpStartX = inLawStartX + inLawIndex * (nodeWidth + horizontalGap / 2) - ((inLawGrandparents.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
                
                inLawGrandparents.forEach((ilGpId, ilGpIndex) => {
                  const ilGp = deduplicatedMembers.find(m => m.id === ilGpId);
                  if (ilGp && !placed.has(ilGpId)) {
                    positioned.push({
                      x: ilGpStartX + ilGpIndex * (nodeWidth + horizontalGap / 2),
                      y: ilGpY,
                      member: ilGp,
                      branchType: 'inlaw-grandparent'
                    });
                    placed.add(ilGpId);
                  }
                });
              }
            }
          });
        }
      });
    }

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

          // Only show grandparents if viewDepth allows
          // IMPORTANT: Exclude siblings from being placed as grandparents
          if (showGrandparents) {
            const grandparents = (childParentMap.get(parentId) || []).filter(gpId => !focusSiblings.has(gpId));
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
          
          // Also show the parent's spouse at parent level
          // But check if they're actually the focus person's parent or just a step-parent
          const parentSpouses = spouseMap.get(parentId) || [];
          parentSpouses.forEach((psId) => {
            const ps = deduplicatedMembers.find(m => m.id === psId);
            if (ps && !placed.has(psId)) {
              // Check if this spouse is actually a parent of the focus person
              const isActualParent = parents.includes(psId);
              
              // Find position next to this parent
              const lastParentX = parentStartX + (parents.length - 1) * (nodeWidth + horizontalGap);
              positioned.push({
                x: lastParentX + (nodeWidth + horizontalGap),
                y: parentY,
                member: ps,
                // If they're in focus person's parent list, they're a parent. Otherwise, step-parent.
                branchType: isActualParent ? 'parent' : 'stepparent'
              });
              placed.add(psId);
              
              // Show co-parent's parents as grandparents too - only if showGrandparents
              // IMPORTANT: Exclude siblings from being placed as grandparents
              if (showGrandparents) {
                const coParentGrandparents = (childParentMap.get(psId) || []).filter(gpId => !focusSiblings.has(gpId));
                if (coParentGrandparents.length > 0) {
                  const cpGpY = parentY - verticalGap - nodeHeight;
                  const cpGpStartX = lastParentX + (nodeWidth + horizontalGap) - ((coParentGrandparents.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
                  
                  coParentGrandparents.forEach((cpGpId, cpGpIndex) => {
                    const cpGp = deduplicatedMembers.find(m => m.id === cpGpId);
                    if (cpGp && !placed.has(cpGpId)) {
                      positioned.push({
                        x: cpGpStartX + cpGpIndex * (nodeWidth + horizontalGap / 2),
                        y: cpGpY,
                        member: cpGp,
                        branchType: 'grandparent'
                      });
                      placed.add(cpGpId);
                    }
                  });
                }
              }
            }
          });
        }
      });
    }

    // Get siblings but ensure we exclude the focus member and anyone already placed - only if showSiblings
    // NEW LAYOUT: All siblings go to the LEFT of focus person
    // Spouse/partner stays on the RIGHT side (already positioned above)
    // This keeps blood relatives (parents→focus→children) on the main vertical line
    if (showSiblings) {
      const allSiblings = getSiblings(focusId, parentChildMap, childParentMap, siblingMap);
      const siblings = allSiblings.filter(sibId => sibId !== focusId && !placed.has(sibId));
      if (siblings.length > 0) {
        // Position all siblings to the LEFT of focus
        // This clearly separates blood relatives from spouse/partner
        labels.push({ x: centerX - (nodeWidth + horizontalGap) * ((siblings.length + 1) / 2), y: centerY - 30, text: 'Siblings', type: 'sibling' });
        
        siblings.forEach((sibId, index) => {
          const sib = deduplicatedMembers.find(m => m.id === sibId);
          if (sib && !placed.has(sibId)) {
            positioned.push({
              x: centerX - (nodeWidth + horizontalGap) * (index + 1),
              y: centerY,
              member: sib,
              branchType: 'sibling'
            });
            placed.add(sibId);
          }
        });
      }
    }

    // Get children but EXCLUDE siblings (someone can't be both a child and a sibling)
    const children = (parentChildMap.get(focusId) || []).filter(cId => !focusSiblings.has(cId));
    
    // For spouse's children, only include if BOTH focus AND spouse are parents
    // This prevents step-children from appearing as the focus person's children
    const sharedSpouseChildren: string[] = [];
    spouses.forEach(spouseId => {
      const spouseChildList = parentChildMap.get(spouseId) || [];
      spouseChildList.forEach(cId => {
        // Check if focus person is ALSO a parent of this child
        const childParents = childParentMap.get(cId) || [];
        const focusIsParent = childParents.includes(focusId);
        
        // Only include if focus is a parent AND not already listed AND not a sibling
        if (focusIsParent && !children.includes(cId) && !sharedSpouseChildren.includes(cId) && !focusSiblings.has(cId)) {
          sharedSpouseChildren.push(cId);
        }
      });
    });
    const allChildren = Array.from(new Set([...children, ...sharedSpouseChildren]));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Tree Viz] Focus:', focusId, 'Children:', children, 'SharedSpouseChildren:', sharedSpouseChildren, 'AllChildren:', allChildren);
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

          // Only show grandchildren if viewDepth allows
          if (showGrandchildren) {
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
  }, [deduplicatedMembers, relationships, focusMemberId, getRelationshipMaps, getSiblings, nodeWidth, nodeHeight, horizontalGap, verticalGap, viewDepth]);

  useEffect(() => {
    const result = calculateHierarchicalPositions();
    setPositions(result.positions);
    setBranchLabels(result.labels);
  }, [calculateHierarchicalPositions]);

  useEffect(() => {
    if (positions.length === 0 || !containerRef.current) return;
    
    // Find the focused position, or fall back to the focus branch, or first position
    let targetPosition = focusMemberId 
      ? positions.find(p => p.member.id === focusMemberId)
      : null;
    
    if (!targetPosition) {
      // Try to find the focus branch member (main person in tree)
      targetPosition = positions.find(p => p.branchType === 'focus');
    }
    
    if (!targetPosition && positions.length > 0) {
      // Fall back to first position to ensure tree is visible
      targetPosition = positions[0];
    }
    
    if (!targetPosition) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    const targetX = containerRect.width / 2 - (targetPosition.x + nodeWidth / 2) * zoom;
    const targetY = containerRect.height / 2 - (targetPosition.y + nodeHeight / 2) * zoom;
    
    setOffset({ x: targetX, y: targetY });
  }, [focusMemberId, positions, zoom, nodeWidth, nodeHeight, viewDepth]);

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

  // Touch handlers for mobile panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("[data-member-node]")) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault(); // Prevent page scrolling while panning
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
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

    // === STEP-PARENTS: Dashed line from parent to step-parent (horizontal connection at parent level) ===
    const stepparentPositions = positions.filter(p => p.branchType === 'stepparent');
    stepparentPositions.forEach(spPos => {
      // Find the parent this step-parent is married to
      const { spouseMap } = getRelationshipMaps();
      parentPositions.forEach(parentPos => {
        const parentSpouses = spouseMap.get(parentPos.member.id) || [];
        if (parentSpouses.includes(spPos.member.id)) {
          const fromX = parentPos.x + nodeWidth;
          const fromY = parentPos.y + nodeHeight / 2;
          const toX = spPos.x;
          const toY = spPos.y + nodeHeight / 2;
          
          lines.push(
            <path
              key={`parent-to-stepparent-${parentPos.member.id}-${spPos.member.id}`}
              d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
              stroke={BRANCH_COLORS.stepparent.line}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.7"
              strokeDasharray="6 4"
            />
          );
          
          // Marriage marker
          const markerX = (fromX + toX) / 2;
          const markerY = fromY;
          lines.push(
            <circle
              key={`stepparent-marker-${spPos.member.id}`}
              cx={markerX}
              cy={markerY}
              r="5"
              fill={BRANCH_COLORS.stepparent.line}
              stroke="hsl(var(--background))"
              strokeWidth="2"
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

    // === SIBLINGS: Connect siblings through shared parent OR to focus person ===
    // This shows proper family structure for siblings
    const siblingPositions = positions.filter(p => p.branchType === 'sibling');
    const { childParentMap } = getRelationshipMaps();
    
    siblingPositions.forEach(sibPos => {
      // Find shared parent(s) with focus
      const sibParents = childParentMap.get(sibPos.member.id) || [];
      const focusParents = childParentMap.get(focusPos.member.id) || [];
      const sharedParents = sibParents.filter(p => focusParents.includes(p));
      
      // Check if we can find a parent in the tree for this sibling
      let parentPos = null;
      
      if (sharedParents.length > 0) {
        // First priority: shared parent that's visible in tree
        parentPos = parentPositions.find(p => sharedParents.includes(p.member.id));
      }
      
      if (!parentPos && focusParents.length > 0) {
        // Second priority: use focus person's parent (siblings should share a parent)
        parentPos = parentPositions.find(p => focusParents.includes(p.member.id));
      }
      
      if (!parentPos && parentPositions.length > 0) {
        // Third priority: just use any visible parent (direct sibling relationships)
        parentPos = parentPositions[0];
      }
      
      if (parentPos) {
        // Connect sibling to parent with a curved line
        const fromX = parentPos.x + nodeWidth / 2;
        const fromY = parentPos.y + nodeHeight; // Bottom of parent
        const toX = sibPos.x + nodeWidth / 2;
        const toY = sibPos.y; // Top of sibling
        
        lines.push(
          <path
            key={`parent-to-sibling-${sibPos.member.id}`}
            d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
            stroke={BRANCH_COLORS.sibling.line}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
        );
      } else {
        // No parents visible - connect horizontally to focus as fallback
        const isLeftSibling = sibPos.x < focusPos.x;
        const fromX = isLeftSibling ? sibPos.x + nodeWidth : sibPos.x;
        const fromY = sibPos.y + nodeHeight / 2;
        const toX = isLeftSibling ? focusPos.x : focusPos.x + nodeWidth;
        const toY = focusPos.y + nodeHeight / 2;
        
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
      }
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
          
          // Connect spouse to their parents (in-laws) - shown at parent level
          const { childParentMap } = getRelationshipMaps();
          const spouseParents = childParentMap.get(pos.member.id) || [];
          spouseParents.forEach(spId => {
            const spParentPos = positions.find(p => p.member.id === spId);
            if (spParentPos) {
              const spFromX = pos.x + nodeWidth / 2;
              const spFromY = pos.y; // Top of spouse
              const spToX = spParentPos.x + nodeWidth / 2;
              const spToY = spParentPos.y + nodeHeight; // Bottom of in-law parent
              
              lines.push(
                <path
                  key={`spouse-to-inlaw-${pos.member.id}-${spId}`}
                  d={getCurvedPath(spToX, spToY, spFromX, spFromY, 'vertical')}
                  stroke={BRANCH_COLORS.inlaw.line}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.6"
                  strokeDasharray="4 2"
                />
              );
            }
          });
        }
      }
    });

    // === CO-PARENTS: Purple line from focus to co-parent (different from spouse) ===
    positions.forEach((pos) => {
      if (pos.branchType === 'coparent') {
        const focusPos = positions.find(p => p.branchType === 'focus');
        if (focusPos) {
          const fromX = focusPos.x + nodeWidth;
          const fromY = focusPos.y + nodeHeight / 2;
          const toX = pos.x;
          const toY = pos.y + nodeHeight / 2;
          
          lines.push(
            <path
              key={`coparent-${pos.member.id}`}
              d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
              stroke={BRANCH_COLORS.coparent.line}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
              strokeDasharray="6 4"
              className="transition-all duration-300"
            />
          );
          
          const markerX = (fromX + toX) / 2;
          const markerY = fromY;
          lines.push(
            <circle
              key={`coparent-marker-${pos.member.id}`}
              cx={markerX}
              cy={markerY}
              r="6"
              fill={BRANCH_COLORS.coparent.line}
              stroke="hsl(var(--background))"
              strokeWidth="2"
            />
          );
        }
      }
    });

    // === IN-LAW GRANDPARENTS: Lines from in-law grandparent to in-law ===
    const inlawGrandparentPositions = positions.filter(p => p.branchType === 'inlaw-grandparent');
    const inlawPositions = positions.filter(p => p.branchType === 'inlaw');
    inlawGrandparentPositions.forEach(ilGpPos => {
      const { childParentMap } = getRelationshipMaps();
      inlawPositions.forEach(inlawPos => {
        const inlawParents = childParentMap.get(inlawPos.member.id) || [];
        if (inlawParents.includes(ilGpPos.member.id)) {
          const fromX = ilGpPos.x + nodeWidth / 2;
          const fromY = ilGpPos.y + nodeHeight;
          const toX = inlawPos.x + nodeWidth / 2;
          const toY = inlawPos.y;
          
          lines.push(
            <path
              key={`inlaw-gp-to-inlaw-${ilGpPos.member.id}-${inlawPos.member.id}`}
              d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
              stroke={BRANCH_COLORS['inlaw-grandparent'].line}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
              strokeDasharray="4 2"
            />
          );
        }
      });
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
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
                      pos.branchType === 'spouse' ? 'bg-pink-500/20 text-pink-700 dark:text-pink-400' :
                      pos.branchType === 'coparent' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400' :
                      pos.branchType === 'stepparent' ? 'bg-sky-500/20 text-sky-700 dark:text-sky-400' :
                      pos.branchType === 'child' || pos.branchType === 'grandchild' ? 'bg-primary/20 text-primary' :
                      pos.branchType === 'unconnected' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}
                  >
                    {pos.member.isUnknown ? 'placeholder' : 
                     pos.branchType === 'focus' ? 'You' : 
                     pos.branchType === 'coparent' ? 'Co-Parent' :
                     pos.branchType === 'stepparent' ? 'Step-Parent' :
                     pos.branchType === 'unconnected' ? 'Add Relationship' : 
                     // Show qualifier prefix if set (e.g., "Adopted Parent", "Step-Child", "Half-Sibling")
                     pos.qualifier && pos.qualifier !== 'biological' ? 
                       `${pos.qualifier === 'half' ? 'Half-' : pos.qualifier === 'in-law' ? 'In-Law ' : pos.qualifier.charAt(0).toUpperCase() + pos.qualifier.slice(1) + ' '}${pos.branchType}` :
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
