const PUBLIC_EXACT_PATHS = new Set([
  "/login",
  "/signup",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/features",
  "/pricing",
  "/gifts",
  "/faq",
  "/merchandise",
  "/comparison",
  "/whats-new",
  "/about",
  "/blog",
  "/privacy",
  "/terms",
]);

/**
 * Routes that can render without resolving the current session first.
 *
 * Keep the root path out of this list: it chooses between the landing page
 * and the authenticated dashboard. Invitation and public content pages are
 * safe to render while auth is pending because they resolve their own data.
 */
export function isPublicRoute(pathname: string): boolean {
  const normalizedPath = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

  if (PUBLIC_EXACT_PATHS.has(normalizedPath)) {
    return true;
  }

  return (
    normalizedPath.startsWith("/reset-password/") ||
    normalizedPath.startsWith("/verify-email/") ||
    normalizedPath.startsWith("/video/") ||
    normalizedPath.startsWith("/join/") ||
    normalizedPath.startsWith("/profile/")
  );
}