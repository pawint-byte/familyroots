export type TreeType = "family" | "church" | "sports" | "fraternity" | "friends" | "professional" | "custom";

export type LayoutShape = "tree" | "circle" | "radial" | "grid" | "top-grid" | "arc" | "network";

export type LineStyle = "solid" | "dashed" | "dotted";

export interface TreeVisualConfig {
  layoutShape: LayoutShape;
  accentColor: string;
  accentColorLight: string;
  lineStyle: LineStyle;
  lineColor: string;
  nodeShape: "rounded" | "circle" | "hexagon";
  shapeName: string;
}

export interface RelationshipTypeConfig {
  value: string;
  label: string;
  reverseLabel?: string;
  description?: string;
  rank?: number;
}

export interface TreeTypeConfig {
  type: TreeType;
  label: string;
  description: string;
  icon: string;
  memberLabel: string;
  membersLabel: string;
  addMemberLabel: string;
  defaultRelationshipTypes: RelationshipTypeConfig[];
  qualifiersEnabled: boolean;
  qualifiers?: { value: string; label: string }[];
  qualifierLabel?: string;
  qualifierPlaceholder?: string;
  visual: TreeVisualConfig;
}

export const TREE_TYPE_CONFIGS: Record<TreeType, TreeTypeConfig> = {
  family: {
    type: "family",
    label: "Family Tree",
    description: "Track your blood relatives, in-laws, and extended family connections",
    icon: "Users",
    memberLabel: "Family Member",
    membersLabel: "Family Members",
    addMemberLabel: "Add Family Member",
    qualifiersEnabled: true,
    qualifierLabel: "Relationship Qualifier",
    qualifierPlaceholder: "Biological (default)",
    qualifiers: [
      { value: "biological", label: "Biological (default)" },
      { value: "step", label: "Step" },
      { value: "adopted", label: "Adopted" },
      { value: "foster", label: "Foster" },
      { value: "half", label: "Half (shares one parent)" },
      { value: "in-law", label: "In-Law" },
    ],
    defaultRelationshipTypes: [
      { value: "parent", label: "Parent", reverseLabel: "Child", description: "Parent/child relationship" },
      { value: "child", label: "Child", reverseLabel: "Parent", description: "Child/parent relationship" },
      { value: "spouse", label: "Spouse/Partner", description: "Marriage or partnership" },
      { value: "sibling", label: "Sibling", description: "Brother/sister relationship" },
      { value: "coparent", label: "Co-Parent", description: "Shares a child, not married" },
    ],
    visual: {
      layoutShape: "tree",
      accentColor: "hsl(142 60% 45%)",
      accentColorLight: "hsl(142 60% 90%)",
      lineStyle: "solid",
      lineColor: "hsl(142 60% 45%)",
      nodeShape: "rounded",
      shapeName: "Family Tree",
    },
  },
  church: {
    type: "church",
    label: "Church / Faith Group",
    description: "Organize your congregation, ministries, and faith community",
    icon: "Church",
    memberLabel: "Member",
    membersLabel: "Members",
    addMemberLabel: "Add Member",
    qualifiersEnabled: true,
    qualifierLabel: "Ministry / Group",
    qualifierPlaceholder: "Select ministry or group",
    qualifiers: [
      { value: "general", label: "General Congregation" },
      { value: "youth", label: "Youth Ministry" },
      { value: "worship", label: "Worship Team" },
      { value: "outreach", label: "Outreach / Missions" },
      { value: "sunday_school", label: "Sunday School" },
      { value: "bible_study", label: "Bible Study" },
      { value: "choir", label: "Choir" },
      { value: "volunteer", label: "Volunteer" },
    ],
    defaultRelationshipTypes: [
      { value: "pastor", label: "Pastor/Leader", reverseLabel: "Congregation Member", description: "Pastoral leadership", rank: 1 },
      { value: "elder", label: "Elder/Deacon", description: "Church leadership role", rank: 2 },
      { value: "worship_leader", label: "Worship Leader", description: "Leads worship services", rank: 2 },
      { value: "ministry_leader", label: "Ministry Leader", reverseLabel: "Ministry Member", description: "Leads a ministry or group", rank: 2 },
      { value: "teacher", label: "Teacher", reverseLabel: "Student", description: "Teaches classes or groups", rank: 2 },
      { value: "member", label: "Congregation Member", description: "General member", rank: 3 },
      { value: "ministry_member", label: "Ministry Member", reverseLabel: "Ministry Leader", description: "Participates in a ministry", rank: 3 },
      { value: "student", label: "Student", reverseLabel: "Teacher", description: "Attends classes or groups", rank: 3 },
      { value: "volunteer", label: "Volunteer", description: "Serves in a volunteer role", rank: 3 },
      { value: "mentor", label: "Mentor", reverseLabel: "Mentee", description: "Spiritual mentorship" },
      { value: "mentee", label: "Mentee", reverseLabel: "Mentor", description: "Being mentored" },
      { value: "prayer_partner", label: "Prayer Partner", description: "Paired for prayer and support" },
      { value: "friend", label: "Friend", description: "Personal friendship within the community" },
    ],
    visual: {
      layoutShape: "radial",
      accentColor: "hsl(265 60% 55%)",
      accentColorLight: "hsl(265 60% 92%)",
      lineStyle: "solid",
      lineColor: "hsl(265 60% 55%)",
      nodeShape: "rounded",
      shapeName: "Faith Constellation",
    },
  },
  sports: {
    type: "sports",
    label: "Sports Team",
    description: "Manage your team roster, coaching staff, and alumni connections",
    icon: "Trophy",
    memberLabel: "Team Member",
    membersLabel: "Team Members",
    addMemberLabel: "Add Team Member",
    qualifiersEnabled: true,
    qualifierLabel: "Role Detail",
    qualifierPlaceholder: "Select position or status",
    qualifiers: [
      { value: "starter", label: "Starter" },
      { value: "reserve", label: "Reserve / Bench" },
      { value: "varsity", label: "Varsity" },
      { value: "jv", label: "Junior Varsity (JV)" },
      { value: "injured", label: "Injured Reserve" },
      { value: "retired", label: "Retired" },
    ],
    defaultRelationshipTypes: [
      { value: "coach", label: "Head Coach", reverseLabel: "Player", description: "Head coach of the team", rank: 1 },
      { value: "assistant_coach", label: "Assistant Coach", reverseLabel: "Player", description: "Assistant or position coach", rank: 2 },
      { value: "captain", label: "Captain", description: "Team captain", rank: 2 },
      { value: "trainer", label: "Trainer/Physio", description: "Athletic trainer or physiotherapist", rank: 2 },
      { value: "manager", label: "Manager/Staff", description: "Team management or support staff", rank: 2 },
      { value: "player", label: "Player", reverseLabel: "Head Coach", description: "Active player on roster", rank: 3 },
      { value: "teammate", label: "Teammate", description: "Fellow team member", rank: 3 },
      { value: "alumni", label: "Alumni", description: "Former team member", rank: 3 },
      { value: "best_friend", label: "Best Friend", description: "Closest friend on the team" },
      { value: "friend", label: "Friend", description: "Friends on and off the field" },
      { value: "rival", label: "Rival", description: "Friendly competition or rival" },
      { value: "training_partner", label: "Training Partner", description: "Regular workout or practice partner" },
    ],
    visual: {
      layoutShape: "top-grid",
      accentColor: "hsl(25 90% 55%)",
      accentColorLight: "hsl(25 90% 92%)",
      lineStyle: "solid",
      lineColor: "hsl(25 90% 55%)",
      nodeShape: "rounded",
      shapeName: "Team Formation",
    },
  },
  fraternity: {
    type: "fraternity",
    label: "Fraternity / Sorority",
    description: "Connect your chapter members, pledge classes, and alumni network",
    icon: "GraduationCap",
    memberLabel: "Member",
    membersLabel: "Members",
    addMemberLabel: "Add Member",
    qualifiersEnabled: true,
    qualifierLabel: "Class / Status",
    qualifierPlaceholder: "Select class year or status",
    qualifiers: [
      { value: "active", label: "Active" },
      { value: "pledge", label: "Pledge / New Member" },
      { value: "alumni", label: "Alumni" },
      { value: "class_2024", label: "Class of 2024" },
      { value: "class_2025", label: "Class of 2025" },
      { value: "class_2026", label: "Class of 2026" },
      { value: "class_2027", label: "Class of 2027" },
      { value: "class_2028", label: "Class of 2028" },
      { value: "class_2029", label: "Class of 2029" },
      { value: "class_2030", label: "Class of 2030" },
      { value: "honorary", label: "Honorary Member" },
    ],
    defaultRelationshipTypes: [
      { value: "chapter_president", label: "Chapter President", description: "Chapter leadership", rank: 1 },
      { value: "advisor", label: "Faculty Advisor", reverseLabel: "Active Member", description: "Faculty or alumni advisor", rank: 1 },
      { value: "officer", label: "Officer", description: "Elected or appointed officer", rank: 2 },
      { value: "big", label: "Big (Mentor)", reverseLabel: "Little", description: "Big brother/sister mentor" },
      { value: "little", label: "Little (Mentee)", reverseLabel: "Big", description: "Little brother/sister mentee" },
      { value: "pledge_class", label: "Pledge Class", description: "Same pledge/initiation class" },
      { value: "active", label: "Active Member", description: "Current active member", rank: 3 },
      { value: "alumni", label: "Alumni", description: "Graduated alumni", rank: 3 },
      { value: "best_friend", label: "Best Friend", description: "Closest friend in the chapter" },
      { value: "friend", label: "Friend", description: "Personal friendship" },
      { value: "study_partner", label: "Study Partner", description: "Regular study buddy" },
      { value: "roommate", label: "Roommate", description: "Current or former roommate" },
    ],
    visual: {
      layoutShape: "arc",
      accentColor: "hsl(340 75% 55%)",
      accentColorLight: "hsl(340 75% 92%)",
      lineStyle: "solid",
      lineColor: "hsl(340 75% 55%)",
      nodeShape: "rounded",
      shapeName: "Chapter Chain",
    },
  },
  friends: {
    type: "friends",
    label: "Friend Circle",
    description: "Map your friend groups, roommates, and social connections",
    icon: "Heart",
    memberLabel: "Friend",
    membersLabel: "Friends",
    addMemberLabel: "Add Friend",
    qualifiersEnabled: true,
    qualifierLabel: "How You Met",
    qualifierPlaceholder: "Select how you know each other",
    qualifiers: [
      { value: "school", label: "School / College" },
      { value: "work", label: "Work" },
      { value: "neighborhood", label: "Neighborhood" },
      { value: "online", label: "Online / Social Media" },
      { value: "sports_rec", label: "Sports / Recreation" },
      { value: "mutual_friend", label: "Through Mutual Friends" },
      { value: "childhood", label: "Childhood" },
    ],
    defaultRelationshipTypes: [
      { value: "best_friend", label: "Best Friend", description: "Closest friend" },
      { value: "close_friend", label: "Close Friend", description: "Inner circle friend" },
      { value: "friend", label: "Friend", description: "General friend" },
      { value: "roommate", label: "Roommate", description: "Current or former roommate" },
      { value: "neighbor", label: "Neighbor", description: "Lives nearby" },
      { value: "acquaintance", label: "Acquaintance", description: "Casual connection" },
      { value: "study_partner", label: "Study Partner", description: "Regular study buddy" },
      { value: "travel_buddy", label: "Travel Buddy", description: "Travel companion" },
    ],
    visual: {
      layoutShape: "circle",
      accentColor: "hsl(200 80% 50%)",
      accentColorLight: "hsl(200 80% 92%)",
      lineStyle: "dashed",
      lineColor: "hsl(200 80% 50%)",
      nodeShape: "circle",
      shapeName: "Friend Circle",
    },
  },
  professional: {
    type: "professional",
    label: "Professional Network",
    description: "Track your colleagues, mentors, and professional relationships",
    icon: "Briefcase",
    memberLabel: "Contact",
    membersLabel: "Contacts",
    addMemberLabel: "Add Contact",
    qualifiersEnabled: true,
    qualifierLabel: "Department / Context",
    qualifierPlaceholder: "Select department or context",
    qualifiers: [
      { value: "engineering", label: "Engineering" },
      { value: "design", label: "Design" },
      { value: "marketing", label: "Marketing" },
      { value: "sales", label: "Sales" },
      { value: "operations", label: "Operations" },
      { value: "hr", label: "Human Resources" },
      { value: "finance", label: "Finance" },
      { value: "executive", label: "Executive / Leadership" },
      { value: "external", label: "External / Vendor" },
    ],
    defaultRelationshipTypes: [
      { value: "manager", label: "Manager", reverseLabel: "Direct Report", description: "Direct supervisor", rank: 1 },
      { value: "supervisor", label: "Supervisor", reverseLabel: "Intern", description: "Oversees intern or trainee", rank: 1 },
      { value: "mentor", label: "Mentor", reverseLabel: "Mentee", description: "Professional mentor", rank: 2 },
      { value: "direct_report", label: "Direct Report", reverseLabel: "Manager", description: "Reports to you", rank: 3 },
      { value: "colleague", label: "Colleague", description: "Same team or department", rank: 3 },
      { value: "mentee", label: "Mentee", reverseLabel: "Mentor", description: "Being mentored", rank: 3 },
      { value: "intern", label: "Intern", reverseLabel: "Supervisor", description: "Intern or trainee", rank: 3 },
      { value: "client", label: "Client", description: "Business client" },
      { value: "partner", label: "Business Partner", description: "Business partnership" },
      { value: "friend", label: "Work Friend", description: "Personal friendship at work" },
    ],
    visual: {
      layoutShape: "network",
      accentColor: "hsl(210 70% 50%)",
      accentColorLight: "hsl(210 70% 92%)",
      lineStyle: "dotted",
      lineColor: "hsl(210 70% 50%)",
      nodeShape: "rounded",
      shapeName: "Professional Network",
    },
  },
  custom: {
    type: "custom",
    label: "Custom Group",
    description: "Create your own group type with custom relationships",
    icon: "Sparkles",
    memberLabel: "Member",
    membersLabel: "Members",
    addMemberLabel: "Add Member",
    qualifiersEnabled: true,
    qualifierLabel: "Tag / Detail",
    qualifierPlaceholder: "Select a tag",
    qualifiers: [
      { value: "founding", label: "Founding Member" },
      { value: "new", label: "New Member" },
      { value: "inactive", label: "Inactive" },
      { value: "honorary", label: "Honorary" },
    ],
    defaultRelationshipTypes: [
      { value: "leader", label: "Leader", reverseLabel: "Member", description: "Group leader or organizer", rank: 1 },
      { value: "co_leader", label: "Co-Leader", description: "Assists the leader", rank: 2 },
      { value: "teacher", label: "Teacher", reverseLabel: "Student", description: "Teaches or instructs", rank: 1 },
      { value: "student", label: "Student", reverseLabel: "Teacher", description: "Learns from a teacher", rank: 3 },
      { value: "member", label: "Member", description: "Group member", rank: 3 },
      { value: "mentor", label: "Mentor", reverseLabel: "Mentee", description: "Guides or advises" },
      { value: "mentee", label: "Mentee", reverseLabel: "Mentor", description: "Receives guidance" },
      { value: "connected", label: "Connected", description: "General connection" },
      { value: "best_friend", label: "Best Friend", description: "Closest friend in the group" },
      { value: "friend", label: "Friend", description: "Personal friendship" },
      { value: "study_partner", label: "Study Partner", description: "Regular study buddy" },
    ],
    visual: {
      layoutShape: "circle",
      accentColor: "hsl(170 60% 45%)",
      accentColorLight: "hsl(170 60% 92%)",
      lineStyle: "dashed",
      lineColor: "hsl(170 60% 45%)",
      nodeShape: "rounded",
      shapeName: "Custom Circle",
    },
  },
};

export function getTreeTypeConfig(treeType: TreeType): TreeTypeConfig {
  return TREE_TYPE_CONFIGS[treeType] || TREE_TYPE_CONFIGS.family;
}

export function getRelationshipTypesForTree(
  treeType: TreeType,
  customRelationshipTypes?: string[] | null
): RelationshipTypeConfig[] {
  const config = getTreeTypeConfig(treeType);
  const defaults = config.defaultRelationshipTypes;

  if (customRelationshipTypes && customRelationshipTypes.length > 0) {
    const customTypes = customRelationshipTypes.map(t => ({
      value: t.toLowerCase().replace(/\s+/g, '_'),
      label: t,
      description: `Custom: ${t}`,
    }));

    if (treeType === "custom") {
      return customTypes;
    }

    const existingValues = new Set(defaults.map(d => d.value));
    const newTypes = customTypes.filter(ct => !existingValues.has(ct.value));
    return [...defaults, ...newTypes];
  }

  return defaults;
}

export function getValidRelationshipValues(
  treeType: TreeType,
  customRelationshipTypes?: string[] | null
): string[] {
  return getRelationshipTypesForTree(treeType, customRelationshipTypes).map(r => r.value);
}

export function getReverseRelationshipType(
  treeType: TreeType,
  relationshipType: string,
  customRelationshipTypes?: string[] | null
): string | null {
  const types = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  const config = types.find(t => t.value === relationshipType);
  if (!config) return null;
  
  if (!config.reverseLabel) {
    return relationshipType;
  }
  
  const reverseConfig = types.find(t => t.label === config.reverseLabel);
  if (reverseConfig) {
    return reverseConfig.value;
  }
  
  return relationshipType;
}

export function getRelationshipRank(
  treeType: TreeType,
  relationshipType: string,
  customRelationshipTypes?: string[] | null
): number {
  const types = getRelationshipTypesForTree(treeType, customRelationshipTypes);
  const config = types.find(t => t.value === relationshipType);
  return config?.rank || 3;
}

export function getMemberRank(
  memberId: string,
  relationships: { fromMemberId: string; toMemberId: string; relationshipType: string }[],
  treeType: TreeType,
  customRelationshipTypes?: string[] | null
): number {
  let bestRank = 3;
  for (const rel of relationships) {
    if (rel.fromMemberId === memberId || rel.toMemberId === memberId) {
      const rank = getRelationshipRank(treeType, rel.relationshipType, customRelationshipTypes);
      if (rank < bestRank) bestRank = rank;
    }
  }
  return bestRank;
}

export function getDefaultPeerRelationship(treeType: TreeType): string {
  const peerMap: Record<TreeType, string> = {
    family: "sibling",
    church: "member",
    sports: "teammate",
    fraternity: "active",
    friends: "friend",
    professional: "colleague",
    custom: "member",
  };
  return peerMap[treeType] || "member";
}

export function getDefaultLeaderRelationship(treeType: TreeType): { leaderType: string; memberType: string } | null {
  const leaderMap: Record<TreeType, { leaderType: string; memberType: string } | null> = {
    family: null,
    church: { leaderType: "pastor", memberType: "member" },
    sports: { leaderType: "coach", memberType: "player" },
    fraternity: { leaderType: "chapter_president", memberType: "active" },
    friends: null,
    professional: { leaderType: "manager", memberType: "direct_report" },
    custom: { leaderType: "leader", memberType: "member" },
  };
  return leaderMap[treeType] || null;
}
