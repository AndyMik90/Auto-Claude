// AI Mind Map Generator Component
// Provides UI for generating mind maps using Mapify/XMind AI

import { useState, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Youtube,
  Globe,
  FileText,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Settings,
  ChevronDown,
} from 'lucide-react';
import {
  generateMindMap,
  hasMapifyApiKey,
  setMapifyApiKey,
  MODE_OPTIONS,
  LANGUAGE_OPTIONS,
  type MapifyMode,
  type MapifyLanguage,
  type MapifyResponse,
} from '../../services/mapifyApi';

export interface AIMapGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onMapGenerated?: (imageUrl: string, editUrl: string) => void;
}

const MODE_ICONS: Record<MapifyMode, React.ReactNode> = {
  'prompt': <FileText className="w-5 h-5" />,
  'ai-search': <Search className="w-5 h-5" />,
  'youtube': <Youtube className="w-5 h-5" />,
  'website': <Globe className="w-5 h-5" />,
};

export function AIMapGenerator({ isOpen, onClose, onMapGenerated }: AIMapGeneratorProps) {
  const [mode, setMode] = useState<MapifyMode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<MapifyLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapifyResponse | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt or URL');
      return;
    }

    if (!hasMapifyApiKey()) {
      setShowSettings(true);
      setError('Please configure your Mapify API key first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateMindMap({
        prompt: prompt.trim(),
        mode,
        language,
      });

      if (response.code === 0 && response.data) {
        setResult(response);
        onMapGenerated?.(response.data.image, response.data.continual);
      } else {
        setError(response.message || 'Failed to generate mind map');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, language, onMapGenerated]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKey.trim()) {
      setMapifyApiKey(apiKey.trim());
      setShowSettings(false);
      setError(null);
    }
  }, [apiKey]);

  const currentModeConfig = MODE_OPTIONS.find(m => m.value === mode);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Mind Map Generator</h2>
              <p className="text-sm text-gray-400">Powered by XMind Mapify</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mapify API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Mapify API key"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Get your API key at{' '}
                  <a
                    href="https://mapify.so/app#show-settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    mapify.so/app
                  </a>
                </p>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
                className="px-4 py-2 mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Generation Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                    mode === option.value
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className={`mt-0.5 ${mode === option.value ? 'text-blue-400' : 'text-gray-500'}`}>
                    {MODE_ICONS[option.value]}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {mode === 'youtube' || mode === 'website' ? 'URL' : 'Prompt'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={currentModeConfig?.placeholder}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Output Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as MapifyLanguage)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result?.data && (
            <div className="space-y-4">
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <img
                  src={result.data.image}
                  alt="Generated Mind Map"
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-center gap-4">
                <a
                  href={result.data.image}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Size
                </a>
                <a
                  href={result.data.continual}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Edit in XMind
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Mind Map
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIMapGenerator;
