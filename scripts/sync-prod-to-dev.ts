/**
 * Production → Development Database Sync Script
 * 
 * ADDITIVE ONLY — never deletes dev data.
 * Inserts any records from production that don't already exist in dev.
 * Uses ON CONFLICT DO NOTHING so existing dev records are preserved.
 * 
 * Usage: Run via the agent's code execution environment using executeSql()
 * 
 * Tables synced (in order):
 *   1. family_trees
 *   2. family_members
 *   3. relationships
 *   4. family_events
 *   5. tree_tags / member_tags
 *   6. special_connections
 *   7. memories / voice_notes
 *   8. tree_collaborators / tree_connections
 *   9. name_history / education_history / career_history
 * 
 * Safety rules:
 *   - NEVER deletes existing dev records
 *   - Only inserts records that don't already exist (ON CONFLICT DO NOTHING)
 *   - Dev data is always preserved — production adds to it, never replaces it
 *   - Post-sync report shows what was added
 */

export const OWNER_ID = "52852375";

export const SYNC_TABLES = [
  "family_trees",
  "family_members", 
  "relationships",
  "family_events",
  "tree_tags",
  "member_tags",
  "special_connections",
  "memories",
  "voice_notes",
  "tree_collaborators",
  "tree_connections",
  "name_history",
  "education_history",
  "career_history",
] as const;

export function getTreeFilter(table: string): string {
  switch (table) {
    case "family_trees":
      return `owner_id = '${OWNER_ID}' AND deleted_at IS NULL`;
    case "family_members":
    case "relationships":
      return `deleted_at IS NULL AND tree_id IN (SELECT id FROM family_trees WHERE owner_id = '${OWNER_ID}' AND deleted_at IS NULL)`;
    case "family_events":
    case "tree_tags":
    case "member_tags":
    case "special_connections":
    case "memories":
    case "voice_notes":
    case "tree_collaborators":
      return `tree_id IN (SELECT id FROM family_trees WHERE owner_id = '${OWNER_ID}' AND deleted_at IS NULL)`;
    case "tree_connections":
      return `tree1_id IN (SELECT id FROM family_trees WHERE owner_id = '${OWNER_ID}' AND deleted_at IS NULL) OR tree2_id IN (SELECT id FROM family_trees WHERE owner_id = '${OWNER_ID}' AND deleted_at IS NULL)`;
    case "name_history":
    case "education_history":
    case "career_history":
      return `member_id IN (SELECT id FROM family_members WHERE deleted_at IS NULL AND tree_id IN (SELECT id FROM family_trees WHERE owner_id = '${OWNER_ID}' AND deleted_at IS NULL))`;
    default:
      return "1=0";
  }
}
