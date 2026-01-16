// Notion API service for fetching data from Notion databases
// Uses the Notion MCP server or direct API calls
// Updated for Notion API version 2025-09-03 with multi-source database support

// API Version - Updated from 2022-06-28 to 2025-09-03 for data source support
const NOTION_API_VERSION = '2025-09-03';

// Notion database IDs - actual PTS BD workspace databases
export const NOTION_DATABASES = {
  PROGRAM_MAPPING_HUB: '0a0d7e46-3d88-40b6-853a-3c9680347644',
  FEDERAL_PROGRAMS: '9db40fce-0781-42b9-902c-d4b0263b1e23',
  CONTRACTORS: 'ca67175b-df3d-442d-a2e7-cc24e9a1bf78',
  DCGS_CONTACTS: '2ccdef65-baa5-80d0-9b66-c67d66e7a54d',
  GDIT_CONTACTS: 'c1b1d358-9d82-4f03-b77c-db43d9795c6f',
  GDIT_PTS_CONTACTS: 'ff111f82-fdbd-4353-ad59-ea4de70a058b',
} as const;

// Data source info returned from database endpoint
interface NotionDataSource {
  id: string;
  name: string;
}

// Database response with data sources (2025-09-03 format)
interface NotionDatabaseInfo {
  object: 'database';
  id: string;
  title: NotionRichText[];
  data_sources: NotionDataSource[];
}

// Cache for data_source_ids to avoid repeated lookups
const dataSourceCache: Map<string, string> = new Map();

// Types for Notion API responses
interface NotionRichText {
  type: string;
  text?: { content: string };
  plain_text?: string;
}

interface NotionSelectOption {
  id: string;
  name: string;
  color: string;
}

interface NotionProperty {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: NotionSelectOption | null;
  multi_select?: NotionSelectOption[];
  number?: number | null;
  checkbox?: boolean;
  url?: string | null;
  date?: { start: string; end?: string } | null;
  relation?: Array<{ id: string }>;
  email?: string | null;
  phone_number?: string | null;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
}

interface NotionQueryResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

// Helper functions to extract values from Notion properties
function extractText(prop: NotionProperty | undefined): string {
  if (!prop) return '';
  if (prop.type === 'title' && prop.title) {
    return prop.title.map((t) => t.plain_text || t.text?.content || '').join('');
  }
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map((t) => t.plain_text || t.text?.content || '').join('');
  }
  return '';
}

function extractSelect(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'select' || !prop.select) return '';
  return prop.select.name;
}

function extractMultiSelect(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== 'multi_select' || !prop.multi_select) return [];
  return prop.multi_select.map((opt) => opt.name);
}

function extractNumber(prop: NotionProperty | undefined): number | null {
  if (!prop || prop.type !== 'number') return null;
  return prop.number ?? null;
}

function extractCheckbox(prop: NotionProperty | undefined): boolean {
  if (!prop || prop.type !== 'checkbox') return false;
  return prop.checkbox ?? false;
}

function extractUrl(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'url') return '';
  return prop.url ?? '';
}

function extractDate(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'date' || !prop.date) return '';
  return prop.date.start;
}

function extractRelationIds(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== 'relation' || !prop.relation) return [];
  return prop.relation.map((r) => r.id);
}

// Job type matching Insight Global database schema
export interface NotionJob {
  id: string;
  title: string;
  program: string;
  agency: string;
  bd_priority: number | null;
  clearance: string;
  functional_area: string;
  status: string;
  location: string;
  city: string;
  company: string;
  task_order: string;
  source_url: string;
  scraped_at: string;
  dcgs_relevance: boolean;
}

// Program type matching Federal Programs database schema
export interface NotionProgram {
  id: string;
  name: string;
  acronym: string;
  agency_owner: string;
  prime_contractor_ids: string[];
  bd_priority: string;
  program_type: string;
  contract_vehicle: string;
  contract_value: string;
  key_locations: string;
  clearance_requirements: string[];
  period_of_performance: string;
  recompete_date: string;
  hiring_velocity: string;
  pts_involvement: string;
  notes: string;
}

// Transform Notion page to Job
function transformToJob(page: NotionPage): NotionJob {
  const props = page.properties;
  return {
    id: page.id,
    title: extractText(props['Job Title']),
    program: extractSelect(props['Program']),
    agency: extractSelect(props['Agency']),
    bd_priority: extractNumber(props['BD Priority']),
    clearance: extractSelect(props['Clearance']),
    functional_area: extractSelect(props['Functional Area']),
    status: extractSelect(props['Status']),
    location: extractText(props['Location']),
    city: extractText(props['City']),
    company: extractText(props['Company']),
    task_order: extractText(props['Task Order']),
    source_url: extractUrl(props['Source URL']),
    scraped_at: extractDate(props['Scraped At']),
    dcgs_relevance: extractCheckbox(props['DCGS Relevance']),
  };
}

// Transform Notion page to Program
function transformToProgram(page: NotionPage): NotionProgram {
  const props = page.properties;
  return {
    id: page.id,
    name: extractText(props['Program Name']),
    acronym: extractText(props['Acronym']),
    agency_owner: extractSelect(props['Agency Owner']),
    prime_contractor_ids: extractRelationIds(props['Prime Contractor']),
    bd_priority: extractSelect(props['BD Priority']),
    program_type: extractSelect(props['Program Type']),
    contract_vehicle: extractSelect(props['Contract Vehicle']),
    contract_value: extractText(props['Contract Value']),
    key_locations: extractText(props['Key Locations']),
    clearance_requirements: extractMultiSelect(props['Clearance Requirements']),
    period_of_performance: extractDate(props['Period of Performance']),
    recompete_date: extractDate(props['Recompete Date']),
    hiring_velocity: extractSelect(props['Hiring Velocity']),
    pts_involvement: extractSelect(props['PTS Involvement']),
    notes: extractText(props['Notes']),
  };
}

// Get Notion token from environment or localStorage
function getNotionToken(): string | null {
  // Check environment variable first (Vite uses import.meta.env)
  const envToken = (import.meta as { env?: Record<string, string> }).env?.VITE_NOTION_TOKEN;
  if (envToken) return envToken;

  // Fall back to localStorage for development
  return localStorage.getItem('notion_token');
}

// Set Notion token in localStorage
export function setNotionToken(token: string): void {
  localStorage.setItem('notion_token', token);
}

// Clear Notion token
export function clearNotionToken(): void {
  localStorage.removeItem('notion_token');
}

// Check if Notion is configured
export function isNotionConfigured(): boolean {
  return !!getNotionToken();
}

// =============================================================================
// Data Source Discovery (Notion API 2025-09-03)
// =============================================================================

/**
 * Get database info including data sources.
 * In 2025-09-03, databases can have multiple data sources.
 * We need to fetch the data_source_id to use in subsequent API calls.
 */
async function getDatabaseInfo(databaseId: string): Promise<NotionDatabaseInfo> {
  const token = getNotionToken();
  if (!token) {
    throw new Error('Notion token not configured');
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get the primary data_source_id for a database.
 * Caches the result to avoid repeated API calls.
 * For databases with multiple sources, returns the first one.
 */
async function getDataSourceId(databaseId: string): Promise<string> {
  // Check cache first
  const cached = dataSourceCache.get(databaseId);
  if (cached) {
    return cached;
  }

  // Fetch database info to get data sources
  const dbInfo = await getDatabaseInfo(databaseId);

  if (!dbInfo.data_sources || dbInfo.data_sources.length === 0) {
    throw new Error(`No data sources found for database ${databaseId}`);
  }

  // Use the first data source (primary)
  const dataSourceId = dbInfo.data_sources[0].id;

  // Cache it
  dataSourceCache.set(databaseId, dataSourceId);

  return dataSourceId;
}

/**
 * Clear the data source cache.
 * Useful if databases are modified and new data sources are added.
 */
export function clearDataSourceCache(): void {
  dataSourceCache.clear();
}

/**
 * Get all data sources for a database (for advanced use cases).
 */
export async function getAllDataSources(databaseId: string): Promise<NotionDataSource[]> {
  const dbInfo = await getDatabaseInfo(databaseId);
  return dbInfo.data_sources || [];
}

// =============================================================================
// Query Operations (Updated for 2025-09-03)
// =============================================================================

/**
 * Query a Notion data source with pagination.
 * In 2025-09-03, we query data sources, not databases directly.
 * The endpoint changed from /v1/databases/:id/query to /v1/data_sources/:id/query
 */
async function queryDataSource(
  dataSourceId: string,
  startCursor?: string
): Promise<NotionQueryResponse> {
  const token = getNotionToken();
  if (!token) {
    throw new Error('Notion token not configured');
  }

  const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Query a Notion database by its database ID (convenience wrapper).
 * Automatically resolves the data_source_id and queries it.
 */
async function queryDatabase(
  databaseId: string,
  startCursor?: string
): Promise<NotionQueryResponse> {
  // Get the data source ID for this database
  const dataSourceId = await getDataSourceId(databaseId);

  // Query the data source
  return queryDataSource(dataSourceId, startCursor);
}

// Fetch all pages from a database (handles pagination)
async function fetchAllPages(databaseId: string): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const response = await queryDatabase(databaseId, cursor);
    allPages.push(...response.results);
    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  return allPages;
}

// Fetch all jobs from Program Mapping Hub database
export async function fetchJobs(): Promise<NotionJob[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.PROGRAM_MAPPING_HUB);
  return pages.map(transformToJob).filter((job) => job.title); // Filter out empty jobs
}

// Fetch all programs from Federal Programs database
export async function fetchPrograms(): Promise<NotionProgram[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.FEDERAL_PROGRAMS);
  return pages.map(transformToProgram).filter((program) => program.name); // Filter out empty programs
}

// Contact type for unified contact handling
export interface NotionContact {
  id: string;
  name: string;
  firstName: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  company: string;
  program: string;
  tier: number;
  bdPriority: string;
  relationshipStrength: string;
  functionalArea: string[];
  locationHub: string;
  lastContactDate: string;
  nextOutreachDate: string;
  outreachHistory: string;
  sourceDb: string;
}

// Transform DCGS contact page to Contact
function transformToDCGSContact(page: NotionPage): NotionContact {
  const props = page.properties;
  const tierStr = extractSelect(props['Hierarchy Tier']) || '';
  const tierMatch = tierStr.match(/Tier (\d)/);
  const tier = tierMatch ? parseInt(tierMatch[1], 10) : 6;

  return {
    id: page.id,
    name: extractText(props['Name']),
    firstName: extractText(props['First Name']),
    title: extractText(props['Job Title']),
    email: props['Email Address']?.email || '',
    phone: props['Phone Number']?.phone_number || props['Direct Phone Number']?.phone_number || '',
    linkedin: extractUrl(props['LinkedIn Contact Profile URL']),
    company: extractText(props['Company Name']),
    program: extractSelect(props['Program']),
    tier,
    bdPriority: extractSelect(props['BD Priority']),
    relationshipStrength: extractSelect(props['Relationship Strength']),
    functionalArea: extractMultiSelect(props['Functional Area']),
    locationHub: extractSelect(props['Location Hub']),
    lastContactDate: extractDate(props['Last Contact Date']),
    nextOutreachDate: extractDate(props['Next Outreach Date']),
    outreachHistory: extractText(props['Outreach History']),
    sourceDb: 'DCGS',
  };
}

// Transform GDIT contact page to Contact
function transformToGDITContact(page: NotionPage): NotionContact {
  const props = page.properties;
  const tierStr = extractSelect(props['Hierarchy Tier']) || '';
  const tierMatch = tierStr.match(/Tier (\d)/);
  const tier = tierMatch ? parseInt(tierMatch[1], 10) : 6;

  return {
    id: page.id,
    name: extractText(props['Name']),
    firstName: extractText(props['First Name']),
    title: extractText(props['Job Title']),
    email: props['Email Address']?.email || '',
    phone: props['Phone Number']?.phone_number || props['Direct Phone Number']?.phone_number || '',
    linkedin: extractUrl(props['LinkedIn Contact Profile URL']),
    company: 'GDIT',
    program: extractSelect(props['Program']),
    tier,
    bdPriority: extractSelect(props['BD Priority']),
    relationshipStrength: extractSelect(props['Relationship Strength']),
    functionalArea: extractMultiSelect(props['Functional Area']),
    locationHub: extractSelect(props['Location Hub']),
    lastContactDate: extractDate(props['Last Contact Date']),
    nextOutreachDate: extractDate(props['Next Outreach Date']),
    outreachHistory: extractText(props['Outreach History']),
    sourceDb: 'GDIT',
  };
}

// Transform GDIT PTS contact to Contact
function transformToGDITPTSContact(page: NotionPage): NotionContact {
  const props = page.properties;
  const priorityStr = extractSelect(props['Priority']) || '';
  let bdPriority = 'Standard';
  if (priorityStr.includes('High')) bdPriority = 'High';
  else if (priorityStr.includes('Medium')) bdPriority = 'Medium';

  return {
    id: page.id,
    name: extractText(props['Contact Name']),
    firstName: '',
    title: extractText(props['Role/Title']),
    email: '',
    phone: '',
    linkedin: '',
    company: 'GDIT',
    program: extractSelect(props['Program']),
    tier: 3, // Default to program leadership for PTS contacts
    bdPriority,
    relationshipStrength: extractSelect(props['Status']) || 'New',
    functionalArea: [],
    locationHub: extractText(props['Location/Site']),
    lastContactDate: extractDate(props['Last Contact']),
    nextOutreachDate: extractDate(props['Next Action Date']),
    outreachHistory: extractText(props['Raw Notes']),
    sourceDb: 'GDIT-PTS',
  };
}

// Fetch all DCGS contacts
export async function fetchDCGSContacts(): Promise<NotionContact[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.DCGS_CONTACTS);
  return pages.map(transformToDCGSContact).filter((c) => c.name);
}

// Fetch all GDIT contacts
export async function fetchGDITContacts(): Promise<NotionContact[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.GDIT_CONTACTS);
  return pages.map(transformToGDITContact).filter((c) => c.name);
}

// Fetch all GDIT PTS contacts
export async function fetchGDITPTSContacts(): Promise<NotionContact[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.GDIT_PTS_CONTACTS);
  return pages.map(transformToGDITPTSContact).filter((c) => c.name);
}

// Fetch all contacts from all databases
export async function fetchAllContacts(): Promise<NotionContact[]> {
  const [dcgs, gdit, gditPts] = await Promise.all([
    fetchDCGSContacts(),
    fetchGDITContacts(),
    fetchGDITPTSContacts(),
  ]);
  return [...dcgs, ...gdit, ...gditPts];
}

// Contractor type
export interface NotionContractor {
  id: string;
  name: string;
  companyType: string;
  capabilities: string[];
  contractVehicles: string[];
  relationshipStatus: string;
  clearanceFacility: string;
  employeeCount: number;
  annualRevenue: number;
  activePlacements: number;
  ptsPlacements: number;
  bdContacts: string;
  lastEngagementDate: string;
}

// Transform contractor page
function transformToContractor(page: NotionPage): NotionContractor {
  const props = page.properties;
  return {
    id: page.id,
    name: extractText(props['Company Name']),
    companyType: extractSelect(props['Company Type']),
    capabilities: extractMultiSelect(props['Key Capabilities']),
    contractVehicles: extractRelationIds(props['Contract Vehicles']),
    relationshipStatus: extractSelect(props['Relationship Status']),
    clearanceFacility: extractSelect(props['Clearance Facility']),
    employeeCount: extractNumber(props['Employee Count']) ?? 0,
    annualRevenue: extractNumber(props['Annual Revenue']) ?? 0,
    activePlacements: extractNumber(props['Active Placements']) ?? 0,
    ptsPlacements: extractNumber(props['PTS Placements Made']) ?? 0,
    bdContacts: extractText(props['BD Contacts']),
    lastEngagementDate: extractDate(props['Last Engagement Date']),
  };
}

// Fetch all contractors
export async function fetchContractors(): Promise<NotionContractor[]> {
  const pages = await fetchAllPages(NOTION_DATABASES.CONTRACTORS);
  return pages.map(transformToContractor).filter((c) => c.name);
}

export default {
  fetchJobs,
  fetchPrograms,
  fetchDCGSContacts,
  fetchGDITContacts,
  fetchGDITPTSContacts,
  fetchAllContacts,
  fetchContractors,
  setNotionToken,
  clearNotionToken,
  isNotionConfigured,
  clearDataSourceCache,
  getAllDataSources,
  NOTION_DATABASES,
};
