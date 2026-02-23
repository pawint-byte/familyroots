import crypto from "crypto";

const FAMILYSEARCH_API_URL = "https://api.familysearch.org";
const FAMILYSEARCH_IDENT_URL = "https://ident.familysearch.org";
const FAMILYSEARCH_BETA_API_URL = "https://apibeta.familysearch.org";
const FAMILYSEARCH_BETA_IDENT_URL = "https://identbeta.familysearch.org";
const FAMILYSEARCH_SANDBOX_API_URL = "https://sandbox.familysearch.org";
const FAMILYSEARCH_SANDBOX_IDENT_URL = "https://integration.familysearch.org";

type FamilySearchEnvironment = "production" | "beta" | "sandbox";

interface FamilySearchConfig {
  appKey: string;
  redirectUri: string;
  environment: FamilySearchEnvironment;
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
  relatedPersons?: Array<{
    id: string;
    display: { name?: string; gender?: string };
  }>;
  relationships?: Array<{
    type: string;
    person1Id: string;
    person2Id: string;
  }>;
}

function getConfig(): FamilySearchConfig {
  const appKey = process.env.FAMILYSEARCH_APP_KEY || "";
  const redirectUri = process.env.FAMILYSEARCH_REDIRECT_URI || 
    `${process.env.REPL_URL || "http://localhost:5000"}/api/familysearch/callback`;
  
  let environment: FamilySearchEnvironment = "production";
  if (process.env.FAMILYSEARCH_USE_SANDBOX === "true" || !process.env.FAMILYSEARCH_APP_KEY) {
    environment = "sandbox";
  } else if (process.env.FAMILYSEARCH_USE_BETA === "true") {
    environment = "beta";
  }
  
  return { appKey, redirectUri, environment };
}

function getBaseUrls() {
  const config = getConfig();
  switch (config.environment) {
    case "beta":
      return { api: FAMILYSEARCH_BETA_API_URL, ident: FAMILYSEARCH_BETA_IDENT_URL };
    case "sandbox":
      return { api: FAMILYSEARCH_SANDBOX_API_URL, ident: FAMILYSEARCH_SANDBOX_IDENT_URL };
    default:
      return { api: FAMILYSEARCH_API_URL, ident: FAMILYSEARCH_IDENT_URL };
  }
}

export function getEnvironment(): string {
  return getConfig().environment;
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

function extractPersonName(person: any): string {
  const fullText = person?.names?.[0]?.nameForms?.[0]?.fullText;
  if (fullText) return fullText;
  const displayName = person?.display?.name;
  if (displayName) {
    const match = displayName.match(/nameForms\[0\]=([^,]+)/);
    if (match) return match[1];
    if (!displayName.includes('type=') && !displayName.includes('pref=')) {
      return displayName;
    }
  }
  return 'Unknown';
}

function extractDisplayGender(person: any): string | undefined {
  const genderType = person?.gender?.type;
  if (genderType) {
    if (genderType.includes('Male')) return 'Male';
    if (genderType.includes('Female')) return 'Female';
  }
  const displayGender = person?.display?.gender;
  if (displayGender) {
    if (displayGender.includes('Male')) return 'Male';
    if (displayGender.includes('Female')) return 'Female';
  }
  return undefined;
}

function extractFact(person: any, factType: string): { date?: string; place?: string } {
  const facts = person?.facts || [];
  const fact = facts.find((f: any) => f.type?.includes(factType));
  return {
    date: fact?.date?.original || person?.display?.[`${factType.toLowerCase()}Date`],
    place: fact?.place?.original || person?.display?.[`${factType.toLowerCase()}Place`],
  };
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
  
  if (params.givenName) searchParams.set("q.givenName", params.givenName);
  if (params.surname) searchParams.set("q.surname", params.surname);
  if (params.birthYear) searchParams.set("q.birthLikeDate", `+${params.birthYear}`);
  if (params.birthPlace) searchParams.set("q.birthLikePlace", params.birthPlace);
  if (params.deathYear) searchParams.set("q.deathLikeDate", `+${params.deathYear}`);
  if (params.deathPlace) searchParams.set("q.deathLikePlace", params.deathPlace);
  if (params.spouseName) searchParams.set("q.spouseGivenName", params.spouseName);
  if (params.fatherName) searchParams.set("q.fatherGivenName", params.fatherName);
  if (params.motherName) searchParams.set("q.motherGivenName", params.motherName);
  searchParams.set("count", String(params.count || 20));
  searchParams.set("offset", "0");
  
  try {
    const searchUrl = `${urls.api}/platform/tree/search?${searchParams.toString()}`;
    console.log("[FamilySearch] Tree Search URL:", searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/x-gedcomx-atom+json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FamilySearch] Tree Search failed:", response.status, errorText.substring(0, 500));
      if (response.status === 401) {
        console.error("[FamilySearch] Access token may be expired — user should reconnect");
      }
      return [];
    }
    
    const data = await response.json();
    const rawEntries = data.entries || [];
    const totalHits = data.searchInfo?.[0]?.totalHits || data.results || rawEntries.length;
    console.log("[FamilySearch] Tree Search returned", rawEntries.length, "entries, totalHits:", totalHits);
    
    if (rawEntries.length > 0 && rawEntries[0].content?.gedcomx?.persons?.[0]) {
      const fp = rawEntries[0].content.gedcomx.persons[0];
      console.log("[FamilySearch] First person:", JSON.stringify({ id: fp.id, name: extractPersonName(fp) }, null, 2));
    }
    
    const results: SearchResult[] = rawEntries.map((entry: any) => {
      const person = entry.content?.gedcomx?.persons?.[0];
      const relationships = entry.content?.gedcomx?.relationships || [];
      const relatedPersons = entry.content?.gedcomx?.persons?.slice(1) || [];
      
      if (!person) {
        return {
          id: entry.id || '',
          score: entry.score ?? 0,
          person: { id: '', display: { name: 'Unknown' } },
        };
      }

      const birth = extractFact(person, 'Birth');
      const death = extractFact(person, 'Death');
      
      return {
        id: entry.id || person.id || '',
        score: entry.score ?? 0,
        person: {
          id: person.id || '',
          display: {
            name: extractPersonName(person),
            gender: extractDisplayGender(person),
            birthDate: birth.date || person.display?.birthDate,
            birthPlace: birth.place || person.display?.birthPlace,
            deathDate: death.date || person.display?.deathDate,
            deathPlace: death.place || person.display?.deathPlace,
          },
        },
        recordDescriptor: entry.content?.gedcomx?.description 
          ? { id: entry.content.gedcomx.description, title: entry.title || '' }
          : undefined,
        relatedPersons: relatedPersons.map((rp: any) => ({
          id: rp.id || '',
          display: {
            name: extractPersonName(rp),
            gender: extractDisplayGender(rp),
          },
        })),
        relationships: relationships.map((rel: any) => ({
          type: rel.type,
          person1Id: rel.person1?.resourceId || '',
          person2Id: rel.person2?.resourceId || '',
        })),
      };
    });
    
    return results;
  } catch (error) {
    console.error("[FamilySearch] Tree Search error:", error);
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

// Tree data interfaces
export interface FamilySearchTreePerson {
  id: string;
  name: string;
  gender?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  living?: boolean;
}

export interface FamilySearchRelationship {
  type: "parent-child" | "couple";
  person1Id: string;
  person2Id: string;
}

export interface FamilySearchTreeData {
  persons: FamilySearchTreePerson[];
  relationships: FamilySearchRelationship[];
  rootPersonId: string;
}

// Get the current user's person ID in the tree
export async function getCurrentUserPersonId(accessToken: string): Promise<string | null> {
  const urls = getBaseUrls();
  
  try {
    const url = `${urls.api}/platform/tree/current-person`;
    console.log("[FamilySearch] getCurrentUserPersonId URL:", url);
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FamilySearch] getCurrentUserPersonId failed:", response.status, errorText.substring(0, 300));
      return null;
    }
    
    const data = await response.json();
    const personId = data.persons?.[0]?.id || null;
    console.log("[FamilySearch] getCurrentUserPersonId result:", personId, "name:", data.persons?.[0]?.display?.name);
    return personId;
  } catch (error) {
    console.error("FamilySearch get current person error:", error);
    return null;
  }
}

// Get ancestry (pedigree) for a person
export async function getAncestry(
  accessToken: string, 
  personId: string, 
  generations: number = 4
): Promise<FamilySearchTreeData | null> {
  const urls = getBaseUrls();
  
  try {
    const ancestryUrl = `${urls.api}/platform/tree/ancestry?person=${personId}&generations=${generations}`;
    console.log("[FamilySearch] getAncestry URL:", ancestryUrl);
    const response = await fetch(ancestryUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FamilySearch] getAncestry failed:", response.status, errorText.substring(0, 300));
      return null;
    }
    
    const data = await response.json();
    console.log("[FamilySearch] getAncestry raw keys:", Object.keys(data));
    console.log("[FamilySearch] getAncestry persons:", data.persons?.length || 0);
    console.log("[FamilySearch] getAncestry childAndParentsRelationships:", data.childAndParentsRelationships?.length || 0);
    console.log("[FamilySearch] getAncestry relationships:", data.relationships?.length || 0);
    if (data.persons) {
      data.persons.forEach((p: any, i: number) => {
        console.log(`[FamilySearch] Ancestry person ${i}: ${p.display?.name || 'Unknown'} (${p.id}) living=${p.living}`);
      });
    }
    return parseTreeResponse(data, personId);
  } catch (error) {
    console.error("FamilySearch get ancestry error:", error);
    return null;
  }
}

// Get descendants for a person
export async function getDescendancy(
  accessToken: string, 
  personId: string, 
  generations: number = 2
): Promise<FamilySearchTreeData | null> {
  const urls = getBaseUrls();
  
  try {
    const descUrl = `${urls.api}/platform/tree/descendancy?person=${personId}&generations=${generations}`;
    console.log("[FamilySearch] getDescendancy URL:", descUrl);
    const response = await fetch(descUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[FamilySearch] getDescendancy failed:", response.status, errorText.substring(0, 300));
      return null;
    }
    
    const data = await response.json();
    console.log("[FamilySearch] getDescendancy raw keys:", Object.keys(data));
    console.log("[FamilySearch] getDescendancy persons:", data.persons?.length || 0);
    if (data.persons) {
      data.persons.forEach((p: any, i: number) => {
        console.log(`[FamilySearch] Descendancy person ${i}: ${p.display?.name || 'Unknown'} (${p.id})`);
      });
    }
    return parseTreeResponse(data, personId);
  } catch (error) {
    console.error("FamilySearch get descendancy error:", error);
    return null;
  }
}

// Get a person with their immediate family (parents, spouses, children)
export async function getPersonWithFamily(
  accessToken: string,
  personId: string
): Promise<FamilySearchTreeData | null> {
  const urls = getBaseUrls();
  
  try {
    const response = await fetch(
      `${urls.api}/platform/tree/persons/${personId}?relatives`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      console.error("FamilySearch get person with family failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    console.log("[FamilySearch] getPersonWithFamily raw data keys:", Object.keys(data));
    console.log("[FamilySearch] getPersonWithFamily persons:", data.persons?.length || 0);
    console.log("[FamilySearch] getPersonWithFamily childAndParentsRelationships:", data.childAndParentsRelationships?.length || 0);
    console.log("[FamilySearch] getPersonWithFamily relationships:", data.relationships?.length || 0);
    if (data.persons?.length > 0) {
      console.log("[FamilySearch] First person:", JSON.stringify({ id: data.persons[0].id, display: data.persons[0].display }, null, 2));
    }
    return parseTreeResponse(data, personId);
  } catch (error) {
    console.error("FamilySearch get person with family error:", error);
    return null;
  }
}

// Parse FamilySearch GEDCOM-X response into our simplified format
function parseTreeResponse(data: any, rootPersonId: string): FamilySearchTreeData {
  const persons: FamilySearchTreePerson[] = [];
  const relationships: FamilySearchRelationship[] = [];
  const addedRelKeys = new Set<string>();
  
  const addRelationship = (rel: FamilySearchRelationship) => {
    const key = `${rel.type}:${rel.person1Id}:${rel.person2Id}`;
    if (!addedRelKeys.has(key)) {
      addedRelKeys.add(key);
      relationships.push(rel);
    }
  };
  
  if (data.persons) {
    for (const person of data.persons) {
      const birth = extractFact(person, 'Birth');
      const death = extractFact(person, 'Death');
      persons.push({
        id: person.id,
        name: extractPersonName(person),
        gender: extractDisplayGender(person)?.toLowerCase(),
        birthDate: birth.date || person.display?.birthDate,
        birthPlace: birth.place || person.display?.birthPlace,
        deathDate: death.date || person.display?.deathDate,
        deathPlace: death.place || person.display?.deathPlace,
        living: person.living,
      });
    }
  }
  
  // Parse explicit parent-child relationships
  if (data.childAndParentsRelationships) {
    for (const rel of data.childAndParentsRelationships) {
      const childId = rel.child?.resourceId;
      const fatherId = rel.father?.resourceId;
      const motherId = rel.mother?.resourceId;
      
      if (childId && fatherId) {
        addRelationship({ type: "parent-child", person1Id: fatherId, person2Id: childId });
      }
      if (childId && motherId) {
        addRelationship({ type: "parent-child", person1Id: motherId, person2Id: childId });
      }
    }
  }
  
  // Parse couple relationships
  if (data.relationships) {
    for (const rel of data.relationships) {
      if (rel.type === "http://gedcomx.org/Couple") {
        const person1Id = rel.person1?.resourceId;
        const person2Id = rel.person2?.resourceId;
        if (person1Id && person2Id) {
          addRelationship({ type: "couple", person1Id, person2Id });
        }
      }
    }
  }
  
  // Infer relationships from ascendancyNumber (ahnentafel numbering) when
  // explicit relationship data is missing. Ancestry endpoints return persons
  // with display.ascendancyNumber: 1=self, 2=father, 3=mother, 4=paternal grandfather, etc.
  // A person at position N is the parent of the person at position floor(N/2).
  if (data.persons && relationships.length === 0) {
    const ahnentafelMap = new Map<number, string>();
    let hasAhnentafel = false;
    
    for (const person of data.persons) {
      const num = parseInt(person.display?.ascendancyNumber, 10);
      if (!isNaN(num) && num > 0) {
        ahnentafelMap.set(num, person.id);
        hasAhnentafel = true;
      }
    }
    
    if (hasAhnentafel) {
      console.log("[FamilySearch] Inferring relationships from ascendancyNumber, persons:", ahnentafelMap.size);
      for (const [num, personId] of ahnentafelMap) {
        if (num <= 1) continue;
        const childNum = Math.floor(num / 2);
        const childId = ahnentafelMap.get(childNum);
        if (childId) {
          addRelationship({ type: "parent-child", person1Id: personId, person2Id: childId });
        }
      }
    }
    
    // Infer relationships from descendancyNumber (e.g., "1", "1.1", "1.2", "1.1.1").
    // A person "1.2.3" is a child of "1.2", whose parent path is everything before the last dot.
    const descendancyMap = new Map<string, string>();
    let hasDescendancy = false;
    
    for (const person of data.persons) {
      const dNum = person.display?.descendancyNumber;
      if (dNum && typeof dNum === "string") {
        descendancyMap.set(dNum, person.id);
        hasDescendancy = true;
      }
    }
    
    if (hasDescendancy) {
      console.log("[FamilySearch] Inferring relationships from descendancyNumber, persons:", descendancyMap.size);
      for (const [dNum, personId] of descendancyMap) {
        const lastDot = dNum.lastIndexOf(".");
        if (lastDot === -1) continue;
        const parentNum = dNum.substring(0, lastDot);
        const parentId = descendancyMap.get(parentNum);
        if (parentId) {
          addRelationship({ type: "parent-child", person1Id: parentId, person2Id: personId });
        }
      }
    }
  }
  
  console.log("[FamilySearch] parseTreeResponse result: persons:", persons.length, "relationships:", relationships.length);
  return { persons, relationships, rootPersonId };
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

// Mock tree data for sandbox/demo mode
export function getMockTreeData(): FamilySearchTreeData {
  const persons: FamilySearchTreePerson[] = [
    // Root person (the user)
    { id: "MOCK-ME", name: "You (FamilySearch User)", gender: "male", birthDate: "1985", birthPlace: "Los Angeles, California", living: true },
    
    // Parents
    { id: "MOCK-DAD", name: "Robert Johnson", gender: "male", birthDate: "1955", birthPlace: "Chicago, Illinois", deathDate: "2020" },
    { id: "MOCK-MOM", name: "Mary Johnson", gender: "female", birthDate: "1958", birthPlace: "Detroit, Michigan", living: true },
    
    // Grandparents (paternal)
    { id: "MOCK-GDAD-P", name: "William Johnson", gender: "male", birthDate: "1925", birthPlace: "New York, New York", deathDate: "1998" },
    { id: "MOCK-GMOM-P", name: "Dorothy Johnson", gender: "female", birthDate: "1928", birthPlace: "Boston, Massachusetts", deathDate: "2005" },
    
    // Grandparents (maternal)
    { id: "MOCK-GDAD-M", name: "James Smith", gender: "male", birthDate: "1930", birthPlace: "Philadelphia, Pennsylvania", deathDate: "2010" },
    { id: "MOCK-GMOM-M", name: "Elizabeth Smith", gender: "female", birthDate: "1932", birthPlace: "Baltimore, Maryland", deathDate: "2015" },
    
    // Great-grandparents (paternal father's side)
    { id: "MOCK-GGDAD-PP", name: "Henry Johnson", gender: "male", birthDate: "1895", birthPlace: "Dublin, Ireland", deathDate: "1970" },
    { id: "MOCK-GGMOM-PP", name: "Margaret Johnson", gender: "female", birthDate: "1898", birthPlace: "Cork, Ireland", deathDate: "1975" },
    
    // Siblings
    { id: "MOCK-SIS", name: "Sarah Johnson", gender: "female", birthDate: "1988", birthPlace: "Los Angeles, California", living: true },
    { id: "MOCK-BRO", name: "Michael Johnson", gender: "male", birthDate: "1982", birthPlace: "Los Angeles, California", living: true },
    
    // Spouse
    { id: "MOCK-SPOUSE", name: "Jennifer Johnson", gender: "female", birthDate: "1987", birthPlace: "San Francisco, California", living: true },
    
    // Children
    { id: "MOCK-CHILD1", name: "Emma Johnson", gender: "female", birthDate: "2015", birthPlace: "Los Angeles, California", living: true },
    { id: "MOCK-CHILD2", name: "James Johnson", gender: "male", birthDate: "2018", birthPlace: "Los Angeles, California", living: true },
  ];
  
  const relationships: FamilySearchRelationship[] = [
    // Parent-child: Parents to root
    { type: "parent-child", person1Id: "MOCK-DAD", person2Id: "MOCK-ME" },
    { type: "parent-child", person1Id: "MOCK-MOM", person2Id: "MOCK-ME" },
    
    // Parent-child: Parents to siblings
    { type: "parent-child", person1Id: "MOCK-DAD", person2Id: "MOCK-SIS" },
    { type: "parent-child", person1Id: "MOCK-MOM", person2Id: "MOCK-SIS" },
    { type: "parent-child", person1Id: "MOCK-DAD", person2Id: "MOCK-BRO" },
    { type: "parent-child", person1Id: "MOCK-MOM", person2Id: "MOCK-BRO" },
    
    // Parent-child: Grandparents to parents
    { type: "parent-child", person1Id: "MOCK-GDAD-P", person2Id: "MOCK-DAD" },
    { type: "parent-child", person1Id: "MOCK-GMOM-P", person2Id: "MOCK-DAD" },
    { type: "parent-child", person1Id: "MOCK-GDAD-M", person2Id: "MOCK-MOM" },
    { type: "parent-child", person1Id: "MOCK-GMOM-M", person2Id: "MOCK-MOM" },
    
    // Parent-child: Great-grandparents to grandparents
    { type: "parent-child", person1Id: "MOCK-GGDAD-PP", person2Id: "MOCK-GDAD-P" },
    { type: "parent-child", person1Id: "MOCK-GGMOM-PP", person2Id: "MOCK-GDAD-P" },
    
    // Parent-child: Root to children
    { type: "parent-child", person1Id: "MOCK-ME", person2Id: "MOCK-CHILD1" },
    { type: "parent-child", person1Id: "MOCK-ME", person2Id: "MOCK-CHILD2" },
    { type: "parent-child", person1Id: "MOCK-SPOUSE", person2Id: "MOCK-CHILD1" },
    { type: "parent-child", person1Id: "MOCK-SPOUSE", person2Id: "MOCK-CHILD2" },
    
    // Couples
    { type: "couple", person1Id: "MOCK-DAD", person2Id: "MOCK-MOM" },
    { type: "couple", person1Id: "MOCK-GDAD-P", person2Id: "MOCK-GMOM-P" },
    { type: "couple", person1Id: "MOCK-GDAD-M", person2Id: "MOCK-GMOM-M" },
    { type: "couple", person1Id: "MOCK-GGDAD-PP", person2Id: "MOCK-GGMOM-PP" },
    { type: "couple", person1Id: "MOCK-ME", person2Id: "MOCK-SPOUSE" },
  ];
  
  return { persons, relationships, rootPersonId: "MOCK-ME" };
}
