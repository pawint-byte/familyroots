export type TreeType = "family" | "church" | "sports" | "fraternity" | "friends" | "professional" | "custom";

export type LayoutShape = "tree" | "circle" | "radial" | "grid" | "arc" | "network";

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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "pastor", label: "Pastor/Leader", reverseLabel: "Congregation Member", description: "Pastoral leadership" },
      { value: "elder", label: "Elder/Deacon", description: "Church leadership role" },
      { value: "member", label: "Congregation Member", description: "General member" },
      { value: "ministry_leader", label: "Ministry Leader", reverseLabel: "Ministry Member", description: "Leads a ministry or group" },
      { value: "ministry_member", label: "Ministry Member", reverseLabel: "Ministry Leader", description: "Participates in a ministry" },
      { value: "mentor", label: "Mentor", reverseLabel: "Mentee", description: "Spiritual mentorship" },
      { value: "mentee", label: "Mentee", reverseLabel: "Mentor", description: "Being mentored" },
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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "coach", label: "Coach", reverseLabel: "Player", description: "Head or assistant coach" },
      { value: "captain", label: "Captain", description: "Team captain" },
      { value: "player", label: "Player", reverseLabel: "Coach", description: "Active player" },
      { value: "manager", label: "Manager/Staff", description: "Team management" },
      { value: "teammate", label: "Teammate", description: "Fellow team member" },
      { value: "alumni", label: "Alumni", description: "Former team member" },
    ],
    visual: {
      layoutShape: "grid",
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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "big", label: "Big (Mentor)", reverseLabel: "Little", description: "Big brother/sister mentor" },
      { value: "little", label: "Little (Mentee)", reverseLabel: "Big", description: "Little brother/sister mentee" },
      { value: "pledge_class", label: "Pledge Class", description: "Same pledge/initiation class" },
      { value: "chapter_president", label: "Chapter President", description: "Chapter leadership" },
      { value: "officer", label: "Officer", description: "Elected or appointed officer" },
      { value: "active", label: "Active Member", description: "Current active member" },
      { value: "alumni", label: "Alumni", description: "Graduated alumni" },
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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "best_friend", label: "Best Friend", description: "Closest friend" },
      { value: "close_friend", label: "Close Friend", description: "Inner circle friend" },
      { value: "friend", label: "Friend", description: "General friend" },
      { value: "roommate", label: "Roommate", description: "Current or former roommate" },
      { value: "neighbor", label: "Neighbor", description: "Lives nearby" },
      { value: "acquaintance", label: "Acquaintance", description: "Casual connection" },
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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "manager", label: "Manager", reverseLabel: "Direct Report", description: "Direct supervisor" },
      { value: "direct_report", label: "Direct Report", reverseLabel: "Manager", description: "Reports to you" },
      { value: "colleague", label: "Colleague", description: "Same team or department" },
      { value: "mentor", label: "Mentor", reverseLabel: "Mentee", description: "Professional mentor" },
      { value: "mentee", label: "Mentee", reverseLabel: "Mentor", description: "Being mentored" },
      { value: "client", label: "Client", description: "Business client" },
      { value: "partner", label: "Business Partner", description: "Business partnership" },
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
    qualifiersEnabled: false,
    defaultRelationshipTypes: [
      { value: "leader", label: "Leader", description: "Group leader" },
      { value: "member", label: "Member", description: "Group member" },
      { value: "connected", label: "Connected", description: "General connection" },
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
  if (treeType === "custom" && customRelationshipTypes && customRelationshipTypes.length > 0) {
    return customRelationshipTypes.map(t => ({
      value: t.toLowerCase().replace(/\s+/g, '_'),
      label: t,
      description: `Custom: ${t}`,
    }));
  }
  return config.defaultRelationshipTypes;
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
