import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HelpCircle, Cake, Gift } from "lucide-react";
import { parseDateString } from "@/lib/utils";
import type { FamilyMember, Relationship } from "@shared/schema";
import type { MemberUpcomingEvent } from "@/components/group-visualization";

interface FamilyTreeVisualizationProps {
  members: FamilyMember[];
  relationships: Relationship[];
  zoom: number;
  onMemberClick: (member: FamilyMember) => void;
  onConnectMember?: (member: FamilyMember) => void;
  focusMemberId?: string | null;
  viewDepth?: 'immediate' | 'extended' | 'all';
  upcomingEvents?: MemberUpcomingEvent[];
}

type RelationshipQualifier = 'biological' | 'step' | 'adopted' | 'foster' | 'half' | 'in-law' | null;

interface NodePosition {
  x: number;
  y: number;
  member: FamilyMember;
  branchType: 'focus' | 'parent' | 'stepparent' | 'grandparent' | 'greatgrandparent' | 'sibling' | 'child' | 'grandchild' | 'spouse' | 'coparent' | 'inlaw' | 'inlaw-grandparent' | 'auntuncle' | 'cousin' | 'unconnected';
  qualifier?: RelationshipQualifier;
  // For cousins: deterministically store which aunt/uncle they connect to
  parentAuntUncleId?: string;
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
  auntuncle: { line: 'hsl(45 80% 50%)', bg: 'bg-amber-100/50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', ring: 'ring-amber-400/50', label: 'bg-amber-500' },
  cousin: { line: 'hsl(160 60% 45%)', bg: 'bg-teal-100/50 dark:bg-teal-900/20', border: 'border-teal-300 dark:border-teal-700', ring: 'ring-teal-400/50', label: 'bg-teal-500' },
  greatgrandparent: { line: 'hsl(var(--muted-foreground))', bg: 'bg-card/70 dark:bg-card/50', border: 'border-muted-foreground/20', ring: 'ring-muted-foreground/40', label: 'bg-muted-foreground' },
  'inlaw-grandparent': { line: 'hsl(var(--muted-foreground))', bg: 'bg-accent/5 dark:bg-accent/5', border: 'border-accent/20', ring: 'ring-accent/20', label: 'bg-accent' },
  unconnected: { line: 'hsl(var(--muted-foreground))', bg: 'bg-muted/30 dark:bg-muted/20', border: 'border-muted-foreground/20', ring: 'ring-muted-foreground/30', label: 'bg-muted-foreground' },
};

export default function FamilyTreeVisualization({
  members,
  relationships,
  zoom,
  onMemberClick,
  onConnectMember,
  focusMemberId,
  viewDepth = 'all',
  upcomingEvents,
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

  const memberEventsMap = useMemo(() => {
    const map = new Map<string, MemberUpcomingEvent[]>();
    if (!upcomingEvents) return map;
    for (const evt of upcomingEvents) {
      if (!map.has(evt.memberId)) map.set(evt.memberId, []);
      map.get(evt.memberId)!.push(evt);
    }
    return map;
  }, [upcomingEvents]);

  const nodeWidth = 140;
  const nodeHeight = 160;
  const horizontalGap = 60;
  const verticalGap = 120;

  const getRelationshipMaps = useCallback(() => {
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string[]>();
    const spouseMap = new Map<string, string[]>();
    const coparentMap = new Map<string, string[]>();
    const siblingMap = new Map<string, string[]>();
    // Map to store qualifier for each relationship: key = "fromId-toId-type", value = qualifier
    const qualifierMap = new Map<string, RelationshipQualifier>();

    relationships.forEach((rel) => {
      const qualifier = (rel.qualifier as RelationshipQualifier) || null;
      
      if (rel.relationshipType === "parent" || rel.relationshipType === "parent-child") {
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
        if (!coparentMap.has(rel.fromMemberId)) {
          coparentMap.set(rel.fromMemberId, []);
        }
        coparentMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!coparentMap.has(rel.toMemberId)) {
          coparentMap.set(rel.toMemberId, []);
        }
        coparentMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-coparent`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-coparent`, qualifier);
      } else if (rel.relationshipType === "unknown") {
        if (!siblingMap.has(rel.fromMemberId)) {
          siblingMap.set(rel.fromMemberId, []);
        }
        siblingMap.get(rel.fromMemberId)!.push(rel.toMemberId);
        if (!siblingMap.has(rel.toMemberId)) {
          siblingMap.set(rel.toMemberId, []);
        }
        siblingMap.get(rel.toMemberId)!.push(rel.fromMemberId);
        
        qualifierMap.set(`${rel.fromMemberId}-${rel.toMemberId}-unknown`, qualifier);
        qualifierMap.set(`${rel.toMemberId}-${rel.fromMemberId}-unknown`, qualifier);
      }
    });

    return { parentChildMap, childParentMap, spouseMap, coparentMap, siblingMap, qualifierMap };
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

  const createPlaceholderParent = useCallback((childId: string, gender: 'male' | 'female', existingParents: FamilyMember[]): FamilyMember => {
    const label = gender === 'female' ? 'Unknown Mother' : 'Unknown Father';
    return {
      id: `placeholder-${gender}-${childId}`,
      treeId: '',
      firstName: label,
      lastName: null,
      gender,
      birthDate: null,
      deathDate: null,
      birthPlace: null,
      photoUrl: null,
      bio: null,
      suffix: null,
      isLiving: true,
      isUnknown: true,
      unknownLabel: label,
      claimedByUserId: null,
      createdAt: null,
      updatedAt: null,
    } as FamilyMember;
  }, []);

  const ensureTwoParents = useCallback((childId: string, knownParentIds: string[], allMembers: FamilyMember[]): FamilyMember[] => {
    const knownParents = knownParentIds
      .map(id => allMembers.find(m => m.id === id))
      .filter((m): m is FamilyMember => !!m);

    if (knownParents.length >= 2) return knownParents.slice(0, 2);

    const result: FamilyMember[] = [...knownParents];

    if (knownParents.length === 1) {
      const existingGender = knownParents[0].gender;
      const missingGender = existingGender === 'female' ? 'male' : 'female';
      result.push(createPlaceholderParent(childId, missingGender as 'male' | 'female', knownParents));
    } else {
      result.push(createPlaceholderParent(childId, 'male', []));
      result.push(createPlaceholderParent(childId, 'female', []));
    }

    const fatherIdx = result.findIndex(p => p.gender === 'male');
    const motherIdx = result.findIndex(p => p.gender === 'female');
    if (fatherIdx >= 0 && motherIdx >= 0 && fatherIdx > motherIdx) {
      [result[fatherIdx], result[motherIdx]] = [result[motherIdx], result[fatherIdx]];
    }

    return result;
  }, [createPlaceholderParent]);

  const calculateHierarchicalPositions = useCallback(() => {
    if (deduplicatedMembers.length === 0) return { positions: [], labels: [] };

    const positioned: NodePosition[] = [];
    const labels: BranchLabel[] = [];
    const placed = new Set<string>();

    const { parentChildMap, childParentMap, spouseMap, coparentMap, siblingMap, qualifierMap } = getRelationshipMaps();

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
    // 'extended': includes grandparents, grandchildren, siblings, great-grandparents (3 generations up)
    // 'all': show everything including in-laws, great-grandparents, etc.
    const showGrandparents = viewDepth !== 'immediate';
    const showGreatGrandparents = viewDepth !== 'immediate';
    const showSiblings = viewDepth !== 'immediate';
    const showGrandchildren = viewDepth !== 'immediate';
    const showInlaws = viewDepth === 'all';

    const centerX = 400;
    const centerY = 400;

    const placeAncestorsRecursively = (memberId: string, memberX: number, memberY: number, generation: number) => {
      const ancestorIds = (childParentMap.get(memberId) || []).filter(id => !placed.has(id));
      if (ancestorIds.length === 0) return;
      const ancestors = ensureTwoParents(memberId, ancestorIds, deduplicatedMembers).filter(a => !placed.has(a.id));
      if (ancestors.length === 0) return;
      const ancY = memberY - verticalGap - nodeHeight;
      const spacing = Math.max(nodeWidth + horizontalGap / 3, (nodeWidth + horizontalGap / 2) / Math.max(1, generation - 2));
      const ancStartX = memberX - ((ancestors.length - 1) * spacing) / 2;
      ancestors.forEach((anc, ancIndex) => {
        if (!placed.has(anc.id)) {
          const ancX = ancStartX + ancIndex * spacing;
          positioned.push({
            x: ancX,
            y: ancY,
            member: anc,
            branchType: 'greatgrandparent'
          });
          placed.add(anc.id);
          if (!anc.isUnknown) {
            placeAncestorsRecursively(anc.id, ancX, ancY, generation + 1);
          }
        }
      });
    };

    positioned.push({ x: centerX, y: centerY, member: focusMember, branchType: 'focus' });
    placed.add(focusId);

    // Get focus person's parents first - they should NEVER be placed as spouses/co-parents
    const focusParentIds = new Set(childParentMap.get(focusId) || []);

    // Get explicitly defined spouses - but EXCLUDE focus person's parents!
    const spouses = (spouseMap.get(focusId) || []).filter(id => !focusParentIds.has(id));
    
    // Get explicitly defined co-parents from the coparentMap
    const explicitCoParents = (coparentMap.get(focusId) || []).filter(id => !focusParentIds.has(id));
    
    // Also find co-parents: other parents of focus person's children who aren't spouses
    // These are people who share a child with focus but weren't defined as spouse
    // EXCLUDE focus person's own parents - they can't be co-parents of their child
    // EXCLUDE focus person's siblings - siblings share parents with focus, not children
    const focusChildren = parentChildMap.get(focusId) || [];
    const coParentIds = new Set<string>(explicitCoParents); // Start with explicit co-parents
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Tree Viz] Focus Children:', focusChildren);
      console.log('[Tree Viz] Focus Parent IDs:', Array.from(focusParentIds));
      console.log('[Tree Viz] Explicit Co-Parents from coparentMap:', explicitCoParents);
    }
    
    focusChildren.forEach(childId => {
      const childParents = childParentMap.get(childId) || [];
      if (process.env.NODE_ENV === 'development') {
        console.log('[Tree Viz] Child', childId, 'has parents:', childParents);
      }
      childParents.forEach(parentId => {
        // Add if not the focus person, not already a defined spouse, 
        // NOT focus's own parent, and NOT a sibling of focus
        const isFocusParent = focusParentIds.has(parentId);
        const isFocusSibling = focusSiblings.has(parentId);
        if (parentId !== focusId && !spouses.includes(parentId) && !isFocusParent && !isFocusSibling) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Tree Viz] Adding co-parent:', parentId, 'from child:', childId);
          }
          coParentIds.add(parentId);
        } else if (process.env.NODE_ENV === 'development' && parentId !== focusId) {
          console.log('[Tree Viz] EXCLUDING as co-parent:', parentId, 
            '- isSpouse:', spouses.includes(parentId),
            '- isFocusParent:', isFocusParent,
            '- isFocusSibling:', isFocusSibling);
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

    const parentIds = childParentMap.get(focusId) || [];
    const parents = ensureTwoParents(focusId, parentIds, deduplicatedMembers);
    
    // Collect all grandparent IDs upfront (for cousin filtering later)
    const allGrandparentIds = new Set<string>();
    parentIds.forEach(parentId => {
      const gps = childParentMap.get(parentId) || [];
      gps.forEach(gpId => allGrandparentIds.add(gpId));
    });
    
    {
      const parentY = centerY - verticalGap - nodeHeight;
      const parentStartX = centerX - ((parents.length - 1) * (nodeWidth + horizontalGap)) / 2;
      
      labels.push({ x: centerX, y: parentY + nodeHeight + 40, text: 'Parents', type: 'parent' });
      
      parents.forEach((parent, index) => {
        if (!placed.has(parent.id)) {
          positioned.push({
            x: parentStartX + index * (nodeWidth + horizontalGap),
            y: parentY,
            member: parent,
            branchType: 'parent'
          });
          placed.add(parent.id);

          if (!parent.isUnknown && showGrandparents) {
            const grandparentIds = (childParentMap.get(parent.id) || []).filter(gpId => !focusSiblings.has(gpId));
            const grandparentsForParent = ensureTwoParents(parent.id, grandparentIds, deduplicatedMembers);
            const gpY = parentY - verticalGap - nodeHeight;
            const gpStartX = parentStartX + index * (nodeWidth + horizontalGap) - ((grandparentsForParent.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
            
            grandparentsForParent.forEach((gp, gpIndex) => {
              if (!placed.has(gp.id)) {
                const gpX = gpStartX + gpIndex * (nodeWidth + horizontalGap / 2);
                positioned.push({
                  x: gpX,
                  y: gpY,
                  member: gp,
                  branchType: 'grandparent'
                });
                placed.add(gp.id);
                
                if (!gp.isUnknown && showGreatGrandparents) {
                  placeAncestorsRecursively(gp.id, gpX, gpY, 3);
                }
              }
            });
          }
          
          if (!parent.isUnknown && showGrandparents) {
            const parentSiblings = getSiblings(parent.id, parentChildMap, childParentMap, siblingMap);
            // Position them to the side of this parent at parent level
            if (parentSiblings.length > 0) {
              // Position aunts/uncles to the LEFT of the parent area
              const auntUncleY = parentY;
              const auntUncleStartX = parentStartX - (parentSiblings.length) * (nodeWidth + horizontalGap / 2);
              
              parentSiblings.forEach((auId, auIndex) => {
                const auntUncle = deduplicatedMembers.find(m => m.id === auId);
                if (auntUncle && !placed.has(auId)) {
                  const auX = auntUncleStartX + auIndex * (nodeWidth + horizontalGap / 2);
                  positioned.push({
                    x: auX,
                    y: auntUncleY,
                    member: auntUncle,
                    branchType: 'auntuncle'
                  });
                  placed.add(auId);
                  
                  // Show cousins (children of this aunt/uncle) - only in 'all' view
                  // Store mapping of cousin to their displaying parent for connection lines
                  if (viewDepth === 'all') {
                    const auntUncleChildren = parentChildMap.get(auId) || [];
                    // Allowed qualifiers for cousin relationships (positive allowlist)
                    const allowedCousinQualifiers = new Set(['biological', 'adopted', 'half', null, undefined]);
                    
                    // Filter out invalid cousin candidates with qualifier-aware logic using allowlist
                    const validCousins = auntUncleChildren.filter(cousinId => {
                      if (placed.has(cousinId)) return false;
                      if (cousinId === focusMemberId) return false;
                      if (focusSiblings.has(cousinId)) return false;
                      if (parentIds.includes(cousinId)) return false;
                      // Exclude anyone who is a grandparent of the focus person
                      if (allGrandparentIds.has(cousinId)) return false;
                      // Exclude spouses/co-parents of focus person
                      const focusSpouses = focusId ? (spouseMap.get(focusId) || []) : [];
                      if (focusSpouses.includes(cousinId)) return false;
                      
                      // Qualifier-aware filtering using ALLOWLIST approach
                      // Only include biological, adopted, half, or unspecified relationships
                      const parentChildQualifier = qualifierMap.get(`${auId}-${cousinId}-parent`);
                      if (!allowedCousinQualifiers.has(parentChildQualifier)) {
                        return false; // Excludes step, foster, in-law, and any other non-allowed qualifiers
                      }
                      return true;
                    });
                    
                    if (validCousins.length > 0) {
                      const cousinY = centerY; // Same level as focus person
                      const cousinStartX = auX - ((validCousins.length - 1) * (nodeWidth / 2 + 10)) / 2;
                      
                      validCousins.forEach((cousinId, cousinIndex) => {
                        const cousin = deduplicatedMembers.find(m => m.id === cousinId);
                        if (cousin && !placed.has(cousinId)) {
                          positioned.push({
                            x: cousinStartX + cousinIndex * (nodeWidth / 2 + 10),
                            y: cousinY,
                            member: cousin,
                            branchType: 'cousin',
                            // Deterministically store which aunt/uncle this cousin connects to
                            parentAuntUncleId: auId
                          });
                          placed.add(cousinId);
                        }
                      });
                    }
                  }
                }
              });
            }
          }
          
          if (!parent.isUnknown) {
            const parentSpouses = spouseMap.get(parent.id) || [];
            parentSpouses.forEach((psId) => {
              const ps = deduplicatedMembers.find(m => m.id === psId);
              if (ps && !placed.has(psId)) {
                const isActualParent = parentIds.includes(psId);
                
                const lastParentX = parentStartX + (parents.length - 1) * (nodeWidth + horizontalGap);
                positioned.push({
                  x: lastParentX + (nodeWidth + horizontalGap),
                  y: parentY,
                  member: ps,
                  branchType: isActualParent ? 'parent' : 'stepparent'
                });
                placed.add(psId);
                
                if (showGrandparents) {
                  const coParentGrandparents = (childParentMap.get(psId) || []).filter(gpId => !focusSiblings.has(gpId));
                  if (coParentGrandparents.length > 0) {
                    const cpGpY = parentY - verticalGap - nodeHeight;
                    const cpGpStartX = lastParentX + (nodeWidth + horizontalGap) - ((coParentGrandparents.length - 1) * (nodeWidth + horizontalGap / 2)) / 2;
                    
                    coParentGrandparents.forEach((cpGpId, cpGpIndex) => {
                      const cpGp = deduplicatedMembers.find(m => m.id === cpGpId);
                      if (cpGp && !placed.has(cpGpId)) {
                        const cpGpX = cpGpStartX + cpGpIndex * (nodeWidth + horizontalGap / 2);
                        positioned.push({
                          x: cpGpX,
                          y: cpGpY,
                          member: cpGp,
                          branchType: 'grandparent'
                        });
                        placed.add(cpGpId);
                        
                        if (showGreatGrandparents) {
                          placeAncestorsRecursively(cpGpId, cpGpX, cpGpY, 3);
                        }
                      }
                    });
                  }
                }
              }
            });
          }
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

    const unconnectedMembers = deduplicatedMembers.filter(m => !placed.has(m.id));
    if (unconnectedMembers.length > 0) {
      const sectionStartY = positioned.length > 0
        ? Math.max(...positioned.map(p => p.y)) + nodeHeight + verticalGap
        : centerY;

      const { parentChildMap, childParentMap, spouseMap } = getRelationshipMaps();
      const unconnectedIds = new Set(unconnectedMembers.map(m => m.id));

      const visited = new Set<string>();
      const clusters: FamilyMember[][] = [];
      for (const member of unconnectedMembers) {
        if (visited.has(member.id)) continue;
        const cluster: FamilyMember[] = [];
        const queue = [member.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);
          const m = unconnectedMembers.find(um => um.id === current);
          if (m) cluster.push(m);
          const neighbors = [
            ...(parentChildMap.get(current) || []),
            ...(childParentMap.get(current) || []),
            ...(spouseMap.get(current) || []),
          ];
          for (const n of neighbors) {
            if (unconnectedIds.has(n) && !visited.has(n)) queue.push(n);
          }
        }
        if (cluster.length > 0) clusters.push(cluster);
      }

      labels.push({ x: centerX, y: sectionStartY - 40, text: 'No Relationship Defined', type: 'unconnected' });

      let clusterOffsetY = sectionStartY;
      const isolatedMembers: FamilyMember[] = [];

      for (const cluster of clusters) {
        if (cluster.length === 1) {
          isolatedMembers.push(cluster[0]);
          continue;
        }

        const clusterRoots = cluster.filter(m => {
          const parents = childParentMap.get(m.id) || [];
          return !parents.some(pid => unconnectedIds.has(pid));
        });
        const roots = clusterRoots.length > 0 ? clusterRoots : [cluster[0]];

        const layers: FamilyMember[][] = [];
        const clusterPlaced = new Set<string>();

        let currentLayer = roots;
        while (currentLayer.length > 0) {
          const layerWithSpouses: FamilyMember[] = [];
          for (const m of currentLayer) {
            if (clusterPlaced.has(m.id)) continue;
            layerWithSpouses.push(m);
            clusterPlaced.add(m.id);
            const spouses = (spouseMap.get(m.id) || []).filter(sid => unconnectedIds.has(sid) && !clusterPlaced.has(sid));
            for (const sid of spouses) {
              const sp = cluster.find(c => c.id === sid);
              if (sp) { layerWithSpouses.push(sp); clusterPlaced.add(sp.id); }
            }
          }
          if (layerWithSpouses.length > 0) layers.push(layerWithSpouses);
          const nextLayer: FamilyMember[] = [];
          for (const m of currentLayer) {
            const children = (parentChildMap.get(m.id) || []).filter(cid => unconnectedIds.has(cid) && !clusterPlaced.has(cid));
            for (const cid of children) {
              const child = cluster.find(c => c.id === cid);
              if (child) nextLayer.push(child);
            }
          }
          currentLayer = nextLayer;
        }

        const unplacedInCluster = cluster.filter(m => !clusterPlaced.has(m.id));
        if (unplacedInCluster.length > 0) layers.push(unplacedInCluster);

        const maxLayerWidth = Math.max(...layers.map(l => l.length));
        const clusterWidth = maxLayerWidth * (nodeWidth + horizontalGap);
        const clusterStartX = centerX - clusterWidth / 2;

        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
          const layer = layers[layerIdx];
          const layerStartX = centerX - ((layer.length - 1) * (nodeWidth + horizontalGap)) / 2;
          for (let i = 0; i < layer.length; i++) {
            positioned.push({
              x: layerStartX + i * (nodeWidth + horizontalGap),
              y: clusterOffsetY + layerIdx * (nodeHeight + verticalGap),
              member: layer[i],
              branchType: 'unconnected',
            });
            placed.add(layer[i].id);
          }
        }
        clusterOffsetY += layers.length * (nodeHeight + verticalGap) + verticalGap / 2;
      }

      if (isolatedMembers.length > 0) {
        const columnsPerRow = Math.min(isolatedMembers.length, 5);
        const gridStartX = centerX - ((columnsPerRow - 1) * (nodeWidth + horizontalGap / 2)) / 2;
        isolatedMembers.forEach((member, idx) => {
          const col = idx % columnsPerRow;
          const row = Math.floor(idx / columnsPerRow);
          positioned.push({
            x: gridStartX + col * (nodeWidth + horizontalGap / 2),
            y: clusterOffsetY + row * (nodeHeight + verticalGap / 2),
            member,
            branchType: 'unconnected',
          });
          placed.add(member.id);
        });
      }
    }

    return { positions: positioned, labels };
  }, [deduplicatedMembers, relationships, focusMemberId, getRelationshipMaps, getSiblings, ensureTwoParents, nodeWidth, nodeHeight, horizontalGap, verticalGap, viewDepth]);

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
    if (positions.length === 0) return lines;

    const posMap = new Map(positions.map(p => [p.member.id, p]));
    const drawnPairs = new Set<string>();
    const SYMMETRIC_TYPES = new Set(["spouse", "sibling", "coparent"]);

    for (const rel of relationships) {
      const fromPos = posMap.get(rel.fromMemberId);
      const toPos = posMap.get(rel.toMemberId);
      if (!fromPos || !toPos) continue;

      const isParentType = rel.relationshipType === "parent" || rel.relationshipType === "parent-child";
      const isChildType = rel.relationshipType === "child";
      const isSpouseType = rel.relationshipType === "spouse";
      const isCoparentType = rel.relationshipType === "coparent";
      const isSiblingType = rel.relationshipType === "sibling";

      const pairKey = (SYMMETRIC_TYPES.has(rel.relationshipType))
        ? [rel.fromMemberId, rel.toMemberId].sort().join(':')
        : (isParentType || isChildType)
          ? [rel.fromMemberId, rel.toMemberId].sort().join(':parent:')
          : `${rel.fromMemberId}->${rel.toMemberId}`;
      if (drawnPairs.has(pairKey)) continue;
      drawnPairs.add(pairKey);

      if (isSpouseType || isCoparentType) {
        const leftPos = fromPos.x <= toPos.x ? fromPos : toPos;
        const rightPos = fromPos.x <= toPos.x ? toPos : fromPos;
        const fromX = leftPos.x + nodeWidth;
        const fromY = leftPos.y + nodeHeight / 2;
        const toX = rightPos.x;
        const toY = rightPos.y + nodeHeight / 2;
        const color = isSpouseType ? BRANCH_COLORS.spouse.line : BRANCH_COLORS.coparent.line;

        lines.push(
          <path
            key={`rel-${rel.id}`}
            d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            opacity="0.8"
            strokeDasharray={isCoparentType ? "6 4" : undefined}
          />
        );
        const markerX = (fromX + toX) / 2;
        const markerY = (fromY + toY) / 2;
        lines.push(
          <circle
            key={`rel-marker-${rel.id}`}
            cx={markerX}
            cy={markerY}
            r="5"
            fill={color}
            stroke="hsl(var(--background))"
            strokeWidth="2"
          />
        );
      } else if (isParentType || isChildType) {
        const parentPos = isChildType ? toPos : fromPos;
        const childPos = isChildType ? fromPos : toPos;
        const fromX = parentPos.x + nodeWidth / 2;
        const fromY = parentPos.y + nodeHeight;
        const toX2 = childPos.x + nodeWidth / 2;
        const toY2 = childPos.y;

        const parentBranch = parentPos.branchType;
        const childBranch = childPos.branchType;
        const isPlaceholder = parentPos.member.isUnknown;

        let strokeColor = BRANCH_COLORS.parent.line;
        let strokeWidth = "2.5";
        let opacity = "0.7";

        if (parentBranch === 'grandparent' || childBranch === 'parent') {
          strokeColor = BRANCH_COLORS.grandparent.line;
          strokeWidth = "2";
          opacity = "0.6";
        }
        if (parentBranch === 'greatgrandparent') {
          strokeColor = BRANCH_COLORS.greatgrandparent.line;
          strokeWidth = "1.5";
          opacity = "0.5";
        }
        if (parentBranch === 'parent' && childBranch === 'focus') {
          strokeColor = BRANCH_COLORS.parent.line;
          strokeWidth = "3";
          opacity = "0.8";
        }
        if (parentBranch === 'focus' || parentBranch === 'spouse' || parentBranch === 'coparent') {
          strokeColor = BRANCH_COLORS.child.line;
          strokeWidth = "3";
          opacity = "0.8";
        }
        if (childBranch === 'grandchild') {
          strokeColor = BRANCH_COLORS.grandchild.line;
          strokeWidth = "2";
          opacity = "0.7";
        }
        if (parentBranch === 'inlaw-grandparent' || childBranch === 'inlaw') {
          strokeColor = BRANCH_COLORS['inlaw-grandparent'].line;
          strokeWidth = "2";
          opacity = "0.5";
        }
        if (childBranch === 'auntuncle') {
          strokeColor = BRANCH_COLORS.auntuncle.line;
          strokeWidth = "2";
          opacity = "0.6";
        }
        if (childBranch === 'cousin') {
          strokeColor = BRANCH_COLORS.cousin.line;
          strokeWidth = "2";
          opacity = "0.6";
        }
        if (childBranch === 'sibling') {
          strokeColor = BRANCH_COLORS.sibling.line;
          strokeWidth = "2";
          opacity = "0.6";
        }

        lines.push(
          <path
            key={`rel-${rel.id}`}
            d={getCurvedPath(fromX, fromY, toX2, toY2, 'vertical')}
            stroke={strokeColor}
            strokeWidth={isPlaceholder ? "2" : strokeWidth}
            fill="none"
            strokeLinecap="round"
            opacity={isPlaceholder ? "0.4" : opacity}
            strokeDasharray={isPlaceholder ? "6 4" : undefined}
          />
        );
      } else if (isSiblingType) {
        const leftPos = fromPos.x <= toPos.x ? fromPos : toPos;
        const rightPos = fromPos.x <= toPos.x ? toPos : fromPos;
        const fromX = leftPos.x + nodeWidth;
        const fromY = leftPos.y + nodeHeight / 2;
        const toX = rightPos.x;
        const toY = rightPos.y + nodeHeight / 2;

        lines.push(
          <path
            key={`rel-${rel.id}`}
            d={`M ${fromX} ${fromY} L ${toX} ${toY}`}
            stroke={BRANCH_COLORS.sibling.line}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.5"
            strokeDasharray="6 4"
          />
        );
      } else {
        const leftPos = fromPos.x <= toPos.x ? fromPos : toPos;
        const rightPos = fromPos.x <= toPos.x ? toPos : fromPos;
        const x1 = leftPos.x + nodeWidth;
        const y1 = leftPos.y + nodeHeight / 2;
        const x2 = rightPos.x;
        const y2 = rightPos.y + nodeHeight / 2;

        lines.push(
          <path
            key={`rel-${rel.id}`}
            d={`M ${x1} ${y1} L ${x2} ${y2}`}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.4"
            strokeDasharray="4 4"
          />
        );
      }
    }

    positions.forEach(pos => {
      if (!pos.member.isUnknown || !pos.member.id.startsWith('placeholder-')) return;
      const parts = pos.member.id.split('-');
      const childId = parts.slice(2).join('-');
      const childPos = posMap.get(childId);
      if (!childPos) return;

      const pairKey = `${pos.member.id}->${childId}`;
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);

      const fromX = pos.x + nodeWidth / 2;
      const fromY = pos.y + nodeHeight;
      const toX = childPos.x + nodeWidth / 2;
      const toY = childPos.y;

      let strokeColor = BRANCH_COLORS.parent.line;
      if (pos.branchType === 'grandparent') strokeColor = BRANCH_COLORS.grandparent.line;
      if (pos.branchType === 'greatgrandparent') strokeColor = BRANCH_COLORS.greatgrandparent.line;

      lines.push(
        <path
          key={`placeholder-line-${pos.member.id}`}
          d={getCurvedPath(fromX, fromY, toX, toY, 'vertical')}
          stroke={strokeColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.4"
          strokeDasharray="6 4"
        />
      );
    });

    return lines;
  };

  const minX = positions.length > 0 ? Math.min(...positions.map((p) => p.x)) - 100 : 0;
  const minY = positions.length > 0 ? Math.min(...positions.map((p) => p.y)) - 100 : 0;
  const maxX = positions.length > 0 ? Math.max(...positions.map((p) => p.x)) + nodeWidth + 200 : 1000;
  const maxY = positions.length > 0 ? Math.max(...positions.map((p) => p.y)) + nodeHeight + 200 : 800;
  const svgWidth = maxX - Math.min(minX, 0);
  const svgHeight = maxY - Math.min(minY, 0);

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
          
          {branchLabels.map((label, index) => {
            const labelWidth = Math.max(80, label.text.length * 8 + 24);
            return (
              <g key={`label-${index}`}>
                <rect
                  x={label.x - labelWidth / 2}
                  y={label.y - 12}
                  width={labelWidth}
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
            );
          })}
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
                if (!pos.member.isUnknown) {
                  onMemberClick(pos.member);
                }
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
                    {pos.member.suffix && ` ${pos.member.suffix}`}
                  </h3>
                  {!pos.member.isUnknown && (
                    <p className="text-xs text-muted-foreground truncate w-full">
                      {pos.member.lastName || ""}
                    </p>
                  )}
                  {pos.member.birthDate && !pos.member.isUnknown && (
                    <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
                      {parseDateString(pos.member.birthDate)?.getFullYear()}
                      {pos.member.deathDate && ` - ${parseDateString(pos.member.deathDate)?.getFullYear()}`}
                    </p>
                  )}
                  
                  <div 
                    className={`mt-2 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider ${
                      pos.member.isUnknown ? 'bg-muted text-muted-foreground/70' :
                      pos.branchType === 'focus' ? 'bg-primary/20 text-primary' :
                      pos.branchType === 'spouse' ? 'bg-pink-500/20 text-pink-700 dark:text-pink-400' :
                      pos.branchType === 'coparent' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400' :
                      pos.branchType === 'auntuncle' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                      pos.branchType === 'cousin' ? 'bg-teal-500/20 text-teal-700 dark:text-teal-400' :
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
                     pos.branchType === 'auntuncle' ? (pos.member.gender === 'female' ? 'Aunt' : pos.member.gender === 'male' ? 'Uncle' : 'Aunt/Uncle') :
                     pos.branchType === 'cousin' ? 'Cousin' :
                     pos.branchType === 'unconnected' ? 'Not Connected' : 
                     // Show qualifier prefix if set (e.g., "Adopted Parent", "Step-Child", "Half-Sibling")
                     pos.qualifier && pos.qualifier !== 'biological' ? 
                       `${pos.qualifier === 'half' ? 'Half-' : pos.qualifier === 'in-law' ? 'In-Law ' : pos.qualifier.charAt(0).toUpperCase() + pos.qualifier.slice(1) + ' '}${pos.branchType}` :
                     pos.branchType}
                  </div>
                  {pos.branchType === 'unconnected' && onConnectMember && (
                    <button
                      className="mt-1 px-3 py-1 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectMember(pos.member);
                      }}
                      data-testid={`button-connect-member-${pos.member.id}`}
                    >
                      Connect to Tree
                    </button>
                  )}
                </div>
                {(() => {
                  const events = memberEventsMap.get(pos.member.id) || [];
                  const bdEvt = events.find(e => e.type === "birthday");
                  const regEvt = events.find(e => e.type === "registry");
                  if (!bdEvt && !regEvt) return null;
                  return (
                    <div className="absolute -bottom-2 right-1 flex gap-0.5" data-testid={`event-indicators-${pos.member.id}`}>
                      {bdEvt && (
                        <div
                          className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-white text-[9px] font-semibold shadow-md"
                          style={{ backgroundColor: "#e8594f" }}
                          title={bdEvt.label}
                          data-testid={`birthday-badge-${pos.member.id}`}
                        >
                          <Cake className="h-2.5 w-2.5" />
                          {bdEvt.daysUntil != null && (
                            <span>{bdEvt.daysUntil === 0 ? "Today!" : `${bdEvt.daysUntil}d`}</span>
                          )}
                        </div>
                      )}
                      {regEvt && (
                        <div
                          className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-white text-[9px] font-semibold shadow-md"
                          style={{ backgroundColor: "#8b5cf6" }}
                          title={regEvt.label}
                          data-testid={`registry-badge-${pos.member.id}`}
                        >
                          <Gift className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
