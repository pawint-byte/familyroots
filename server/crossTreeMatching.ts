import { storage } from "./storage";
import type { FamilyMember, ExternalPersonIdentifier, CrossTreeMatch } from "@shared/schema";

interface MatchCandidate {
  member: FamilyMember;
  treeId: string;
  matchScore: number;
  matchReasons: string[];
  externalIdMatch?: string;
}

interface MatchResult {
  sourceMember: FamilyMember;
  candidates: MatchCandidate[];
}

const GENERATION_SUFFIXES = /\s+(jr\.?|sr\.?|ii|iii|iv|v|2nd|3rd|4th|5th)$/i;

function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(GENERATION_SUFFIXES, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGenerationSuffix(name: string): string | null {
  const match = name.match(GENERATION_SUFFIXES);
  return match ? match[1].toLowerCase().replace('.', '') : null;
}

function parseYear(dateString: string | null | undefined): number | null {
  if (!dateString) return null;
  const match = dateString.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

function areSameGeneration(member1: FamilyMember, member2: FamilyMember): boolean {
  const suffix1 = extractGenerationSuffix(`${member1.firstName} ${member1.lastName}`);
  const suffix2 = extractGenerationSuffix(`${member2.firstName} ${member2.lastName}`);
  
  if (suffix1 !== suffix2) {
    return false;
  }
  
  const year1 = parseYear(member1.birthDate);
  const year2 = parseYear(member2.birthDate);
  
  if (year1 && year2) {
    const yearDiff = Math.abs(year1 - year2);
    if (yearDiff > 15) {
      return false;
    }
  }
  
  return true;
}

function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeNameForMatching(name1);
  const normalized2 = normalizeNameForMatching(name2);
  
  if (normalized1 === normalized2) return 1.0;
  
  const words1 = normalized1.split(' ');
  const words2 = normalized2.split(' ');
  
  let matchingWords = 0;
  for (const word of words1) {
    if (words2.includes(word)) matchingWords++;
  }
  
  const maxWords = Math.max(words1.length, words2.length);
  return matchingWords / maxWords;
}

function calculateDateSimilarity(date1: string | null | undefined, date2: string | null | undefined): number {
  const year1 = parseYear(date1);
  const year2 = parseYear(date2);
  
  if (!year1 || !year2) return 0.5;
  
  const diff = Math.abs(year1 - year2);
  if (diff === 0) return 1.0;
  if (diff <= 1) return 0.9;
  if (diff <= 3) return 0.7;
  if (diff <= 5) return 0.5;
  return 0;
}

export async function findCrossTreeMatchesByExternalId(
  source: string,
  externalId: string
): Promise<ExternalPersonIdentifier[]> {
  return storage.getExternalIdentifiersByExternalId(source, externalId);
}

export async function findPotentialCrossTreeMatches(
  member: FamilyMember,
  excludeTreeIds: string[] = []
): Promise<MatchCandidate[]> {
  const candidates: MatchCandidate[] = [];
  
  const externalIds = await storage.getExternalIdentifiersForMember(member.id);
  
  for (const extId of externalIds) {
    const matchingIdentifiers = await storage.getExternalIdentifiersByExternalId(extId.source, extId.externalId);
    
    for (const matchingId of matchingIdentifiers) {
      if (matchingId.memberId === member.id) continue;
      if (excludeTreeIds.includes(matchingId.treeId)) continue;
      
      const matchedMember = await storage.getMember(matchingId.memberId);
      if (!matchedMember) continue;
      
      candidates.push({
        member: matchedMember,
        treeId: matchingId.treeId,
        matchScore: 1.0,
        matchReasons: [`Shared ${extId.source} ID: ${extId.externalId}`],
        externalIdMatch: extId.externalId,
      });
    }
  }
  
  return candidates;
}

export async function findPotentialMatchesInTree(
  member: FamilyMember,
  targetTreeId: string
): Promise<MatchCandidate[]> {
  const targetMembers = await storage.getMembers(targetTreeId);
  const candidates: MatchCandidate[] = [];
  
  const memberFullName = `${member.firstName} ${member.lastName}`;
  
  for (const targetMember of targetMembers) {
    if (targetMember.id === member.id) continue;
    
    const targetFullName = `${targetMember.firstName} ${targetMember.lastName}`;
    const nameSimilarity = calculateNameSimilarity(memberFullName, targetFullName);
    
    if (nameSimilarity < 0.5) continue;
    
    if (!areSameGeneration(member, targetMember)) {
      continue;
    }
    
    const birthDateSimilarity = calculateDateSimilarity(member.birthDate, targetMember.birthDate);
    
    let score = nameSimilarity * 0.5;
    const reasons: string[] = [];
    
    if (nameSimilarity >= 0.9) {
      reasons.push("Very similar names");
      score += 0.2;
    } else if (nameSimilarity >= 0.7) {
      reasons.push("Similar names");
    }
    
    if (birthDateSimilarity >= 0.9) {
      reasons.push("Same birth year");
      score += 0.3;
    } else if (birthDateSimilarity >= 0.7) {
      reasons.push("Similar birth year");
      score += 0.15;
    }
    
    if (member.birthPlace && targetMember.birthPlace) {
      const place1 = member.birthPlace.toLowerCase();
      const place2 = targetMember.birthPlace.toLowerCase();
      if (place1.includes(place2) || place2.includes(place1)) {
        reasons.push("Similar birth location");
        score += 0.1;
      }
    }
    
    if (score >= 0.6 && reasons.length > 0) {
      candidates.push({
        member: targetMember,
        treeId: targetTreeId,
        matchScore: Math.min(score, 1.0),
        matchReasons: reasons,
      });
    }
  }
  
  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export async function detectAndCreateCrossTreeMatches(
  sourceTreeId: string,
  targetTreeId: string
): Promise<CrossTreeMatch[]> {
  const sourceMembers = await storage.getMembers(sourceTreeId);
  const targetMembers = await storage.getMembers(targetTreeId);
  const createdMatches: CrossTreeMatch[] = [];
  const processedPairs = new Set<string>();
  
  // Build external ID lookup maps for O(1) matching (bulk approach)
  const sourceExternalIdMap = new Map<string, { memberId: string; source: string; externalId: string }[]>();
  const targetExternalIdMap = new Map<string, { memberId: string; source: string; externalId: string }[]>();
  
  // Fetch external IDs in parallel for all members
  const [sourceExternalIds, targetExternalIds] = await Promise.all([
    Promise.all(sourceMembers.map(async m => ({
      memberId: m.id,
      ids: await storage.getExternalIdentifiersForMember(m.id)
    }))),
    Promise.all(targetMembers.map(async m => ({
      memberId: m.id,
      ids: await storage.getExternalIdentifiersForMember(m.id)
    })))
  ]);
  
  // Build source map: externalKey -> member info
  for (const { memberId, ids } of sourceExternalIds) {
    for (const id of ids) {
      const key = `${id.source}:${id.externalId}`;
      if (!sourceExternalIdMap.has(key)) {
        sourceExternalIdMap.set(key, []);
      }
      sourceExternalIdMap.get(key)!.push({ memberId, source: id.source, externalId: id.externalId });
    }
  }
  
  // Build target map: externalKey -> member info
  for (const { memberId, ids } of targetExternalIds) {
    for (const id of ids) {
      const key = `${id.source}:${id.externalId}`;
      if (!targetExternalIdMap.has(key)) {
        targetExternalIdMap.set(key, []);
      }
      targetExternalIdMap.get(key)!.push({ memberId, source: id.source, externalId: id.externalId });
    }
  }
  
  // First pass: External ID matches using maps (O(n) instead of O(n*m))
  const sourceKeys = Array.from(sourceExternalIdMap.keys());
  for (const key of sourceKeys) {
    const sourceEntries = sourceExternalIdMap.get(key)!;
    const targetEntries = targetExternalIdMap.get(key);
    if (!targetEntries) continue;
    
    for (const sourceEntry of sourceEntries) {
      for (const targetEntry of targetEntries) {
        const pairKey = [sourceEntry.memberId, targetEntry.memberId].sort().join(':');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // Use try-catch with unique constraint instead of pre-check (faster)
        try {
          const match = await storage.createCrossTreeMatch({
            member1Id: sourceEntry.memberId,
            tree1Id: sourceTreeId,
            member2Id: targetEntry.memberId,
            tree2Id: targetTreeId,
            matchType: "external_id",
            matchSource: sourceEntry.source,
            externalId: sourceEntry.externalId,
            matchScore: 1.0,
            status: "pending",
          });
          createdMatches.push(match);
        } catch (err: unknown) {
          // Unique constraint violation (23505) means match already exists - skip silently
          if ((err as { code?: string })?.code !== '23505') {
            console.error("[CrossMatch] Error creating external ID match:", err);
          }
        }
      }
    }
  }
  
  // Build last name index for O(1) candidate lookup (reduces O(n*m) to O(n*k) where k << m)
  const targetByLastName = new Map<string, typeof targetMembers>();
  for (const targetMember of targetMembers) {
    const normalizedLastName = normalizeNameForMatching(`${targetMember.lastName}`);
    if (!targetByLastName.has(normalizedLastName)) {
      targetByLastName.set(normalizedLastName, []);
    }
    targetByLastName.get(normalizedLastName)!.push(targetMember);
  }
  
  // Collect potential match candidates for batch DB lookup
  const candidatePairs: { sourceMember: typeof sourceMembers[0]; targetMember: typeof targetMembers[0]; score: number }[] = [];
  
  // Second pass: Name/date similarity matching with early last name pruning
  for (const member of sourceMembers) {
    const normalizedLastName = normalizeNameForMatching(`${member.lastName}`);
    const candidates = targetByLastName.get(normalizedLastName) || [];
    
    for (const targetMember of candidates) {
      const pairKey = [member.id, targetMember.id].sort().join(':');
      if (processedPairs.has(pairKey)) continue;
      
      if (!areSameGeneration(member, targetMember)) continue;
      
      const memberFullName = `${member.firstName} ${member.lastName}`;
      const targetFullName = `${targetMember.firstName} ${targetMember.lastName}`;
      const nameSimilarity = calculateNameSimilarity(memberFullName, targetFullName);
      
      if (nameSimilarity < 0.7) continue;
      
      const birthDateSimilarity = calculateDateSimilarity(member.birthDate, targetMember.birthDate);
      
      let score = nameSimilarity * 0.5;
      
      if (nameSimilarity >= 0.9) {
        score += 0.2;
      }
      
      if (birthDateSimilarity >= 0.9) {
        score += 0.3;
      } else if (birthDateSimilarity >= 0.7) {
        score += 0.15;
      }
      
      if (score < 0.7) continue;
      
      processedPairs.add(pairKey);
      candidatePairs.push({ sourceMember: member, targetMember, score: Math.min(score, 1.0) });
    }
  }
  
  // Create matches for all candidates (unique constraint prevents duplicates)
  for (const { sourceMember, targetMember, score } of candidatePairs) {
    try {
      const match = await storage.createCrossTreeMatch({
        member1Id: sourceMember.id,
        tree1Id: sourceTreeId,
        member2Id: targetMember.id,
        tree2Id: targetTreeId,
        matchType: "name_date",
        matchSource: "auto_detection",
        externalId: null,
        matchScore: score,
        status: "pending",
      });
      createdMatches.push(match);
    } catch (err: unknown) {
      // Unique constraint violation means match already exists - skip silently
      if ((err as { code?: string })?.code !== '23505') {
        console.error("[CrossMatch] Error creating match:", err);
      }
    }
  }
  
  return createdMatches;
}

export async function linkMemberToExternalSource(
  memberId: string,
  treeId: string,
  source: string,
  externalId: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<ExternalPersonIdentifier> {
  const existingMembers = await storage.findMembersByExternalId(source, externalId);
  
  if (existingMembers.length > 0) {
    const otherTreeMembers = existingMembers.filter(m => m.treeId !== treeId);
    
    for (const otherMember of otherTreeMembers) {
      const existingMatch = await storage.getCrossTreeMatchByMembers(memberId, otherMember.id);
      if (!existingMatch) {
        await storage.createCrossTreeMatch({
          member1Id: memberId,
          tree1Id: treeId,
          member2Id: otherMember.id,
          tree2Id: otherMember.treeId,
          matchType: "external_id",
          matchSource: source,
          externalId: externalId,
          matchScore: 1.0,
          status: "pending",
        });
      }
    }
  }
  
  return storage.createExternalIdentifier({
    memberId,
    treeId,
    source,
    externalId,
    confidence: 1.0,
    verifiedAt: new Date(),
    verifiedBy: userId,
    metadata: metadata as any,
  });
}

export async function processFamilySearchRecord(
  treeId: string,
  suggestedBy: string,
  familySearchData: {
    personId: string;
    name?: string;
    gender?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
  },
  relatedToMemberId?: string,
  relationshipType?: string
): Promise<{ memberId?: string; suggestionId?: string; matchType: "existing" | "suggestion" }> {
  const existingMembers = await storage.findMembersByExternalId("familysearch", familySearchData.personId);
  
  const existingInTree = existingMembers.find(m => m.treeId === treeId);
  if (existingInTree) {
    return { memberId: existingInTree.id, matchType: "existing" };
  }
  
  const nameParts = familySearchData.name?.split(' ') || ['Unknown'];
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const suggestion = await storage.createPendingMemberSuggestion({
    treeId,
    suggestedBy,
    source: "familysearch",
    externalId: familySearchData.personId,
    firstName,
    lastName,
    gender: familySearchData.gender?.toLowerCase() || null,
    birthDate: familySearchData.birthDate || null,
    birthPlace: familySearchData.birthPlace || null,
    deathDate: familySearchData.deathDate || null,
    deathPlace: familySearchData.deathPlace || null,
    relatedToMemberId: relatedToMemberId || null,
    relationshipType: relationshipType || null,
    matchScore: existingMembers.length > 0 ? 0.8 : 0.6,
    matchReason: existingMembers.length > 0 
      ? `Found in ${existingMembers.length} other tree(s)` 
      : "New person from FamilySearch",
    sourceData: familySearchData as any,
  });
  
  return { suggestionId: suggestion.id, matchType: "suggestion" };
}
