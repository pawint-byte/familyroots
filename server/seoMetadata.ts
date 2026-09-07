const SITE_URL = "https://familyroots.family";

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
}

const metadata = (
  path: string,
  title: string,
  description: string,
): SeoMetadata => ({
  title,
  description,
  canonical: `${SITE_URL}${path === "/" ? "/" : path}`,
});

export const PUBLIC_SEO_METADATA: Record<string, SeoMetadata> = {
  "/": metadata(
    "/",
    "FamilyRoots - Your Private Network for Real Connections",
    "Build private, members-only networks where every connection means something. Create family trees and meaningful communities in one secure platform.",
  ),
  "/pricing": metadata(
    "/pricing",
    "Pricing - FamilyRoots | Plans & Member Packs",
    "Start free with 20 members. Choose a FamilyRoots plan from Explorer to Legacy and add more family members with affordable member packs.",
  ),
  "/features": metadata(
    "/features",
    "Features Guide | FamilyRoots",
    "Explore FamilyRoots features for building private family trees, preserving memories, connecting relatives, and managing meaningful communities.",
  ),
  "/about": metadata(
    "/about",
    "About FamilyRoots - Private Networks for Real Connections",
    "Learn why FamilyRoots is building a private, collaborative home for living family stories, meaningful communities, and real connections.",
  ),
  "/blog": metadata(
    "/blog",
    "FamilyRoots Blog - Family Stories, Privacy, and Connection",
    "Read practical guidance for building living family trees, preserving family stories, protecting privacy, and creating private networks.",
  ),
  "/faq": metadata(
    "/faq",
    "FAQ - FamilyRoots",
    "Find answers about FamilyRoots family tree management, subscriptions, sharing, privacy, records, invitations, and platform features.",
  ),
  "/privacy": metadata(
    "/privacy",
    "Privacy Policy - FamilyRoots",
    "Learn how FamilyRoots collects, uses, protects, and shares information when you build and connect your private family network.",
  ),
  "/terms": metadata(
    "/terms",
    "Terms of Service - FamilyRoots",
    "Review the terms that apply when using FamilyRoots to create family trees, preserve memories, and connect with private communities.",
  ),
  "/comparison": metadata(
    "/comparison",
    "FamilyRoots vs Ancestry - Private Networks vs Traditional Genealogy",
    "Compare FamilyRoots private networks with traditional genealogy tools, including members-only access, labeled connections, and multi-group support.",
  ),
  "/whats-new": metadata(
    "/whats-new",
    "What's New - FamilyRoots",
    "See the latest FamilyRoots features, improvements, and updates for building, preserving, and managing your private family tree.",
  ),
  "/gifts": metadata(
    "/gifts",
    "Family Tree Gifts & Products | FamilyRoots",
    "Discover family tree ornaments, wall art, memory books, and jewelry designed to celebrate family heritage and preserve meaningful memories.",
  ),
  "/merchandise": metadata(
    "/merchandise",
    "Custom Family Tree Merchandise | FamilyRoots",
    "Create personalized FamilyRoots merchandise featuring your family tree, custom photos, connection QR codes, and meaningful family details.",
  ),
  "/share": metadata(
    "/share",
    "Share FamilyRoots with Family & Friends | FamilyRoots",
    "Share FamilyRoots or your personal profile with a secure link or QR code and invite family and friends to make meaningful connections.",
  ),
  "/records": metadata(
    "/records",
    "FamilySearch Records | FamilyRoots",
    "Search FamilySearch historical records and import relatives into your private FamilyRoots family tree to preserve your family history.",
  ),
};

export function getSeoMetadata(requestPath: string): SeoMetadata | undefined {
  const pathname = new URL(requestPath, SITE_URL).pathname;
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return PUBLIC_SEO_METADATA[normalizedPath];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectSeoMetadata(html: string, requestPath: string): string {
  const seo = getSeoMetadata(requestPath);
  if (!seo) return html;

  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const canonical = escapeHtml(seo.canonical);

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}" />`)
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}" />`);
}