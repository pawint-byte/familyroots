import type { FamilyMember, User } from "../schema";

export interface MergedMemberProfile {
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  birthPlace: string | null;
  photoUrl: string | null;
  notes: string | null;
  currentCity: string | null;
  currentRegion: string | null;
  currentCountry: string | null;
  locationVisible: boolean;
  
  _sourceInfo: {
    firstName: "user" | "tree";
    lastName: "user" | "tree";
    nickname: "user" | "tree";
    email: "user" | "tree";
    gender: "user" | "tree";
    birthDate: "user" | "tree";
    birthPlace: "user" | "tree";
    photoUrl: "user" | "tree";
    notes: "user" | "tree";
    currentCity: "user" | "tree";
    currentRegion: "user" | "tree";
    currentCountry: "user" | "tree";
  };
}

export function mergeMemberWithUserProfile(
  member: FamilyMember,
  user: User | null | undefined
): MergedMemberProfile {
  
  const sourceInfo: MergedMemberProfile["_sourceInfo"] = {
    firstName: "tree",
    lastName: "tree",
    nickname: "tree",
    email: "tree",
    gender: "tree",
    birthDate: "tree",
    birthPlace: "tree",
    photoUrl: "tree",
    notes: "tree",
    currentCity: "tree",
    currentRegion: "tree",
    currentCountry: "tree",
  };

  if (!user) {
    return {
      firstName: member.firstName,
      lastName: member.lastName,
      nickname: member.nickname,
      email: member.email,
      gender: member.gender,
      birthDate: member.birthDate,
      birthPlace: member.birthPlace,
      photoUrl: member.photoUrl,
      notes: member.notes,
      currentCity: member.currentCity,
      currentRegion: member.currentRegion,
      currentCountry: member.currentCountry,
      locationVisible: member.locationVisible ?? false,
      _sourceInfo: sourceInfo,
    };
  }

  const merged: MergedMemberProfile = {
    firstName: member.firstName,
    lastName: member.lastName,
    nickname: member.nickname,
    email: member.email,
    gender: member.gender,
    birthDate: member.birthDate,
    birthPlace: member.birthPlace,
    photoUrl: member.photoUrl,
    notes: member.notes,
    currentCity: member.currentCity,
    currentRegion: member.currentRegion,
    currentCountry: member.currentCountry,
    locationVisible: member.locationVisible ?? false,
    _sourceInfo: sourceInfo,
  };

  if (user.firstName) {
    merged.firstName = user.firstName;
    sourceInfo.firstName = "user";
  }
  
  if (user.lastName) {
    merged.lastName = user.lastName;
    sourceInfo.lastName = "user";
  }
  
  if (user.nickname) {
    merged.nickname = user.nickname;
    sourceInfo.nickname = "user";
  }
  
  if (user.email) {
    merged.email = user.email;
    sourceInfo.email = "user";
  }
  
  if (user.gender) {
    merged.gender = user.gender;
    sourceInfo.gender = "user";
  }
  
  if (user.birthDate) {
    merged.birthDate = user.birthDate;
    sourceInfo.birthDate = "user";
  }
  
  if (user.birthPlace) {
    merged.birthPlace = user.birthPlace;
    sourceInfo.birthPlace = "user";
  }
  
  if (user.profileImageUrl) {
    merged.photoUrl = user.profileImageUrl;
    sourceInfo.photoUrl = "user";
  }
  
  if (user.bio) {
    merged.notes = user.bio;
    sourceInfo.notes = "user";
  }
  
  if (user.currentCity) {
    merged.currentCity = user.currentCity;
    sourceInfo.currentCity = "user";
  }
  
  if (user.currentRegion) {
    merged.currentRegion = user.currentRegion;
    sourceInfo.currentRegion = "user";
  }
  
  if (user.currentCountry) {
    merged.currentCountry = user.currentCountry;
    sourceInfo.currentCountry = "user";
  }
  
  if (user.locationVisible !== null && user.locationVisible !== undefined) {
    merged.locationVisible = user.locationVisible;
  }

  return merged;
}

export function getMergeFieldSource(
  mergedProfile: MergedMemberProfile,
  field: keyof MergedMemberProfile["_sourceInfo"]
): "user" | "tree" {
  return mergedProfile._sourceInfo[field];
}

export function hasUserOverrides(mergedProfile: MergedMemberProfile): boolean {
  return Object.values(mergedProfile._sourceInfo).some(source => source === "user");
}
