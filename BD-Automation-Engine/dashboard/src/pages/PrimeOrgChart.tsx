/**
 * Prime Contractor Org Chart Dashboard
 * Visualizes prime contractor relationships and hierarchy
 */

import { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Building2,
  Users,
  FileText,
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
} from 'lucide-react';
import type { PrimeOrgChartItem } from '../types';

interface PrimeOrgChartProps {
  loading?: boolean;
}

export function PrimeOrgChart({ loading = false }: PrimeOrgChartProps) {
  const [data, setData] = useState<PrimeOrgChartItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPrimes, setExpandedPrimes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'tree'>('cards');

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/prime_org_chart.json');
        if (!response.ok) throw new Error('Failed to load prime org chart data');
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.programs.some(p => p.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedPrimes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Strategic': return 'border-purple-500 bg-purple-50';
      case 'Key Account': return 'border-blue-500 bg-blue-50';
      case 'Established': return 'border-green-500 bg-green-50';
      case 'Growing': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'Strategic': return 'bg-purple-100 text-purple-800';
      case 'Key Account': return 'bg-blue-100 text-blue-800';
      case 'Established': return 'bg-green-100 text-green-800';
      case 'Growing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'Defense Prime') return <Shield className="h-4 w-4 text-purple-600" />;
    if (category === 'Technology') return <FileText className="h-4 w-4 text-blue-600" />;
    return <Building2 className="h-4 w-4 text-slate-600" />;
  };

  // Group by relationship tier
  const groupedByTier = useMemo(() => {
    const groups: Record<string, PrimeOrgChartItem[]> = {
      'Strategic': [],
      'Key Account': [],
      'Established': [],
      'Growing': [],
      'Emerging': [],
    };

    filteredData.forEach(item => {
      const tier = item.relationship_tier || 'Emerging';
      if (groups[tier]) {
        groups[tier].push(item);
      }
    });

    return groups;
  }, [filteredData]);

  if (loading || dataLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading prime org chart: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-blue-500" />
            Prime Contractor Org Chart
          </h1>
          <p className="text-slate-500 mt-1">
            {data.length} prime contractors with relationship hierarchy
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            Cards View
          </button>
          <button
            onClick={() => setViewMode('tree')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            Tree View
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search primes, programs, or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* Cards View - Grouped by Tier */
        <div className="space-y-6">
          {Object.entries(groupedByTier).map(([tier, primes]) => (
            primes.length > 0 && (
              <div key={tier}>
                <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Star className={`h-5 w-5 ${tier === 'Strategic' ? 'text-purple-500' : tier === 'Key Account' ? 'text-blue-500' : 'text-slate-400'}`} />
                  {tier} ({primes.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {primes.map((prime) => (
                    <div
                      key={prime.id}
                      className={`rounded-xl shadow-sm border-l-4 p-4 bg-white ${getTierColor(tier)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(prime.category)}
                          <h3 className="font-semibold text-slate-800">{prime.name}</h3>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTierBadgeColor(tier)}`}>
                          {tier}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-lg font-bold text-slate-800">{prime.total_placements}</p>
                          <p className="text-xs text-slate-500">Placements</p>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-lg font-bold text-slate-800">{prime.total_contacts}</p>
                          <p className="text-xs text-slate-500">Contacts</p>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-lg font-bold text-slate-800">{prime.program_count}</p>
                          <p className="text-xs text-slate-500">Programs</p>
                        </div>
                      </div>

                      {prime.top_contacts.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleExpand(prime.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            {expandedPrimes.has(prime.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            Top Contacts ({prime.top_contacts.length})
                          </button>

                          {expandedPrimes.has(prime.id) && (
                            <div className="mt-2 space-y-1">
                              {prime.top_contacts.slice(0, 5).map((contact, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1">
                                  <span className="text-slate-700">{contact.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{contact.tier}</span>
                                    <span className="text-xs font-medium text-blue-600">{contact.score}pts</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {prime.programs.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-slate-500 mb-1">Programs:</p>
                          <div className="flex flex-wrap gap-1">
                            {prime.programs.slice(0, 3).map((prog, idx) => (
                              <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                {prog.length > 20 ? prog.substring(0, 20) + '...' : prog}
                              </span>
                            ))}
                            {prime.programs.length > 3 && (
                              <span className="text-xs text-slate-500">+{prime.programs.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        /* Tree View */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-2">
            {filteredData.map((prime) => (
              <div key={prime.id} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() => toggleExpand(prime.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedPrimes.has(prime.id) ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                    {getCategoryIcon(prime.category)}
                    <span className="font-medium text-slate-800">{prime.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getTierBadgeColor(prime.relationship_tier)}`}>
                      {prime.relationship_tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>{prime.total_placements} placements</span>
                    <span>{prime.total_contacts} contacts</span>
                    <span>{prime.program_count} programs</span>
                  </div>
                </button>

                {expandedPrimes.has(prime.id) && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Top Contacts */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Top Contacts
                        </h4>
                        <div className="space-y-1">
                          {prime.top_contacts.length > 0 ? (
                            prime.top_contacts.map((contact, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-white rounded px-3 py-2">
                                <span className="text-slate-700">{contact.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {contact.tier}
                                  </span>
                                  <span className="text-xs font-bold text-blue-600">{contact.score}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-400">No contacts found</p>
                          )}
                        </div>
                      </div>

                      {/* Programs */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Programs ({prime.programs.length})
                        </h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {prime.programs.length > 0 ? (
                            prime.programs.map((program, idx) => (
                              <div key={idx} className="text-sm bg-white rounded px-3 py-2 text-slate-700">
                                {program}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-400">No programs linked</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PrimeOrgChart;
