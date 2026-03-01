import { db } from "./db";
import { familyTrees, familyMembers, relationships as relationshipsTable, giftRegistries, familyEvents } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { log } from "./index";

const MIGRATION_KEY = "prod_data_consolidation_v1";
const OWNER_ID = "52852375";
const MAIN_TREE_ID = "526dab60-90d1-486a-9c31-1e24a5d29da4";
const ASHLEY_WEST_TREE_ID = "39b0b70c-d09f-4c6f-98e3-61f8456971bb";

const PROD_TREE_ID = "ea2f35fe-9da5-4790-87a1-cfeb2f5e83bd";
const PROD_SR_TREE_ID = "8d9a8117-77c2-4644-a9d4-9b4da4909e78";

interface MemberData {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  gender?: string | null;
  email?: string | null;
  nickname?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
}

const CONSOLIDATED_MEMBERS: MemberData[] = [
  { firstName: "Peter", lastName: "Wint", birthDate: "1971-06-04", birthPlace: "Brooklyn, New York City, New York", gender: "male", email: "pawint@me.com", nickname: "Godfather", photoUrl: "/objects/uploads/ea68ae07-af0b-4e0c-9006-b05b09006f7f" },
  { firstName: "Agatha", lastName: "Wint", birthDate: "1941-09-25", birthPlace: "Manchester, Jamaica", gender: "female", nickname: "Grandma", photoUrl: "/objects/uploads/d7e80bc1-2c93-4b33-a021-40d66fd01adc" },
  { firstName: "Pierre", lastName: "Hodge", birthDate: "1938-05-21", birthPlace: "Guadeloupe", deathDate: "1988-01-01", gender: "male", nickname: "Peter", photoUrl: "/objects/uploads/f093dd6b-9285-4beb-849f-7c748ef73171" },
  { firstName: "Jacob Aquilla", lastName: "Wint", birthDate: "1913-04-16", birthPlace: "Manchester, Jamaica", deathDate: "1986-08-09", gender: "male", nickname: "Grandpa", notes: "Born Jacob Aquilla Wint. Married Daphne Mildred Dalvalley." },
  { firstName: "Daphne Mildred", lastName: "Wint", gender: "female", nickname: "née Dalvalley" },
  { firstName: "Jacob Farquherson", lastName: "Wint", gender: "male" },
  { firstName: "Helen Louisa", lastName: "Steadman", gender: "female" },
  { firstName: "James", lastName: "Hodge (Fleming)", birthDate: "1900-09-25", birthPlace: "Sandy Hill, Spring Division, Anguilla", deathDate: "1945-04-09", gender: "male" },
  { firstName: "James", lastName: "Wint", gender: "male" },
  { firstName: "Henry", lastName: "Steadman", gender: "male" },
  { firstName: "Alfred", lastName: "Delvaille", gender: "male" },
  { firstName: "Leonie", lastName: "Gunbs", gender: "female" },
  { firstName: "Adriana", lastName: "Wint", birthDate: "1907-12-04", birthPlace: "Keynsham, Manchester, Jamaica", gender: "female" },
  { firstName: "Karen", lastName: "Simpson", birthDate: "1963-11-14", birthPlace: "Jamaica", deathDate: "1999-11-05", gender: "female", nickname: "Bull", photoUrl: "/objects/uploads/2716275f-e840-406d-a63f-d7bba19a002e" },
  { firstName: "Anne-Marie", lastName: "Wint", birthDate: "1970-06-20", birthPlace: "New York, USA", gender: "female", email: "annemariewint@yahoo.com", nickname: "Anne" },
  { firstName: "Joan", lastName: "Bynum", birthDate: "1962-03-03", birthPlace: "Jamaica", gender: "female", email: "jebynum_03@yahoo.com", nickname: "Marr" },
  { firstName: "Pamella", lastName: "Adamson", birthDate: "1965-03-18", birthPlace: "Jamaica", gender: "female", email: "pamelladamson@hotmail.com", nickname: "Pam" },
  { firstName: "Duncan", lastName: "Ceforth Wint", birthDate: "1940-01-01", birthPlace: "Manchester, Jamaica", deathDate: "2014-01-01", gender: "male" },
  { firstName: "Robert", lastName: "Simms", birthDate: "1952-01-01", birthPlace: "Jamaica", gender: "male", email: "robertsimms1520@gmail.com", nickname: "Mr. Simms" },
  { firstName: "Pamella", lastName: "Burke", birthDate: "1974-05-13", birthPlace: "Jamaica", gender: "female", email: "pella_b@yahoo.com", nickname: "Pam" },
  { firstName: "Lisa", lastName: "Beaumont", birthDate: "1978-01-27", gender: "female", email: "holly362438@aol.com", nickname: "Holly" },
  { firstName: "Apryl", lastName: "Sneed", birthDate: "1972-04-18", birthPlace: "USA", gender: "female", email: "adsneed@aol.com", nickname: "Delene", photoUrl: "/objects/uploads/f13e444d-9bd9-4bbc-9a6d-e849d8f7b71a" },
  { firstName: "Peter A", lastName: "Wint Jr", birthDate: "2010-06-15", birthPlace: "Hackensack, New Jersey", gender: "male", email: "peterawintjr@gmail.com", nickname: "JR", photoUrl: "/objects/uploads/69d254e7-2156-4552-a8e0-816b0231edf7" },
  { firstName: "Alaprentia", lastName: "Sneed-Wint", birthDate: "2006-03-24", birthPlace: "Livingston, New Jersey", gender: "female", email: "apwin2210@icloud.com", nickname: "AP", photoUrl: "/objects/uploads/2d322ea5-34e4-4516-a633-d062ad6cee84" },
  { firstName: "Victoria", lastName: "Wint", birthDate: "2008-08-26", birthPlace: "New Jersey", gender: "female", email: "mvp.vicky88@gmail.com", nickname: "Vicky", photoUrl: "/objects/uploads/6914cb02-cfc4-4fe1-b22a-dc84ad7d7c8c" },
];

type RelDef = [string, string, string, string | null];

const RELATIONSHIP_DEFS: RelDef[] = [
  ["Peter|Wint", "Agatha|Wint", "child", null],
  ["Agatha|Wint", "Peter|Wint", "parent", null],
  ["Peter|Wint", "Pierre|Hodge", "child", null],
  ["Pierre|Hodge", "Peter|Wint", "parent", null],
  ["Agatha|Wint", "Pierre|Hodge", "spouse", null],
  ["Pierre|Hodge", "Agatha|Wint", "spouse", null],
  ["Agatha|Wint", "Jacob Aquilla|Wint", "child", null],
  ["Jacob Aquilla|Wint", "Agatha|Wint", "parent", null],
  ["Agatha|Wint", "Daphne Mildred|Wint", "child", null],
  ["Daphne Mildred|Wint", "Agatha|Wint", "parent", null],
  ["Jacob Aquilla|Wint", "Daphne Mildred|Wint", "spouse", null],
  ["Daphne Mildred|Wint", "Jacob Aquilla|Wint", "spouse", null],
  ["Jacob Aquilla|Wint", "Jacob Farquherson|Wint", "child", null],
  ["Jacob Farquherson|Wint", "Jacob Aquilla|Wint", "parent", null],
  ["Jacob Aquilla|Wint", "Helen Louisa|Steadman", "child", null],
  ["Helen Louisa|Steadman", "Jacob Aquilla|Wint", "parent", null],
  ["Jacob Farquherson|Wint", "Helen Louisa|Steadman", "spouse", null],
  ["Helen Louisa|Steadman", "Jacob Farquherson|Wint", "spouse", null],
  ["Jacob Farquherson|Wint", "James|Wint", "child", null],
  ["James|Wint", "Jacob Farquherson|Wint", "parent", null],
  ["Helen Louisa|Steadman", "Henry|Steadman", "child", null],
  ["Henry|Steadman", "Helen Louisa|Steadman", "parent", null],
  ["Daphne Mildred|Wint", "Alfred|Delvaille", "child", null],
  ["Alfred|Delvaille", "Daphne Mildred|Wint", "parent", null],
  ["Pierre|Hodge", "James|Hodge (Fleming)", "child", null],
  ["James|Hodge (Fleming)", "Pierre|Hodge", "parent", null],
  ["Pierre|Hodge", "Leonie|Gunbs", "child", null],
  ["Leonie|Gunbs", "Pierre|Hodge", "parent", null],
  ["James|Hodge (Fleming)", "Leonie|Gunbs", "spouse", null],
  ["Leonie|Gunbs", "James|Hodge (Fleming)", "spouse", null],
  ["Adriana|Wint", "Jacob Aquilla|Wint", "sibling", null],
  ["Jacob Aquilla|Wint", "Adriana|Wint", "sibling", null],
  ["Peter|Wint", "Pamella|Burke", "co-parent", null],
  ["Pamella|Burke", "Peter|Wint", "co-parent", null],
  ["Peter|Wint", "Lisa|Beaumont", "co-parent", null],
  ["Lisa|Beaumont", "Peter|Wint", "co-parent", null],
  ["Peter|Wint", "Apryl|Sneed", "co-parent", null],
  ["Apryl|Sneed", "Peter|Wint", "co-parent", null],
  ["Peter|Wint", "Peter A|Wint Jr", "parent", "biological"],
  ["Peter A|Wint Jr", "Peter|Wint", "child", "biological"],
  ["Pamella|Burke", "Peter A|Wint Jr", "parent", "biological"],
  ["Peter A|Wint Jr", "Pamella|Burke", "child", "biological"],
  ["Peter|Wint", "Alaprentia|Sneed-Wint", "parent", "biological"],
  ["Alaprentia|Sneed-Wint", "Peter|Wint", "child", "biological"],
  ["Apryl|Sneed", "Alaprentia|Sneed-Wint", "parent", "biological"],
  ["Alaprentia|Sneed-Wint", "Apryl|Sneed", "child", "biological"],
  ["Peter|Wint", "Victoria|Wint", "parent", "biological"],
  ["Victoria|Wint", "Peter|Wint", "child", "biological"],
  ["Lisa|Beaumont", "Victoria|Wint", "parent", "biological"],
  ["Victoria|Wint", "Lisa|Beaumont", "child", "biological"],
  ["Peter A|Wint Jr", "Alaprentia|Sneed-Wint", "sibling", "half"],
  ["Alaprentia|Sneed-Wint", "Peter A|Wint Jr", "sibling", "half"],
  ["Peter A|Wint Jr", "Victoria|Wint", "sibling", "half"],
  ["Victoria|Wint", "Peter A|Wint Jr", "sibling", "half"],
  ["Alaprentia|Sneed-Wint", "Victoria|Wint", "sibling", "half"],
  ["Victoria|Wint", "Alaprentia|Sneed-Wint", "sibling", "half"],
  ["Karen|Simpson", "Agatha|Wint", "child", null],
  ["Agatha|Wint", "Karen|Simpson", "parent", null],
  ["Karen|Simpson", "Peter|Wint", "sibling", null],
  ["Peter|Wint", "Karen|Simpson", "sibling", null],
  ["Anne-Marie|Wint", "Agatha|Wint", "child", null],
  ["Agatha|Wint", "Anne-Marie|Wint", "parent", null],
  ["Anne-Marie|Wint", "Peter|Wint", "sibling", null],
  ["Peter|Wint", "Anne-Marie|Wint", "sibling", null],
  ["Joan|Bynum", "Agatha|Wint", "child", null],
  ["Agatha|Wint", "Joan|Bynum", "parent", null],
  ["Joan|Bynum", "Peter|Wint", "sibling", null],
  ["Peter|Wint", "Joan|Bynum", "sibling", null],
  ["Pamella|Adamson", "Agatha|Wint", "child", null],
  ["Agatha|Wint", "Pamella|Adamson", "parent", null],
  ["Pamella|Adamson", "Peter|Wint", "sibling", null],
  ["Peter|Wint", "Pamella|Adamson", "sibling", null],
  ["Duncan|Ceforth Wint", "Agatha|Wint", "sibling", null],
  ["Agatha|Wint", "Duncan|Ceforth Wint", "sibling", null],
  ["Robert|Simms", "Agatha|Wint", "spouse", null],
  ["Agatha|Wint", "Robert|Simms", "spouse", null],
];

export async function runProdDataMigration() {
  try {
    const [existing] = await db.select().from(familyTrees).where(eq(familyTrees.id, MAIN_TREE_ID));
    
    if (existing) {
      log(`[migration] Main tree ${MAIN_TREE_ID} already exists, skipping migration`, "migration");
      
      const members = await db.select().from(familyMembers)
        .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));
      
      if (members.length >= 25) {
        log(`[migration] Tree has ${members.length} members, data looks complete`, "migration");
        await restoreSplitMembers();
        return;
      }
      
      log(`[migration] Tree has ${members.length} members, needs update`, "migration");
    } else {
      log(`[migration] Creating main tree...`, "migration");
      await db.insert(familyTrees).values({
        id: MAIN_TREE_ID,
        name: "Peter Wint",
        ownerId: OWNER_ID,
        treeType: "family",
      });
    }

    const existingMembers = await db.select().from(familyMembers)
      .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));
    
    const memberIdMap = new Map<string, string>();

    for (const mem of CONSOLIDATED_MEMBERS) {
      const key = `${mem.firstName}|${mem.lastName}`;
      const existingMem = existingMembers.find(
        e => e.firstName === mem.firstName && e.lastName === mem.lastName
      );

      if (existingMem) {
        const updates: any = {};
        if (mem.birthDate && !existingMem.birthDate) updates.birthDate = mem.birthDate;
        if (mem.birthPlace && !existingMem.birthPlace) updates.birthPlace = mem.birthPlace;
        if (mem.deathDate && !existingMem.deathDate) updates.deathDate = mem.deathDate;
        if (mem.email && !existingMem.email) updates.email = mem.email;
        if (mem.nickname && !existingMem.nickname) updates.nickname = mem.nickname;
        if (mem.photoUrl && !existingMem.photoUrl) updates.photoUrl = mem.photoUrl;
        if (mem.notes && !existingMem.notes) updates.notes = mem.notes;

        if (Object.keys(updates).length > 0) {
          await db.update(familyMembers).set(updates).where(eq(familyMembers.id, existingMem.id));
          log(`[migration] Updated ${mem.firstName} ${mem.lastName}`, "migration");
        }
        memberIdMap.set(key, existingMem.id);
      } else {
        const newId = crypto.randomUUID();
        await db.insert(familyMembers).values({
          id: newId,
          treeId: MAIN_TREE_ID,
          firstName: mem.firstName,
          lastName: mem.lastName,
          birthDate: mem.birthDate || null,
          birthPlace: mem.birthPlace || null,
          deathDate: mem.deathDate || null,
          gender: mem.gender || null,
          email: mem.email || null,
          nickname: mem.nickname || null,
          photoUrl: mem.photoUrl || null,
          notes: mem.notes || null,
        });
        memberIdMap.set(key, newId);
        log(`[migration] Added ${mem.firstName} ${mem.lastName}`, "migration");
      }
    }

    const peterMemberId = memberIdMap.get("Peter|Wint");
    if (peterMemberId) {
      await db.update(familyMembers).set({
        claimedByUserId: OWNER_ID,
        claimedAt: new Date(),
      }).where(eq(familyMembers.id, peterMemberId));
    }

    await db.update(familyTrees).set({ rootMemberId: peterMemberId }).where(eq(familyTrees.id, MAIN_TREE_ID));

    const existingRels = await db.select().from(relationshipsTable)
      .where(and(eq(relationshipsTable.treeId, MAIN_TREE_ID), isNull(relationshipsTable.deletedAt)));

    for (const [fromKey, toKey, relType, qualifier] of RELATIONSHIP_DEFS) {
      const fromId = memberIdMap.get(fromKey);
      const toId = memberIdMap.get(toKey);
      if (!fromId || !toId) continue;

      const exists = existingRels.find(
        r => r.fromMemberId === fromId && r.toMemberId === toId && r.relationshipType === relType
      );
      if (exists) continue;

      await db.insert(relationshipsTable).values({
        id: crypto.randomUUID(),
        treeId: MAIN_TREE_ID,
        fromMemberId: fromId,
        toMemberId: toId,
        relationshipType: relType,
        qualifier: qualifier,
      });
    }

    if (peterMemberId) {
      const existingRegistry = await db.select().from(giftRegistries)
        .where(and(eq(giftRegistries.memberId, peterMemberId), eq(giftRegistries.treeId, MAIN_TREE_ID)));
      
      if (existingRegistry.length === 0) {
        await db.insert(giftRegistries).values({
          id: crypto.randomUUID(),
          memberId: peterMemberId,
          treeId: MAIN_TREE_ID,
          createdByUserId: OWNER_ID,
          title: "Birthday",
          eventType: "birthday",
          eventDate: "2026-06-04",
          description: "55",
          isPublic: true,
          isActive: true,
        });
        log(`[migration] Restored birthday gift registry`, "migration");
      }
    }

    const finalMembers = await db.select().from(familyMembers)
      .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));
    const finalRels = await db.select().from(relationshipsTable)
      .where(and(eq(relationshipsTable.treeId, MAIN_TREE_ID), isNull(relationshipsTable.deletedAt)));
    
    log(`[migration] Complete: ${finalMembers.length} members, ${finalRels.length} relationships`, "migration");

  } catch (error) {
    console.error("[migration] Error running production data migration:", error);
  }
}

async function restoreSplitMembers() {
  try {
    const [ashleyTree] = await db.select().from(familyTrees).where(eq(familyTrees.id, ASHLEY_WEST_TREE_ID));
    if (!ashleyTree) {
      log(`[migration] Ashley West tree not found, skipping restore`, "migration");
      return;
    }

    const mainMembers = await db.select().from(familyMembers)
      .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));
    const ashleyMembers = await db.select().from(familyMembers)
      .where(and(eq(familyMembers.treeId, ASHLEY_WEST_TREE_ID), isNull(familyMembers.deletedAt)));

    if (ashleyMembers.length === 0) {
      log(`[migration] Ashley West tree has no members, skipping restore`, "migration");
      return;
    }

    const mainNameSet = new Set(mainMembers.map(m => `${m.firstName}|${m.lastName}|${m.email || ''}`));

    const toRestore = ashleyMembers.filter(m => 
      !mainNameSet.has(`${m.firstName}|${m.lastName}|${m.email || ''}`)
    );

    if (toRestore.length === 0) {
      log(`[migration] All Ashley West members already in main tree, no restore needed`, "migration");
      return;
    }

    log(`[migration] Restoring ${toRestore.length} split members from Ashley West to main tree...`, "migration");

    const idMapping = new Map<string, string>();

    for (const m of toRestore) {
      const newId = crypto.randomUUID();
      await db.insert(familyMembers).values({
        id: newId,
        treeId: MAIN_TREE_ID,
        firstName: m.firstName,
        lastName: m.lastName,
        suffix: m.suffix,
        nickname: m.nickname,
        email: m.email,
        alternateEmail: m.alternateEmail,
        gender: m.gender,
        birthDate: m.birthDate,
        deathDate: m.deathDate,
        birthPlace: m.birthPlace,
        isLiving: m.isLiving,
        photoUrl: m.photoUrl,
        notes: m.notes,
        isUnknown: m.isUnknown,
        unknownLabel: m.unknownLabel,
        claimedByUserId: m.claimedByUserId,
        visibilityOverride: m.visibilityOverride,
        sharedInPool: m.sharedInPool,
        currentCity: m.currentCity,
        currentRegion: m.currentRegion,
        currentCountry: m.currentCountry,
        locationVisible: m.locationVisible,
      });
      idMapping.set(m.id, newId);
      log(`[migration] Restored ${m.firstName} ${m.lastName}`, "migration");
    }

    const ashleyRels = await db.select().from(relationshipsTable)
      .where(and(eq(relationshipsTable.treeId, ASHLEY_WEST_TREE_ID), isNull(relationshipsTable.deletedAt)));

    const mainMemberNameMap = new Map<string, string>();
    const refreshedMainMembers = await db.select().from(familyMembers)
      .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));
    for (const m of refreshedMainMembers) {
      mainMemberNameMap.set(`${m.firstName}|${m.lastName}`, m.id);
    }

    const ashleyIdToName = new Map<string, string>();
    for (const m of ashleyMembers) {
      ashleyIdToName.set(m.id, `${m.firstName}|${m.lastName}`);
    }

    let relsCreated = 0;
    for (const rel of ashleyRels) {
      const fromName = ashleyIdToName.get(rel.fromMemberId);
      const toName = ashleyIdToName.get(rel.toMemberId);
      if (!fromName || !toName) continue;

      const newFromId = idMapping.get(rel.fromMemberId) || mainMemberNameMap.get(fromName);
      const newToId = idMapping.get(rel.toMemberId) || mainMemberNameMap.get(toName);
      if (!newFromId || !newToId) continue;

      const existingRels = await db.select().from(relationshipsTable)
        .where(and(
          eq(relationshipsTable.treeId, MAIN_TREE_ID),
          eq(relationshipsTable.fromMemberId, newFromId),
          eq(relationshipsTable.toMemberId, newToId),
          eq(relationshipsTable.relationshipType, rel.relationshipType),
          isNull(relationshipsTable.deletedAt)
        ));

      if (existingRels.length === 0) {
        await db.insert(relationshipsTable).values({
          id: crypto.randomUUID(),
          treeId: MAIN_TREE_ID,
          fromMemberId: newFromId,
          toMemberId: newToId,
          relationshipType: rel.relationshipType,
          qualifier: rel.qualifier,
          customLabel: rel.customLabel,
        });
        relsCreated++;
      }
    }

    const ashleyEvents = await db.select().from(familyEvents)
      .where(eq(familyEvents.treeId, ASHLEY_WEST_TREE_ID));

    let eventsCopied = 0;
    for (const evt of ashleyEvents) {
      const newMemberId = idMapping.get(evt.memberId);
      if (newMemberId) {
        await db.insert(familyEvents).values({
          treeId: MAIN_TREE_ID,
          memberId: newMemberId,
          eventType: evt.eventType,
          eventDate: evt.eventDate,
          location: evt.location,
          description: evt.description,
        });
        eventsCopied++;
      }
    }

    const finalCount = await db.select({ count: sql`count(*)` }).from(familyMembers)
      .where(and(eq(familyMembers.treeId, MAIN_TREE_ID), isNull(familyMembers.deletedAt)));

    log(`[migration] Restore complete: ${toRestore.length} members, ${relsCreated} relationships, ${eventsCopied} events copied. Tree now has ${finalCount[0].count} members.`, "migration");

  } catch (error) {
    console.error("[migration] Error restoring split members:", error);
  }
}
