import { Helmet } from "react-helmet-async";

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
  const pageUrl =
    canonicalUrl ??
    (typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : undefined);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="FamilyRoots" />
      {pageUrl && <meta property="og:url" content={pageUrl} />}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {pageUrl && <link rel="canonical" href={pageUrl} />}
      {structuredData && (
        <script type="application/ld+json" data-seo="structured-data">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
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
    "Free Explorer plan with optional Cultivator, Heritage, and Legacy upgrades",
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
