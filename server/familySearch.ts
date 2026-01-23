import crypto from "crypto";

const FAMILYSEARCH_API_URL = "https://api.familysearch.org";
const FAMILYSEARCH_IDENT_URL = "https://ident.familysearch.org";
const FAMILYSEARCH_SANDBOX_API_URL = "https://sandbox.familysearch.org";
const FAMILYSEARCH_SANDBOX_IDENT_URL = "https://integration.familysearch.org";

interface FamilySearchConfig {
  appKey: string;
  redirectUri: string;
  useSandbox: boolean;
}

interface FamilySearchTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FamilySearchPerson {
  id: string;
  display?: {
    name?: string;
    gender?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
  };
}

interface FamilySearchRecord {
  id: string;
  title: string;
  description?: string;
  collection?: string;
  recordType?: string;
  url?: string;
  persons?: Array<{
    name?: string;
    birthDate?: string;
    deathDate?: string;
    role?: string;
  }>;
  sources?: Array<{
    citation?: string;
    url?: string;
  }>;
}

interface SearchResult {
  id: string;
  score: number;
  person: FamilySearchPerson;
  recordDescriptor?: {
    id: string;
    title: string;
  };
}

function getConfig(): FamilySearchConfig {
  const appKey = process.env.FAMILYSEARCH_APP_KEY || "";
  const redirectUri = process.env.FAMILYSEARCH_REDIRECT_URI || 
    `${process.env.REPL_URL || "http://localhost:5000"}/api/familysearch/callback`;
  const useSandbox = process.env.FAMILYSEARCH_USE_SANDBOX === "true" || !process.env.FAMILYSEARCH_APP_KEY;
  
  return { appKey, redirectUri, useSandbox };
}

function getBaseUrls() {
  const config = getConfig();
  return {
    api: config.useSandbox ? FAMILYSEARCH_SANDBOX_API_URL : FAMILYSEARCH_API_URL,
    ident: config.useSandbox ? FAMILYSEARCH_SANDBOX_IDENT_URL : FAMILYSEARCH_IDENT_URL,
  };
}

export function isConfigured(): boolean {
  return !!process.env.FAMILYSEARCH_APP_KEY;
}

export function getAuthorizationUrl(state: string): string {
  const config = getConfig();
  const urls = getBaseUrls();
  
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.appKey,
    redirect_uri: config.redirectUri,
    state,
  });
  
  return `${urls.ident}/cis-web/oauth2/v3/authorization?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<FamilySearchTokenResponse | null> {
  const config = getConfig();
  const urls = getBaseUrls();
  
  try {
    const response = await fetch(`${urls.ident}/cis-web/oauth2/v3/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.appKey,
        redirect_uri: config.redirectUri,
      }),
    });
    
    if (!response.ok) {
      console.error("FamilySearch token exchange failed:", await response.text());
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("FamilySearch token exchange error:", error);
    return null;
  }
}

export async function getCurrentUser(accessToken: string): Promise<FamilySearchPerson | null> {
  const urls = getBaseUrls();
  
  try {
    const response = await fetch(`${urls.api}/platform/users/current`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error("FamilySearch get user failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    return data.users?.[0] || null;
  } catch (error) {
    console.error("FamilySearch get user error:", error);
    return null;
  }
}

export async function searchRecords(
  accessToken: string,
  params: {
    givenName?: string;
    surname?: string;
    birthYear?: number;
    birthPlace?: string;
    deathYear?: number;
    deathPlace?: string;
    spouseName?: string;
    fatherName?: string;
    motherName?: string;
    count?: number;
  }
): Promise<SearchResult[]> {
  const urls = getBaseUrls();
  
  const searchParams = new URLSearchParams();
  
  if (params.givenName) searchParams.set("givenName", params.givenName);
  if (params.surname) searchParams.set("surname", params.surname);
  if (params.birthYear) searchParams.set("birthLikeDate", String(params.birthYear));
  if (params.birthPlace) searchParams.set("birthLikePlace", params.birthPlace);
  if (params.deathYear) searchParams.set("deathLikeDate", String(params.deathYear));
  if (params.deathPlace) searchParams.set("deathLikePlace", params.deathPlace);
  if (params.spouseName) searchParams.set("spouseName", params.spouseName);
  if (params.fatherName) searchParams.set("fatherName", params.fatherName);
  if (params.motherName) searchParams.set("motherName", params.motherName);
  searchParams.set("count", String(params.count || 20));
  
  try {
    const response = await fetch(`${urls.api}/platform/tree/search?${searchParams.toString()}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error("FamilySearch search failed:", response.status);
      return [];
    }
    
    const data = await response.json();
    return data.entries || [];
  } catch (error) {
    console.error("FamilySearch search error:", error);
    return [];
  }
}

export async function getRecord(accessToken: string, recordId: string): Promise<FamilySearchRecord | null> {
  const urls = getBaseUrls();
  
  try {
    const response = await fetch(`${urls.api}/platform/records/${recordId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      console.error("FamilySearch get record failed:", response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("FamilySearch get record error:", error);
    return null;
  }
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function getMockSearchResults(params: {
  givenName?: string;
  surname?: string;
  birthYear?: number;
}): SearchResult[] {
  if (!params.givenName && !params.surname) {
    return [];
  }
  
  const mockResults: SearchResult[] = [
    {
      id: "mock-1",
      score: 0.95,
      person: {
        id: "MOCK-P1",
        display: {
          name: `${params.givenName || "John"} ${params.surname || "Doe"}`,
          gender: "Male",
          birthDate: params.birthYear ? `${params.birthYear}` : "1890",
          birthPlace: "New York, New York, United States",
          deathDate: params.birthYear ? `${params.birthYear + 75}` : "1965",
        },
      },
      recordDescriptor: {
        id: "mock-record-1",
        title: "1900 United States Federal Census",
      },
    },
    {
      id: "mock-2",
      score: 0.88,
      person: {
        id: "MOCK-P2",
        display: {
          name: `${params.givenName || "John"} ${params.surname || "Doe"} Sr.`,
          gender: "Male",
          birthDate: params.birthYear ? `${params.birthYear - 25}` : "1865",
          birthPlace: "Boston, Massachusetts, United States",
        },
      },
      recordDescriptor: {
        id: "mock-record-2",
        title: "Massachusetts, Births, 1841-1915",
      },
    },
    {
      id: "mock-3",
      score: 0.75,
      person: {
        id: "MOCK-P3",
        display: {
          name: `${params.givenName || "John"} ${params.surname || "Doe"}`,
          gender: "Male",
          birthDate: params.birthYear ? `${params.birthYear}` : "1890",
          birthPlace: "Philadelphia, Pennsylvania, United States",
          deathDate: params.birthYear ? `${params.birthYear + 60}` : "1950",
        },
      },
      recordDescriptor: {
        id: "mock-record-3",
        title: "Pennsylvania, Death Certificates, 1906-1968",
      },
    },
  ];
  
  return mockResults;
}
