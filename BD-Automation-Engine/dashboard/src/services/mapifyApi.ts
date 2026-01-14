// Mapify API Service for AI-powered mind map generation
// Integrates with XMind's Mapify API for generating mind maps from various sources

export type MapifyMode = 'prompt' | 'ai-search' | 'youtube' | 'website';

export type MapifyLanguage =
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru'
  | 'ja' | 'ko' | 'zh-CN' | 'zh-TW' | 'ar' | 'hi' | 'th' | 'vi' | 'tr';

export interface MapifyRequest {
  prompt: string;
  mode: MapifyMode;
  language: MapifyLanguage;
}

export interface MapifyResponse {
  code: number;
  message?: string;
  data?: {
    image: string;     // URL to the generated mind map image
    continual: string; // URL to edit the mind map on Mapify
    width?: number;
    height?: number;
  };
}

export interface GeneratedMindMap {
  imageUrl: string;
  editUrl: string;
  prompt: string;
  mode: MapifyMode;
  language: MapifyLanguage;
  createdAt: Date;
}

// Store for generated mind maps
const generatedMaps: GeneratedMindMap[] = [];

// Get the Mapify API key from environment or localStorage
function getApiKey(): string | null {
  // Check localStorage first (user-configured)
  const storedKey = localStorage.getItem('MAPIFY_API_KEY');
  if (storedKey) return storedKey;

  // Fall back to environment variable (development)
  return import.meta.env.VITE_MAPIFY_API_KEY || null;
}

// Set the API key in localStorage
export function setMapifyApiKey(key: string): void {
  localStorage.setItem('MAPIFY_API_KEY', key);
}

// Check if API key is configured
export function hasMapifyApiKey(): boolean {
  return !!getApiKey();
}

// Generate a mind map using Mapify API
export async function generateMindMap(
  request: MapifyRequest
): Promise<MapifyResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      code: 102,
      message: 'Mapify API key not configured. Please set your API key in settings.',
    };
  }

  try {
    const response = await fetch('https://mapify.so/api/v1/preview-mind-maps', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        mode: request.mode,
        language: request.language,
        from: 'bd-intelligence-dashboard',
      }),
    });

    const result: MapifyResponse = await response.json();

    // Store successful generations
    if (result.code === 0 && result.data) {
      generatedMaps.push({
        imageUrl: result.data.image,
        editUrl: result.data.continual,
        prompt: request.prompt,
        mode: request.mode,
        language: request.language,
        createdAt: new Date(),
      });
    }

    return result;
  } catch (error) {
    return {
      code: -1,
      message: error instanceof Error ? error.message : 'Failed to connect to Mapify API',
    };
  }
}

// Generate mind map from text prompt
export function generateFromText(prompt: string, language: MapifyLanguage = 'en') {
  return generateMindMap({ prompt, mode: 'prompt', language });
}

// Generate mind map from AI search
export function generateFromSearch(query: string, language: MapifyLanguage = 'en') {
  return generateMindMap({ prompt: query, mode: 'ai-search', language });
}

// Generate mind map from YouTube video
export function generateFromYouTube(url: string, language: MapifyLanguage = 'en') {
  return generateMindMap({ prompt: url, mode: 'youtube', language });
}

// Generate mind map from website
export function generateFromWebsite(url: string, language: MapifyLanguage = 'en') {
  return generateMindMap({ prompt: url, mode: 'website', language });
}

// Get history of generated mind maps
export function getGeneratedMaps(): GeneratedMindMap[] {
  return [...generatedMaps];
}

// Clear generated maps history
export function clearGeneratedMaps(): void {
  generatedMaps.length = 0;
}

// Language options for the UI
export const LANGUAGE_OPTIONS: { value: MapifyLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
  { value: 'zh-TW', label: 'Chinese (Traditional)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'tr', label: 'Turkish' },
];

// Mode options for the UI
export const MODE_OPTIONS: { value: MapifyMode; label: string; description: string; placeholder: string }[] = [
  {
    value: 'prompt',
    label: 'Text Prompt',
    description: 'Generate from any text description',
    placeholder: 'e.g., "DCGS program relationships and key contacts"'
  },
  {
    value: 'ai-search',
    label: 'AI Search',
    description: 'Search the web and create a mind map',
    placeholder: 'e.g., "DoD contracting opportunities 2025"'
  },
  {
    value: 'youtube',
    label: 'YouTube Video',
    description: 'Extract content from a YouTube video',
    placeholder: 'https://youtube.com/watch?v=...'
  },
  {
    value: 'website',
    label: 'Website',
    description: 'Parse website content into a mind map',
    placeholder: 'https://example.com/article'
  },
];
