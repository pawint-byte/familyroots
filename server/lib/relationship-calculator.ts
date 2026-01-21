import type { FamilyMember, Relationship } from "@shared/schema";

export interface RelationshipResult {
  relationshipName: string;
  path: string[];
  commonAncestors: string[];
  generationsFromA: number;
  generationsFromB: number;
  isDirectLine: boolean;
}

interface FamilyGraph {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  spouses: Map<string, string[]>;
  siblings: Map<string, string[]>;
}

function buildFamilyGraph(relationships: Relationship[]): FamilyGraph {
  const graph: FamilyGraph = {
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
    siblings: new Map(),
  };

  for (const rel of relationships) {
    const from = rel.fromMemberId;
    const to = rel.toMemberId;

    switch (rel.relationshipType) {
      case "parent":
        if (!graph.parents.has(to)) graph.parents.set(to, []);
        graph.parents.get(to)!.push(from);
        if (!graph.children.has(from)) graph.children.set(from, []);
        graph.children.get(from)!.push(to);
        break;
      case "child":
        if (!graph.children.has(from)) graph.children.set(from, []);
        graph.children.get(from)!.push(to);
        if (!graph.parents.has(to)) graph.parents.set(to, []);
        graph.parents.get(to)!.push(from);
        break;
      case "spouse":
        if (!graph.spouses.has(from)) graph.spouses.set(from, []);
        graph.spouses.get(from)!.push(to);
        if (!graph.spouses.has(to)) graph.spouses.set(to, []);
        graph.spouses.get(to)!.push(from);
        break;
      case "sibling":
        if (!graph.siblings.has(from)) graph.siblings.set(from, []);
        graph.siblings.get(from)!.push(to);
        if (!graph.siblings.has(to)) graph.siblings.set(to, []);
        graph.siblings.get(to)!.push(from);
        break;
    }
  }

  return graph;
}

function getAncestors(memberId: string, graph: FamilyGraph): Map<string, number> {
  const ancestors = new Map<string, number>();
  const queue: Array<{ id: string; generation: number }> = [{ id: memberId, generation: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, generation } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ancestors.set(id, generation);

    const parents = graph.parents.get(id) || [];
    for (const parent of parents) {
      if (!visited.has(parent)) {
        queue.push({ id: parent, generation: generation + 1 });
      }
    }
  }

  return ancestors;
}

function findCommonAncestors(
  ancestorsA: Map<string, number>,
  ancestorsB: Map<string, number>
): Array<{ id: string; genFromA: number; genFromB: number }> {
  const common: Array<{ id: string; genFromA: number; genFromB: number }> = [];

  ancestorsA.forEach((genFromA, id) => {
    if (ancestorsB.has(id)) {
      common.push({
        id,
        genFromA,
        genFromB: ancestorsB.get(id)!,
      });
    }
  });

  common.sort((a, b) => (a.genFromA + a.genFromB) - (b.genFromA + b.genFromB));
  return common;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getGreatPrefix(generations: number): string {
  if (generations <= 2) return "";
  if (generations === 3) return "great-";
  const greats = generations - 2;
  if (greats === 1) return "great-";
  return `${getOrdinalSuffix(greats)} great-`;
}

function calculateRelationshipName(
  genFromA: number,
  genFromB: number,
  memberA: FamilyMember,
  memberB: FamilyMember,
  graph: FamilyGraph
): string {
  const genderB = memberB.gender || "other";

  if (genFromA === 0 && genFromB === 0) {
    return "self";
  }

  const spousesOfA = graph.spouses.get(memberA.id) || [];
  if (spousesOfA.includes(memberB.id)) {
    return genderB === "male" ? "husband" : genderB === "female" ? "wife" : "spouse";
  }

  const siblingsOfA = graph.siblings.get(memberA.id) || [];
  if (siblingsOfA.includes(memberB.id)) {
    return genderB === "male" ? "brother" : genderB === "female" ? "sister" : "sibling";
  }

  if (genFromA === 0 && genFromB > 0) {
    if (genFromB === 1) {
      return genderB === "male" ? "father" : genderB === "female" ? "mother" : "parent";
    }
    if (genFromB === 2) {
      return genderB === "male" ? "grandfather" : genderB === "female" ? "grandmother" : "grandparent";
    }
    const prefix = getGreatPrefix(genFromB);
    return genderB === "male" ? `${prefix}grandfather` : genderB === "female" ? `${prefix}grandmother` : `${prefix}grandparent`;
  }

  if (genFromB === 0 && genFromA > 0) {
    if (genFromA === 1) {
      return genderB === "male" ? "son" : genderB === "female" ? "daughter" : "child";
    }
    if (genFromA === 2) {
      return genderB === "male" ? "grandson" : genderB === "female" ? "granddaughter" : "grandchild";
    }
    const prefix = getGreatPrefix(genFromA);
    return genderB === "male" ? `${prefix}grandson` : genderB === "female" ? `${prefix}granddaughter` : `${prefix}grandchild`;
  }

  if (genFromA === 1 && genFromB > 1) {
    const prefix = getGreatPrefix(genFromB - 1);
    return genderB === "male" ? `${prefix}uncle` : genderB === "female" ? `${prefix}aunt` : `${prefix}uncle/aunt`;
  }

  if (genFromB === 1 && genFromA > 1) {
    const prefix = getGreatPrefix(genFromA - 1);
    return genderB === "male" ? `${prefix}nephew` : genderB === "female" ? `${prefix}niece` : `${prefix}nephew/niece`;
  }

  if (genFromA >= 1 && genFromB >= 1) {
    const cousinDegree = Math.min(genFromA, genFromB) - 1;
    const removal = Math.abs(genFromA - genFromB);

    if (cousinDegree === 0) {
      if (removal === 0) {
        return genderB === "male" ? "brother" : genderB === "female" ? "sister" : "sibling";
      }
    }

    let cousinName = `${getOrdinalSuffix(cousinDegree)} cousin`;
    if (removal > 0) {
      cousinName += ` ${removal === 1 ? "once" : removal === 2 ? "twice" : removal === 3 ? "thrice" : `${removal} times`} removed`;
    }
    return cousinName;
  }

  return "related";
}

function findPath(
  fromId: string,
  toId: string,
  graph: FamilyGraph,
  members: Map<string, FamilyMember>
): string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === toId) {
      return path;
    }
    if (visited.has(id)) continue;
    visited.add(id);

    const neighbors = [
      ...(graph.parents.get(id) || []),
      ...(graph.children.get(id) || []),
      ...(graph.spouses.get(id) || []),
      ...(graph.siblings.get(id) || []),
    ];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return [];
}

export function calculateRelationship(
  memberAId: string,
  memberBId: string,
  members: FamilyMember[],
  relationships: Relationship[]
): RelationshipResult | null {
  if (memberAId === memberBId) {
    return {
      relationshipName: "self",
      path: [memberAId],
      commonAncestors: [memberAId],
      generationsFromA: 0,
      generationsFromB: 0,
      isDirectLine: true,
    };
  }

  const membersMap = new Map(members.map((m) => [m.id, m]));
  const memberA = membersMap.get(memberAId);
  const memberB = membersMap.get(memberBId);

  if (!memberA || !memberB) {
    return null;
  }

  const graph = buildFamilyGraph(relationships);

  const spousesOfA = graph.spouses.get(memberAId) || [];
  if (spousesOfA.includes(memberBId)) {
    const genderB = memberB.gender || "other";
    return {
      relationshipName: genderB === "male" ? "husband" : genderB === "female" ? "wife" : "spouse",
      path: [memberAId, memberBId],
      commonAncestors: [],
      generationsFromA: 0,
      generationsFromB: 0,
      isDirectLine: false,
    };
  }

  const siblingsOfA = graph.siblings.get(memberAId) || [];
  if (siblingsOfA.includes(memberBId)) {
    const genderB = memberB.gender || "other";
    return {
      relationshipName: genderB === "male" ? "brother" : genderB === "female" ? "sister" : "sibling",
      path: [memberAId, memberBId],
      commonAncestors: [],
      generationsFromA: 1,
      generationsFromB: 1,
      isDirectLine: false,
    };
  }

  const ancestorsA = getAncestors(memberAId, graph);
  const ancestorsB = getAncestors(memberBId, graph);

  if (ancestorsA.has(memberBId)) {
    const genFromA = ancestorsA.get(memberBId)!;
    const relationshipName = calculateRelationshipName(0, genFromA, memberA, memberB, graph);
    const path = findPath(memberAId, memberBId, graph, membersMap);
    return {
      relationshipName,
      path,
      commonAncestors: [memberBId],
      generationsFromA: 0,
      generationsFromB: genFromA,
      isDirectLine: true,
    };
  }

  if (ancestorsB.has(memberAId)) {
    const genFromB = ancestorsB.get(memberAId)!;
    const relationshipName = calculateRelationshipName(genFromB, 0, memberA, memberB, graph);
    const path = findPath(memberAId, memberBId, graph, membersMap);
    return {
      relationshipName,
      path,
      commonAncestors: [memberAId],
      generationsFromA: genFromB,
      generationsFromB: 0,
      isDirectLine: true,
    };
  }

  const commonAncestors = findCommonAncestors(ancestorsA, ancestorsB);

  if (commonAncestors.length === 0) {
    const path = findPath(memberAId, memberBId, graph, membersMap);
    if (path.length > 0) {
      return {
        relationshipName: "related by marriage",
        path,
        commonAncestors: [],
        generationsFromA: 0,
        generationsFromB: 0,
        isDirectLine: false,
      };
    }
    return null;
  }

  const closest = commonAncestors[0];
  const relationshipName = calculateRelationshipName(
    closest.genFromA,
    closest.genFromB,
    memberA,
    memberB,
    graph
  );

  const path = findPath(memberAId, memberBId, graph, membersMap);

  return {
    relationshipName,
    path,
    commonAncestors: commonAncestors.map((a) => a.id),
    generationsFromA: closest.genFromA,
    generationsFromB: closest.genFromB,
    isDirectLine: closest.genFromA === 0 || closest.genFromB === 0,
  };
}

export function getSubtreeBetweenMembers(
  memberAId: string,
  memberBId: string,
  members: FamilyMember[],
  relationships: Relationship[]
): { members: FamilyMember[]; relationships: Relationship[] } {
  const membersMap = new Map(members.map((m) => [m.id, m]));
  const graph = buildFamilyGraph(relationships);

  const ancestorsA = getAncestors(memberAId, graph);
  const ancestorsB = getAncestors(memberBId, graph);

  const subtreeMemberIds = new Set<string>();

  subtreeMemberIds.add(memberAId);
  subtreeMemberIds.add(memberBId);

  ancestorsA.forEach((_, ancestorId) => {
    subtreeMemberIds.add(ancestorId);
  });
  ancestorsB.forEach((_, ancestorId) => {
    subtreeMemberIds.add(ancestorId);
  });

  const commonAncestors = findCommonAncestors(ancestorsA, ancestorsB);
  for (const ancestor of commonAncestors) {
    subtreeMemberIds.add(ancestor.id);
  }

  const path = findPath(memberAId, memberBId, graph, membersMap);
  for (const id of path) {
    subtreeMemberIds.add(id);
  }

  const subtreeMembers = members.filter((m) => subtreeMemberIds.has(m.id));
  const subtreeRelationships = relationships.filter(
    (r) => subtreeMemberIds.has(r.fromMemberId) && subtreeMemberIds.has(r.toMemberId)
  );

  return {
    members: subtreeMembers,
    relationships: subtreeRelationships,
  };
}
