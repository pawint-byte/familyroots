import { db } from "../server/db";
import { familyTrees, familyMembers, relationships, familyEvents, treeConnections, treeTags, memberTags, giftRegistries, giftRegistryItems, treeInvitations, treeCollaborators } from "../shared/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { DatabaseStorage } from "../server/storage";

const storage = new DatabaseStorage();
const TEST_OWNER = "test-core-flows-" + Date.now();
const TEST_OWNER_2 = "test-core-flows-2-" + Date.now();
const createdTreeIds: string[] = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`   PASS: ${message}`);
  } else {
    failedTests++;
    console.log(`   FAIL: ${message}`);
  }
}

async function cleanup() {
  for (const treeId of createdTreeIds) {
    await db.delete(giftRegistryItems).where(
      inArray(giftRegistryItems.registryId,
        db.select({ id: giftRegistries.id }).from(giftRegistries).where(eq(giftRegistries.treeId, treeId))
      )
    ).catch(() => {});
    await db.delete(giftRegistries).where(eq(giftRegistries.treeId, treeId)).catch(() => {});
    await db.delete(memberTags).where(eq(memberTags.treeId, treeId)).catch(() => {});
    await db.delete(treeTags).where(eq(treeTags.treeId, treeId)).catch(() => {});
    await db.delete(treeInvitations).where(eq(treeInvitations.treeId, treeId)).catch(() => {});
    await db.delete(treeCollaborators).where(eq(treeCollaborators.treeId, treeId)).catch(() => {});
    await db.delete(relationships).where(eq(relationships.treeId, treeId)).catch(() => {});
    await db.delete(familyEvents).where(eq(familyEvents.treeId, treeId)).catch(() => {});
    await db.delete(familyMembers).where(eq(familyMembers.treeId, treeId)).catch(() => {});
    await db.delete(treeConnections).where(eq(treeConnections.tree1Id, treeId)).catch(() => {});
    await db.delete(treeConnections).where(eq(treeConnections.tree2Id, treeId)).catch(() => {});
    await db.delete(familyTrees).where(eq(familyTrees.id, treeId)).catch(() => {});
  }
}

// ============================================================
// TEST 1: TREE CREATION
// ============================================================
async function testTreeCreation() {
  console.log("\n=== TEST 1: TREE CREATION ===");

  const tree = await storage.createTree({
    name: "Test Family Tree",
    ownerId: TEST_OWNER,
    treeType: "family",
    privacy: "private",
  });
  createdTreeIds.push(tree.id);

  assert(!!tree.id, "Tree has an ID");
  assert(tree.name === "Test Family Tree", "Tree name is correct");
  assert(tree.ownerId === TEST_OWNER, "Tree owner is correct");
  assert(tree.treeType === "family", "Tree type is family");
  assert(tree.privacy === "private", "Tree privacy is private");

  const fetched = await storage.getTree(tree.id);
  assert(!!fetched, "Tree can be fetched by ID");
  assert(fetched?.name === "Test Family Tree", "Fetched tree name matches");

  const nonFamily = await storage.createTree({
    name: "Test Church Group",
    ownerId: TEST_OWNER,
    treeType: "church",
    privacy: "public",
  });
  createdTreeIds.push(nonFamily.id);
  assert(nonFamily.treeType === "church", "Non-family tree type is church");
  assert(nonFamily.privacy === "public", "Public tree privacy is correct");

  return tree;
}

// ============================================================
// TEST 2: ADDING MEMBERS
// ============================================================
async function testAddMembers(treeId: string) {
  console.log("\n=== TEST 2: ADDING MEMBERS ===");

  const alice = await storage.createMember({
    treeId,
    firstName: "Alice",
    lastName: "TestFamily",
    email: "alice@testfamily.com",
    gender: "female",
    birthDate: "1970-01-15",
    birthPlace: "New York, NY",
  });
  assert(!!alice.id, "Alice created with ID");
  assert(alice.firstName === "Alice", "Alice first name correct");
  assert(alice.treeId === treeId, "Alice assigned to correct tree");

  const bob = await storage.createMember({
    treeId,
    firstName: "Bob",
    lastName: "TestFamily",
    email: "bob@testfamily.com",
    gender: "male",
    birthDate: "1968-05-20",
  });

  const charlie = await storage.createMember({
    treeId,
    firstName: "Charlie",
    lastName: "TestFamily",
    email: "charlie@testfamily.com",
    gender: "male",
    birthDate: "1995-03-10",
  });

  const diana = await storage.createMember({
    treeId,
    firstName: "Diana",
    lastName: "TestFamily",
    gender: "female",
    birthDate: "1998-07-22",
  });

  const members = await storage.getMembers(treeId);
  assert(members.length === 4, `Tree has 4 members (got ${members.length})`);

  const memberWithoutEmail = members.find(m => m.firstName === "Diana");
  assert(!memberWithoutEmail?.email, "Member without email is correctly stored");

  return { alice, bob, charlie, diana };
}

// ============================================================
// TEST 3: CREATING RELATIONSHIPS
// ============================================================
async function testRelationships(treeId: string, members: { alice: any; bob: any; charlie: any; diana: any }) {
  console.log("\n=== TEST 3: CREATING RELATIONSHIPS ===");

  const { alice, bob, charlie, diana } = members;

  await storage.createRelationship({ treeId, fromMemberId: alice.id, toMemberId: bob.id, relationshipType: "spouse" });
  await storage.createRelationship({ treeId, fromMemberId: bob.id, toMemberId: alice.id, relationshipType: "spouse" });
  await storage.createRelationship({ treeId, fromMemberId: charlie.id, toMemberId: alice.id, relationshipType: "child" });
  await storage.createRelationship({ treeId, fromMemberId: alice.id, toMemberId: charlie.id, relationshipType: "parent" });
  await storage.createRelationship({ treeId, fromMemberId: charlie.id, toMemberId: bob.id, relationshipType: "child" });
  await storage.createRelationship({ treeId, fromMemberId: bob.id, toMemberId: charlie.id, relationshipType: "parent" });
  await storage.createRelationship({ treeId, fromMemberId: diana.id, toMemberId: alice.id, relationshipType: "child" });
  await storage.createRelationship({ treeId, fromMemberId: alice.id, toMemberId: diana.id, relationshipType: "parent" });
  await storage.createRelationship({ treeId, fromMemberId: diana.id, toMemberId: bob.id, relationshipType: "child" });
  await storage.createRelationship({ treeId, fromMemberId: bob.id, toMemberId: diana.id, relationshipType: "parent" });
  await storage.createRelationship({ treeId, fromMemberId: charlie.id, toMemberId: diana.id, relationshipType: "sibling" });
  await storage.createRelationship({ treeId, fromMemberId: diana.id, toMemberId: charlie.id, relationshipType: "sibling" });

  const rels = await storage.getRelationships(treeId);
  assert(rels.length === 12, `12 relationships created (got ${rels.length})`);

  const spouseRels = rels.filter(r => r.relationshipType === "spouse");
  assert(spouseRels.length === 2, `2 spouse relationships (got ${spouseRels.length})`);

  const parentRels = rels.filter(r => r.relationshipType === "parent");
  assert(parentRels.length === 4, `4 parent relationships (got ${parentRels.length})`);

  const childRels = rels.filter(r => r.relationshipType === "child");
  assert(childRels.length === 4, `4 child relationships (got ${childRels.length})`);

  const siblingRels = rels.filter(r => r.relationshipType === "sibling");
  assert(siblingRels.length === 2, `2 sibling relationships (got ${siblingRels.length})`);

  const aliceRelated = rels.filter(r => r.fromMemberId === alice.id || r.toMemberId === alice.id);
  assert(aliceRelated.length === 6, `Alice has 6 relationships (got ${aliceRelated.length})`);
}

// ============================================================
// TEST 4: TREE SPLITTING (COPY, NOT MOVE)
// ============================================================
async function testTreeSplit(treeId: string, members: { alice: any; bob: any; charlie: any; diana: any }) {
  console.log("\n=== TEST 4: TREE SPLITTING ===");

  const { alice, bob, charlie, diana } = members;

  await db.insert(familyEvents).values({
    treeId, memberId: charlie.id, eventType: "graduation", title: "College Grad", eventDate: "2017-06-15", description: "Test event",
  });
  await db.insert(familyEvents).values({
    treeId, memberId: diana.id, eventType: "graduation", title: "High School Grad", eventDate: "2020-06-15", description: "Test event",
  });

  const preSplitMembers = await storage.getMembers(treeId);
  const preSplitRels = await storage.getRelationships(treeId);
  const preSplitEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, treeId));

  const newTree = await storage.splitTree(treeId, {
    name: "Split Result",
    treeType: "family",
    privacy: "private",
    newOwnerId: TEST_OWNER,
    memberIds: [charlie.id, diana.id],
    rootMemberId: charlie.id,
    createConnection: true,
  });
  createdTreeIds.push(newTree.id);

  const sourceMembers = await storage.getMembers(treeId);
  const sourceRels = await storage.getRelationships(treeId);
  const sourceEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, treeId));

  assert(sourceMembers.length === preSplitMembers.length, `Source tree members unchanged: ${sourceMembers.length} (was ${preSplitMembers.length})`);
  assert(sourceRels.length === preSplitRels.length, `Source tree relationships unchanged: ${sourceRels.length} (was ${preSplitRels.length})`);
  assert(sourceEvents.length === preSplitEvents.length, `Source tree events unchanged: ${sourceEvents.length} (was ${preSplitEvents.length})`);

  const aliceStillInSource = sourceMembers.find(m => m.firstName === "Alice");
  const bobStillInSource = sourceMembers.find(m => m.firstName === "Bob");
  const charlieStillInSource = sourceMembers.find(m => m.firstName === "Charlie");
  const dianaStillInSource = sourceMembers.find(m => m.firstName === "Diana");
  assert(!!aliceStillInSource, "Alice still in source tree");
  assert(!!bobStillInSource, "Bob still in source tree");
  assert(!!charlieStillInSource, "Charlie still in source tree");
  assert(!!dianaStillInSource, "Diana still in source tree");

  const newMembers = await storage.getMembers(newTree.id);
  const newRels = await storage.getRelationships(newTree.id);
  const newEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, newTree.id));

  assert(newMembers.length === 2, `New tree has 2 members (got ${newMembers.length})`);
  assert(newRels.length === 2, `New tree has 2 relationships/sibling pair (got ${newRels.length})`);
  assert(newEvents.length === 2, `New tree has 2 events (got ${newEvents.length})`);

  const charlieEvent = newEvents.find(e => e.title === "College Grad");
  const dianaEvent = newEvents.find(e => e.title === "High School Grad");
  assert(!!charlieEvent, "Charlie's event title 'College Grad' copied correctly");
  assert(!!dianaEvent, "Diana's event title 'High School Grad' copied correctly");
  assert(charlieEvent?.eventType === "graduation", "Event type preserved in copy");
  assert(charlieEvent?.description === "Test event", "Event description preserved in copy");

  const newCharlie = newMembers.find(m => m.firstName === "Charlie");
  const newDiana = newMembers.find(m => m.firstName === "Diana");
  assert(!!newCharlie && newCharlie.id !== charlie.id, "Charlie in new tree has new ID (copy, not move)");
  assert(!!newDiana && newDiana.id !== diana.id, "Diana in new tree has new ID (copy, not move)");

  const refreshedTree = await storage.getTree(newTree.id);
  assert(refreshedTree?.rootMemberId === newCharlie?.id, "Root member ID correctly mapped to new Charlie");

  for (const rel of newRels) {
    const fromInNew = newMembers.some(m => m.id === rel.fromMemberId);
    const toInNew = newMembers.some(m => m.id === rel.toMemberId);
    assert(fromInNew && toInNew, `Relationship ${rel.id} references new member IDs`);
  }

  return newTree;
}

// ============================================================
// TEST 5: TREE CLONING
// ============================================================
async function testTreeClone(treeId: string) {
  console.log("\n=== TEST 5: TREE CLONING ===");

  const sourceMembers = await storage.getMembers(treeId);
  const sourceRels = await storage.getRelationships(treeId);

  const result = await storage.cloneTree(treeId, {
    name: "Cloned Tree",
    privacy: "private",
    ownerId: TEST_OWNER,
  });
  createdTreeIds.push(result.tree.id);

  assert(result.tree.name === "Cloned Tree", "Clone has correct name");
  assert(result.tree.ownerId === TEST_OWNER, "Clone has correct owner");

  const cloneMembers = await storage.getMembers(result.tree.id);
  const cloneRels = await storage.getRelationships(result.tree.id);

  assert(cloneMembers.length === sourceMembers.length, `Clone has same member count: ${cloneMembers.length} (source: ${sourceMembers.length})`);
  assert(cloneRels.length === sourceRels.length, `Clone has same relationship count: ${cloneRels.length} (source: ${sourceRels.length})`);

  const sourceStillIntact = await storage.getMembers(treeId);
  assert(sourceStillIntact.length === sourceMembers.length, "Source tree unchanged after clone");

  for (const cm of cloneMembers) {
    const matchInSource = sourceMembers.find(sm => sm.firstName === cm.firstName && sm.lastName === cm.lastName);
    assert(!!matchInSource, `Clone member ${cm.firstName} has matching source member`);
    assert(cm.id !== matchInSource?.id, `Clone member ${cm.firstName} has different ID from source`);
  }

  for (const rel of cloneRels) {
    const fromInClone = cloneMembers.some(m => m.id === rel.fromMemberId);
    const toInClone = cloneMembers.some(m => m.id === rel.toMemberId);
    assert(fromInClone && toInClone, `Clone relationship references clone member IDs`);
  }
}

// ============================================================
// TEST 6: TREE TAGS AND MEMBER TAGGING
// ============================================================
async function testTags(treeId: string, members: { alice: any; bob: any; charlie: any; diana: any }) {
  console.log("\n=== TEST 6: TAGS & MEMBER TAGGING ===");

  const { alice, bob, charlie } = members;

  const tag1 = await storage.createTreeTag({ treeId, label: "Parents", color: "#FF0000" });
  assert(!!tag1.id, "Tag created with ID");
  assert(tag1.label === "Parents", "Tag label correct");

  const tag2 = await storage.createTreeTag({ treeId, label: "Children", color: "#00FF00" });

  const tags = await storage.getTreeTags(treeId);
  assert(tags.length === 2, `2 tags created (got ${tags.length})`);

  await storage.addMemberTag({ tagId: tag1.id, memberId: alice.id, treeId });
  await storage.addMemberTag({ tagId: tag1.id, memberId: bob.id, treeId });
  await storage.addMemberTag({ tagId: tag2.id, memberId: charlie.id, treeId });

  const memberTagAssignments = await storage.getMemberTagsByTree(treeId);
  assert(memberTagAssignments.length === 3, `3 member-tag assignments (got ${memberTagAssignments.length})`);

  const aliceTags = memberTagAssignments.filter(mt => mt.memberId === alice.id);
  assert(aliceTags.length === 1, `Alice has 1 tag (got ${aliceTags.length})`);
  assert(aliceTags[0].tagId === tag1.id, "Alice has Parents tag");
}

// ============================================================
// TEST 7: GIFT REGISTRY
// ============================================================
async function testGiftRegistry(treeId: string, memberId: string) {
  console.log("\n=== TEST 7: GIFT REGISTRY ===");

  const [registry] = await db.insert(giftRegistries).values({
    treeId,
    memberId,
    createdByUserId: TEST_OWNER,
    title: "Test Birthday",
    eventType: "birthday",
    eventDate: "2026-06-04",
    isActive: true,
  }).returning();

  assert(!!registry.id, "Registry created with ID");
  assert(registry.title === "Test Birthday", "Registry title correct");
  assert(registry.createdByUserId === TEST_OWNER, "Registry createdByUserId persisted correctly");
  assert(registry.memberId === memberId, "Registry memberId persisted correctly");

  const [item1] = await db.insert(giftRegistryItems).values({
    registryId: registry.id,
    name: "Amazon Gift",
    url: "https://www.amazon.com/dp/B08N5WRWNW",
    price: 2999,
    quantity: 1,
  }).returning();
  assert(!!item1.id, "Registry item created");

  const [item2] = await db.insert(giftRegistryItems).values({
    registryId: registry.id,
    name: "Etsy Gift",
    url: "https://www.etsy.com/listing/123456789",
    price: 4500,
    quantity: 1,
  }).returning();

  const [item3] = await db.insert(giftRegistryItems).values({
    registryId: registry.id,
    name: "Giftlab Item",
    url: "https://www.giftlab.com/products/test-item",
    price: 1999,
    quantity: 1,
  }).returning();

  const items = await db.select().from(giftRegistryItems).where(eq(giftRegistryItems.registryId, registry.id));
  assert(items.length === 3, `3 registry items created (got ${items.length})`);
}

// ============================================================
// TEST 8: AFFILIATE LINK TRACKING
// ============================================================
function testAffiliateTracking() {
  console.log("\n=== TEST 8: AFFILIATE LINK TRACKING ===");

  function addAffiliateTracking(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('amzn.to')) {
        urlObj.searchParams.set('tag', 'pawint-20');
        return urlObj.toString();
      }
      if (urlObj.hostname.includes('etsy.com')) {
        const encodedUrl = encodeURIComponent(url);
        return `https://www.awin1.com/cread.php?awinmid=6220&awinaffid=2735710&ued=${encodedUrl}`;
      }
      if (urlObj.hostname.includes('giftlab.com')) {
        const encodedUrl = encodeURIComponent(url);
        return `https://www.awin1.com/cread.php?awinmid=95201&awinaffid=2735710&ued=${encodedUrl}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  const amazonUrl = addAffiliateTracking("https://www.amazon.com/dp/B08N5WRWNW");
  assert(amazonUrl?.includes("tag=pawint-20") === true, "Amazon URL has pawint-20 tag");
  assert(amazonUrl?.includes("amazon.com") === true, "Amazon URL preserves domain");

  const etsyUrl = addAffiliateTracking("https://www.etsy.com/listing/123456789");
  assert(etsyUrl?.includes("awinmid=6220") === true, "Etsy URL has correct Awin merchant ID (6220)");
  assert(etsyUrl?.includes("awinaffid=2735710") === true, "Etsy URL has correct Awin publisher ID (2735710)");
  assert(etsyUrl?.includes("awin1.com") === true, "Etsy URL wrapped in Awin redirect");

  const giftlabUrl = addAffiliateTracking("https://www.giftlab.com/products/test-item");
  assert(giftlabUrl?.includes("awinmid=95201") === true, "Giftlab URL has correct Awin merchant ID (95201)");
  assert(giftlabUrl?.includes("awinaffid=2735710") === true, "Giftlab URL has correct Awin publisher ID");

  const otherUrl = addAffiliateTracking("https://www.walmart.com/ip/12345");
  assert(otherUrl === "https://www.walmart.com/ip/12345", "Non-affiliate URL returned unchanged");

  const nullResult = addAffiliateTracking(null);
  assert(nullResult === null, "Null URL returns null");

  const undefinedResult = addAffiliateTracking(undefined);
  assert(undefinedResult === null, "Undefined URL returns null");

  const amznShort = addAffiliateTracking("https://amzn.to/3abc123");
  assert(amznShort?.includes("tag=pawint-20") === true, "Shortened Amazon URL gets affiliate tag");
}

// ============================================================
// TEST 9: INVITE LINK CREATION
// ============================================================
async function testInviteLink(treeId: string) {
  console.log("\n=== TEST 9: INVITE LINK CREATION ===");

  const inviteCode = "test-" + Date.now().toString(36);
  const invitation = await storage.createInvitation({
    treeId,
    inviteCode,
    role: "editor",
    createdBy: TEST_OWNER,
    maxUses: "5",
  });

  assert(!!invitation.id, "Invitation created with ID");
  assert(invitation.inviteCode === inviteCode, "Invite code matches");
  assert(invitation.role === "editor", "Role is editor");

  const fetched = await storage.getInvitation(inviteCode);
  assert(!!fetched, "Invitation retrievable by code");
  assert(fetched?.treeId === treeId, "Invitation points to correct tree");
  assert(fetched?.isActive === true, "Invitation is active");
}

// ============================================================
// TEST 10: COLLABORATOR MANAGEMENT
// ============================================================
async function testCollaborators(treeId: string) {
  console.log("\n=== TEST 10: COLLABORATOR MANAGEMENT ===");

  const collab = await storage.addCollaborator({
    treeId,
    userId: TEST_OWNER_2,
    role: "editor",
    canEdit: true,
  });

  assert(!!collab.id, "Collaborator added with ID");
  assert(collab.userId === TEST_OWNER_2, "Collaborator user ID correct");
  assert(collab.role === "editor", "Collaborator role correct");
  assert(collab.canEdit === true, "Collaborator can edit");

  const collabs = await storage.getCollaborators(treeId);
  assert(collabs.length >= 1, `At least 1 collaborator (got ${collabs.length})`);

  const found = collabs.find(c => c.userId === TEST_OWNER_2);
  assert(!!found, "Collaborator found by user ID");
}

// ============================================================
// TEST 11: TREE CONNECTION
// ============================================================
async function testTreeConnection(tree1Id: string) {
  console.log("\n=== TEST 11: TREE CONNECTION ===");

  const tree2 = await storage.createTree({
    name: "Connected Tree",
    ownerId: TEST_OWNER_2,
    treeType: "family",
    privacy: "private",
  });
  createdTreeIds.push(tree2.id);

  const memberInTree2 = await storage.createMember({
    treeId: tree2.id,
    firstName: "Eve",
    lastName: "Connected",
    gender: "female",
  });

  await db.insert(treeConnections).values({
    tree1Id: tree1Id,
    tree2Id: tree2.id,
    connectionType: "family",
    createdBy: TEST_OWNER,
  });

  const connections = await db.select().from(treeConnections).where(eq(treeConnections.tree1Id, tree1Id));
  assert(connections.length >= 1, `Tree has at least 1 connection (got ${connections.length})`);
  const hasCorrectConnection = connections.some(c => c.tree2Id === tree2.id);
  assert(hasCorrectConnection, "Connection points to correct tree");

  const tree2Members = await storage.getMembers(tree2.id);
  assert(tree2Members.length === 1, "Connected tree has 1 member");
  assert(tree2Members[0].firstName === "Eve", "Connected tree member is Eve");
}

// ============================================================
// TEST 12: MEMBER SOFT DELETE AND RESTORE
// ============================================================
async function testMemberSoftDelete(treeId: string) {
  console.log("\n=== TEST 12: MEMBER SOFT DELETE & RESTORE ===");

  const tempMember = await storage.createMember({
    treeId,
    firstName: "TempDelete",
    lastName: "TestMember",
    gender: "male",
  });

  await storage.createRelationship({ treeId, fromMemberId: tempMember.id, toMemberId: (await storage.getMembers(treeId))[0].id, relationshipType: "sibling" });

  const beforeDelete = await storage.getMembers(treeId);
  const hasTempBefore = beforeDelete.some(m => m.id === tempMember.id);
  assert(hasTempBefore, "Temp member exists before delete");

  await storage.softDeleteMember(tempMember.id);

  const afterDelete = await storage.getMembers(treeId);
  const hasTempAfter = afterDelete.some(m => m.id === tempMember.id);
  assert(!hasTempAfter, "Temp member not in active members after soft delete");

  const deletedMembers = await storage.getDeletedMembers(treeId);
  const inDeleted = deletedMembers.some(m => m.id === tempMember.id);
  assert(inDeleted, "Temp member found in deleted members list");

  await storage.restoreMember(tempMember.id);

  const afterRestore = await storage.getMembers(treeId);
  const hasTempRestored = afterRestore.some(m => m.id === tempMember.id);
  assert(hasTempRestored, "Temp member restored to active members");

  await storage.softDeleteMember(tempMember.id);
}

// ============================================================
// TEST 13: LAYOUT POSITION PERSISTENCE
// ============================================================
async function testLayoutPositions(treeId: string) {
  console.log("\n=== TEST 13: LAYOUT POSITION PERSISTENCE ===");

  const members = await storage.getMembers(treeId);
  const firstMember = members[0];

  const position = { x: 150, y: 300 };
  await storage.updateMember(firstMember.id, { customPosition: position });

  const updated = await storage.getMember(firstMember.id);
  assert(!!updated?.customPosition, "Custom position was saved");
  assert((updated?.customPosition as any)?.x === 150, "Position X is correct");
  assert((updated?.customPosition as any)?.y === 300, "Position Y is correct");

  await storage.updateMember(firstMember.id, { customPosition: null });
  const cleared = await storage.getMember(firstMember.id);
  assert(!cleared?.customPosition, "Custom position cleared");
}

// ============================================================
// TEST 14: CSV PARSING LOGIC (UNIT TEST)
// ============================================================
function testCsvParsing() {
  console.log("\n=== TEST 14: CSV PARSING LOGIC ===");

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const simple = parseCsvLine("1,Alice,TestFamily,alice@test.com");
  assert(simple.length === 4, `Simple CSV: 4 fields (got ${simple.length})`);
  assert(simple[1] === "Alice", "Simple CSV: second field is Alice");

  const quoted = parseCsvLine('2,"Smith, Jr.",Bob,bob@test.com');
  assert(quoted.length === 4, `Quoted CSV: 4 fields (got ${quoted.length})`);
  assert(quoted[1] === "Smith, Jr.", `Quoted CSV: comma in quotes preserved (got "${quoted[1]}")`);

  const escapedQuote = parseCsvLine('3,"""Nickname""",Charlie,charlie@test.com');
  assert(escapedQuote[1] === '"Nickname"', `Escaped quotes: inner quotes preserved (got "${escapedQuote[1]}")`);

  const empty = parseCsvLine("4,,,");
  assert(empty.length === 4, `Empty fields: 4 fields (got ${empty.length})`);
  assert(empty[1] === "", "Empty fields: second field is empty");

  const mixed = parseCsvLine('5,"Last, Name",First,"email@test.com"');
  assert(mixed.length === 4, `Mixed CSV: 4 fields (got ${mixed.length})`);
  assert(mixed[1] === "Last, Name", `Mixed CSV: quoted comma field correct`);
  assert(mixed[3] === "email@test.com", `Mixed CSV: quoted simple field correct`);
}

// ============================================================
// TEST 15: RELATIONSHIP REVERSE TYPE LOGIC
// ============================================================
function testRelationshipReverseTypes() {
  console.log("\n=== TEST 15: RELATIONSHIP REVERSE TYPES ===");

  function getReverseRelationshipType(type: string): string | null {
    const reverseMap: Record<string, string> = {
      parent: "child",
      child: "parent",
      spouse: "spouse",
      sibling: "sibling",
      grandparent: "grandchild",
      grandchild: "grandparent",
      uncle: "niece_nephew",
      aunt: "niece_nephew",
      niece_nephew: "uncle",
      cousin: "cousin",
    };
    return reverseMap[type] || null;
  }

  assert(getReverseRelationshipType("parent") === "child", "Reverse of parent is child");
  assert(getReverseRelationshipType("child") === "parent", "Reverse of child is parent");
  assert(getReverseRelationshipType("spouse") === "spouse", "Reverse of spouse is spouse");
  assert(getReverseRelationshipType("sibling") === "sibling", "Reverse of sibling is sibling");
  assert(getReverseRelationshipType("grandparent") === "grandchild", "Reverse of grandparent is grandchild");
  assert(getReverseRelationshipType("grandchild") === "grandparent", "Reverse of grandchild is grandparent");
  assert(getReverseRelationshipType("cousin") === "cousin", "Reverse of cousin is cousin");
  assert(getReverseRelationshipType("unknown_type") === null, "Unknown type returns null");
}

// ============================================================
// RUN ALL TESTS
// ============================================================
async function runAllTests() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   FAMILYROOTS CORE FLOW INTEGRATION TESTS   ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  try {
    const tree = await testTreeCreation();
    const members = await testAddMembers(tree.id);
    await testRelationships(tree.id, members);
    await testTreeSplit(tree.id, members);
    await testTreeClone(tree.id);
    await testTags(tree.id, members);
    await testGiftRegistry(tree.id, members.alice.id);
    testAffiliateTracking();
    await testInviteLink(tree.id);
    await testCollaborators(tree.id);
    await testTreeConnection(tree.id);
    await testMemberSoftDelete(tree.id);
    await testLayoutPositions(tree.id);
    testCsvParsing();
    testRelationshipReverseTypes();

  } catch (error) {
    console.error("\n!!! TEST SUITE ERROR !!!", error);
    failedTests++;
  } finally {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log(`║   RESULTS: ${passedTests} passed, ${failedTests} failed, ${totalTests} total`);
    console.log("╚══════════════════════════════════════════════╝");

    console.log("\nCleaning up test data...");
    await cleanup();
    console.log("Cleanup complete.");
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runAllTests();
