export function getRegisterHref(search?: string): string {
  const query = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return query ? `/register${query}` : "/register";
}