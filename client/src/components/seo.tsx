import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  canonicalUrl?: string;
  structuredData?: object;
}

export function SEO({
  title,
  description,
  keywords,
  ogImage = "/icon-512.png",
  ogType = "website",
  twitterCard = "summary_large_image",
  canonicalUrl,
  structuredData,
}: SEOProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Resolve the canonical/OG URL for THIS page. Falls back to the current
    // path so every page gets a correct, unique canonical instead of inheriting
    // the root canonical baked into index.html.
    const pageUrl =
      canonicalUrl ??
      (typeof window !== "undefined"
        ? window.location.origin + window.location.pathname
        : undefined);

    // Helper to update or create meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Basic meta tags
    setMeta("description", description);
    if (keywords) {
      setMeta("keywords", keywords);
    }

    // Open Graph tags
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", ogType, true);
    setMeta("og:image", ogImage, true);
    setMeta("og:site_name", "FamilyRoots", true);
    if (pageUrl) {
      setMeta("og:url", pageUrl, true);
    }

    // Twitter Card tags
    setMeta("twitter:card", twitterCard);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", ogImage);

    // Canonical URL
    if (pageUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = pageUrl;
    }

    // Structured data (JSON-LD)
    if (structuredData) {
      let script = document.querySelector('script[data-seo="structured-data"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo", "structured-data");
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    }

    // Cleanup function to remove structured data on unmount
    return () => {
      const script = document.querySelector('script[data-seo="structured-data"]');
      if (script) {
        script.remove();
      }
    };
  }, [title, description, keywords, ogImage, ogType, twitterCard, canonicalUrl, structuredData]);

  return null;
}

// Default structured data for the site
export const defaultStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "FamilyRoots",
  "description": "Create and manage interactive family trees with comprehensive genealogy tools",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free tier with 1 tree and up to 20 members"
  },
  "featureList": [
    "Interactive family tree visualization",
    "Add unlimited family members with Premium",
    "Photo and document storage",
    "Collaboration with family members",
    "Timeline view of family events",
    "AI-powered genealogy assistant"
  ]
};

// Organization structured data
export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "FamilyRoots",
  "description": "Family tree management and genealogy platform",
  "logo": "/logo.png",
  "sameAs": []
};
