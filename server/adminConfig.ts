export const ADMIN_EMAILS_LIST = [
  "pawint@me.com",
];

export const ADMIN_USER_IDS_LIST = ["52852375"];

export function isAdminAccount(userId?: string | null, email?: string | null): boolean {
  if (userId && ADMIN_USER_IDS_LIST.includes(userId)) return true;
  if (email && ADMIN_EMAILS_LIST.some(e => e === email.toLowerCase())) return true;
  return false;
}
