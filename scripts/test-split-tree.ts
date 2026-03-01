import { db } from "../server/db";
import { familyTrees, familyMembers, relationships, familyEvents } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { DatabaseStorage } from "../server/storage";

const storage = new DatabaseStorage();
const TEST_OWNER = "test-split-owner-" + Date.now();

async function cleanup(treeIds: string[]) {
  for (const treeId of treeIds) {
    await db.delete(relationships).where(eq(relationships.treeId, treeId));
    await db.delete(familyEvents).where(eq(familyEvents.treeId, treeId));
    await db.delete(familyMembers).where(eq(familyMembers.treeId, treeId));
    await db.delete(familyTrees).where(eq(familyTrees.id, treeId));
  }
}

async function runTest() {
  console.log("=== SPLIT TREE INTEGRATION TEST ===\n");
  const createdTreeIds: string[] = [];

  try {
    console.log("1. Creating source tree...");
    const sourceTree = await storage.createTree({
      name: "Test Source Tree",
      ownerId: TEST_OWNER,
      treeType: "family",
      privacy: "private",
    });
    createdTreeIds.push(sourceTree.id);
    console.log(`   Source tree created: ${sourceTree.id}`);

    console.log("2. Adding members...");
    const alice = await storage.createMember({
      treeId: sourceTree.id,
      firstName: "Alice",
      lastName: "TestSplit",
      email: "alice@test.com",
      gender: "female",
      birthDate: "1970-01-01",
    });
    const bob = await storage.createMember({
      treeId: sourceTree.id,
      firstName: "Bob",
      lastName: "TestSplit",
      email: "bob@test.com",
      gender: "male",
      birthDate: "1968-05-15",
    });
    const charlie = await storage.createMember({
      treeId: sourceTree.id,
      firstName: "Charlie",
      lastName: "TestSplit",
      email: "charlie@test.com",
      gender: "male",
      birthDate: "1995-03-20",
    });
    const diana = await storage.createMember({
      treeId: sourceTree.id,
      firstName: "Diana",
      lastName: "TestSplit",
      email: "diana@test.com",
      gender: "female",
      birthDate: "1998-07-10",
    });
    console.log(`   Created 4 members: Alice, Bob, Charlie, Diana`);

    console.log("3. Creating relationships...");
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: alice.id, toMemberId: bob.id, relationshipType: "spouse" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: bob.id, toMemberId: alice.id, relationshipType: "spouse" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: charlie.id, toMemberId: alice.id, relationshipType: "child" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: alice.id, toMemberId: charlie.id, relationshipType: "parent" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: charlie.id, toMemberId: bob.id, relationshipType: "child" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: bob.id, toMemberId: charlie.id, relationshipType: "parent" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: diana.id, toMemberId: alice.id, relationshipType: "child" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: alice.id, toMemberId: diana.id, relationshipType: "parent" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: diana.id, toMemberId: bob.id, relationshipType: "child" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: bob.id, toMemberId: diana.id, relationshipType: "parent" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: charlie.id, toMemberId: diana.id, relationshipType: "sibling" });
    await storage.createRelationship({ treeId: sourceTree.id, fromMemberId: diana.id, toMemberId: charlie.id, relationshipType: "sibling" });
    console.log(`   Created 12 relationships (spouse, parent/child, sibling)`);

    console.log("4. Adding events...");
    await db.insert(familyEvents).values({
      treeId: sourceTree.id,
      memberId: charlie.id,
      eventType: "graduation",
      title: "College Graduation",
      eventDate: "2017-06-15",
      description: "College graduation",
    });
    await db.insert(familyEvents).values({
      treeId: sourceTree.id,
      memberId: diana.id,
      eventType: "graduation",
      title: "High School Graduation",
      eventDate: "2020-06-15",
      description: "High school graduation",
    });
    console.log(`   Created 2 events (one for Charlie, one for Diana)`);

    const preMembers = await storage.getMembers(sourceTree.id);
    const preRels = await storage.getRelationships(sourceTree.id);
    const preEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, sourceTree.id));
    console.log(`\n   PRE-SPLIT STATE:`);
    console.log(`   Source tree: ${preMembers.length} members, ${preRels.length} relationships, ${preEvents.length} events`);

    console.log("\n5. SPLITTING TREE (Charlie + Diana into new tree)...");
    const newTree = await storage.splitTree(sourceTree.id, {
      name: "Test Split Result",
      treeType: "family",
      privacy: "private",
      newOwnerId: TEST_OWNER,
      memberIds: [charlie.id, diana.id],
      rootMemberId: charlie.id,
      createConnection: false,
    });
    createdTreeIds.push(newTree.id);
    console.log(`   New tree created: ${newTree.id}`);

    console.log("\n6. VERIFYING SOURCE TREE (should be UNCHANGED)...");
    const sourceMembers = await storage.getMembers(sourceTree.id);
    const sourceRels = await storage.getRelationships(sourceTree.id);
    const sourceEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, sourceTree.id));
    console.log(`   Source tree: ${sourceMembers.length} members, ${sourceRels.length} relationships, ${sourceEvents.length} events`);

    const sourceMemberNames = sourceMembers.map(m => `${m.firstName} ${m.lastName}`).sort();
    console.log(`   Members: ${sourceMemberNames.join(", ")}`);

    let sourcePass = true;
    if (sourceMembers.length !== 4) {
      console.log(`   FAIL: Expected 4 members, got ${sourceMembers.length}`);
      sourcePass = false;
    }
    if (sourceRels.length !== 12) {
      console.log(`   FAIL: Expected 12 relationships, got ${sourceRels.length}`);
      sourcePass = false;
    }
    if (sourceEvents.length !== 2) {
      console.log(`   FAIL: Expected 2 events, got ${sourceEvents.length}`);
      sourcePass = false;
    }
    if (sourcePass) {
      console.log(`   PASS: Source tree is intact (4 members, 12 relationships, 2 events)`);
    }

    console.log("\n7. VERIFYING NEW TREE...");
    const newMembers = await storage.getMembers(newTree.id);
    const newRels = await storage.getRelationships(newTree.id);
    const newEvents = await db.select().from(familyEvents).where(eq(familyEvents.treeId, newTree.id));
    console.log(`   New tree: ${newMembers.length} members, ${newRels.length} relationships, ${newEvents.length} events`);

    const newMemberNames = newMembers.map(m => `${m.firstName} ${m.lastName}`).sort();
    console.log(`   Members: ${newMemberNames.join(", ")}`);

    let newPass = true;
    if (newMembers.length !== 2) {
      console.log(`   FAIL: Expected 2 members, got ${newMembers.length}`);
      newPass = false;
    }
    if (!newMemberNames.includes("Charlie TestSplit") || !newMemberNames.includes("Diana TestSplit")) {
      console.log(`   FAIL: Expected Charlie and Diana, got ${newMemberNames.join(", ")}`);
      newPass = false;
    }
    if (newRels.length !== 2) {
      console.log(`   FAIL: Expected 2 relationships (sibling pair), got ${newRels.length}`);
      newPass = false;
    }
    if (newEvents.length !== 2) {
      console.log(`   FAIL: Expected 2 events, got ${newEvents.length}`);
      newPass = false;
    }
    if (newPass) {
      console.log(`   PASS: New tree has correct members (Charlie, Diana), relationships, and events`);
    }

    console.log("\n8. VERIFYING NEW MEMBER IDs ARE DIFFERENT (copies, not moves)...");
    const newCharlie = newMembers.find(m => m.firstName === "Charlie");
    const newDiana = newMembers.find(m => m.firstName === "Diana");
    let idPass = true;
    if (newCharlie && newCharlie.id === charlie.id) {
      console.log(`   FAIL: Charlie's new ID matches source (should be different copy)`);
      idPass = false;
    }
    if (newDiana && newDiana.id === diana.id) {
      console.log(`   FAIL: Diana's new ID matches source (should be different copy)`);
      idPass = false;
    }
    if (idPass) {
      console.log(`   PASS: New members have unique IDs (confirmed copies, not moves)`);
    }

    console.log("\n9. VERIFYING ROOT MEMBER MAPPING...");
    const refreshedNewTree = await storage.getTree(newTree.id);
    let rootPass = true;
    if (!refreshedNewTree?.rootMemberId) {
      console.log(`   FAIL: New tree has no rootMemberId`);
      rootPass = false;
    } else if (refreshedNewTree.rootMemberId === charlie.id) {
      console.log(`   FAIL: rootMemberId still points to source Charlie (${charlie.id}), not the copy`);
      rootPass = false;
    } else if (newCharlie && refreshedNewTree.rootMemberId === newCharlie.id) {
      console.log(`   PASS: rootMemberId correctly mapped to new Charlie (${newCharlie.id})`);
    } else {
      console.log(`   WARN: rootMemberId is ${refreshedNewTree.rootMemberId}, expected ${newCharlie?.id}`);
      rootPass = false;
    }

    console.log("\n10. VERIFYING NEW RELATIONSHIPS REFERENCE NEW IDs...");
    let relIdPass = true;
    for (const rel of newRels) {
      const fromInNew = newMembers.some(m => m.id === rel.fromMemberId);
      const toInNew = newMembers.some(m => m.id === rel.toMemberId);
      if (!fromInNew || !toInNew) {
        console.log(`   FAIL: Relationship references member not in new tree: from=${rel.fromMemberId}, to=${rel.toMemberId}`);
        relIdPass = false;
      }
    }
    if (relIdPass) {
      console.log(`   PASS: All relationships in new tree reference new member IDs`);
    }

    console.log("\n=== TEST SUMMARY ===");
    const allPassed = sourcePass && newPass && idPass && rootPass && relIdPass;
    if (allPassed) {
      console.log("ALL TESTS PASSED");
    } else {
      console.log("SOME TESTS FAILED - see details above");
    }

  } catch (error) {
    console.error("\nTEST ERROR:", error);
  } finally {
    console.log("\nCleaning up test data...");
    await cleanup(createdTreeIds);
    console.log("Done.");
    process.exit(0);
  }
}

runTest();
