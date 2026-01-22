/**
 * Contact Org Chart Dashboard
 * Visualizes contacts by engagement tier with scoring details
 */

import { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  Activity,
  Building2,
  Calendar,
} from 'lucide-react';
import type { ContactOrgChart, ContactOrgChartItem } from '../types';

interface ContactOrgChartPageProps {
  loading?: boolean;
}

const TIER_CONFIG: Record<string, { color: string; bgColor: string; description: string }> = {
  'A - Strategic': {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    description: 'Key decision makers with multiple placements',
  },
  'B - High Value': {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    description: 'Active contacts with strong engagement',
  },
  'C - Engaged': {
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    description: 'Regular interactions, growing relationship',
  },
  'D - Developing': {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    description: 'Initial engagement, potential growth',
  },
  'E - New/Inactive': {
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 border-gray-200',
    description: 'New or dormant contacts',
  },
};

export function ContactOrgChartPage({ loading = false }: ContactOrgChartPageProps) {
  const [data, setData] = useState<ContactOrgChart | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['A - Strategic', 'B - High Value']));
  const [selectedContact, setSelectedContact] = useState<ContactOrgChartItem | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/contact_org_chart.json');
        if (!response.ok) throw new Error('Failed to load contact org chart data');
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
    if (!data || !searchTerm) return data;

    const term = searchTerm.toLowerCase();
    const filteredTiers: Record<string, typeof data.tiers[string]> = {};

    Object.entries(data.tiers).forEach(([tierName, tierData]) => {
      const filteredContacts = tierData.contacts.filter(contact =>
        contact.name.toLowerCase().includes(term) ||
        contact.primes.some(p => p.toLowerCase().includes(term))
      );

      if (filteredContacts.length > 0) {
        filteredTiers[tierName] = {
          ...tierData,
          contacts: filteredContacts,
          count: filteredContacts.length,
        };
      }
    });

    return {
      ...data,
      tiers: filteredTiers,
    };
  }, [data, searchTerm]);

  const toggleTier = (tier: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-purple-600 bg-purple-100';
    if (score >= 50) return 'text-blue-600 bg-blue-100';
    if (score >= 30) return 'text-green-600 bg-green-100';
    if (score >= 15) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-500 bg-gray-100';
  };

  if (loading || dataLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading contact org chart: {error || 'No data available'}
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
            <UserCheck className="h-7 w-7 text-green-500" />
            Contact Org Chart
          </h1>
          <p className="text-slate-500 mt-1">
            {data.summary.total_contacts.toLocaleString()} contacts scored across {Object.keys(data.tiers).length} tiers
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(data.summary.tier_distribution).map(([tier, count]) => {
          const config = TIER_CONFIG[tier] || TIER_CONFIG['E - New/Inactive'];
          return (
            <div key={tier} className={`rounded-xl shadow-sm p-4 border ${config.bgColor}`}>
              <div className="flex items-center gap-2">
                <Star className={`h-5 w-5 ${config.color}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{tier.split(' - ')[0]}</p>
                  <p className="text-2xl font-bold text-slate-800">{count.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Tier Accordion */}
        <div className="flex-1 space-y-4">
          {Object.entries(filteredData?.tiers || {}).map(([tierName, tierData]) => {
            const config = TIER_CONFIG[tierName] || TIER_CONFIG['E - New/Inactive'];
            const isExpanded = expandedTiers.has(tierName);

            return (
              <div key={tierName} className={`rounded-xl shadow-sm border ${config.bgColor}`}>
                <button
                  onClick={() => toggleTier(tierName)}
                  className="w-full flex items-center justify-between p-4 hover:bg-opacity-75 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className={`h-5 w-5 ${config.color}`} />
                    ) : (
                      <ChevronRight className={`h-5 w-5 ${config.color}`} />
                    )}
                    <Star className={`h-5 w-5 ${config.color}`} />
                    <div className="text-left">
                      <h3 className="font-semibold text-slate-800">{tierName}</h3>
                      <p className="text-sm text-slate-500">{config.description}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-slate-700">
                    {tierData.count.toLocaleString()}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 bg-white rounded-b-xl">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {tierData.contacts.slice(0, 50).map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors ${
                            selectedContact?.id === contact.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getScoreColor(contact.score)}`}>
                              <span className="text-sm font-bold">{contact.score}</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{contact.name}</p>
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span>{contact.placements} placements</span>
                                <span>|</span>
                                <span>{contact.activities} activities</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {contact.primes.length > 0 && (
                              <p className="text-sm text-slate-600">
                                {contact.primes[0]}
                                {contact.primes.length > 1 && ` +${contact.primes.length - 1}`}
                              </p>
                            )}
                            {contact.last_activity && (
                              <p className="text-xs text-slate-400">
                                Last: {contact.last_activity}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {tierData.contacts.length > 50 && (
                        <p className="text-center text-sm text-slate-500 py-2">
                          Showing 50 of {tierData.contacts.length} contacts
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact Detail Panel */}
        {selectedContact && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit sticky top-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedContact.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-sm ${getScoreColor(selectedContact.score)}`}>
                  {selectedContact.tier}
                </span>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getScoreColor(selectedContact.score)}`}>
                <span className="text-xl font-bold">{selectedContact.score}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                    <Users className="h-4 w-4" />
                    Placements
                  </div>
                  <p className="text-xl font-bold text-slate-800">{selectedContact.placements}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                    <Activity className="h-4 w-4" />
                    Activities
                  </div>
                  <p className="text-xl font-bold text-slate-800">{selectedContact.activities}</p>
                </div>
              </div>

              {/* Primes */}
              {selectedContact.primes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 text-sm font-medium mb-2">
                    <Building2 className="h-4 w-4" />
                    Prime Contractors ({selectedContact.prime_count})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedContact.primes.map((prime, idx) => (
                      <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {prime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Activity */}
              {selectedContact.last_activity && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 text-sm font-medium mb-1">
                    <Calendar className="h-4 w-4" />
                    Last Activity
                  </div>
                  <p className="text-slate-800">{selectedContact.last_activity}</p>
                </div>
              )}

              {/* Scoring Factors */}
              {selectedContact.scoring_factors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-slate-600 text-sm font-medium mb-2">
                    <Star className="h-4 w-4" />
                    Scoring Breakdown
                  </div>
                  <div className="space-y-1">
                    {selectedContact.scoring_factors.map((factor, idx) => (
                      <p key={idx} className="text-sm text-slate-600 bg-slate-50 rounded px-2 py-1">
                        {factor}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedContact(null)}
              className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactOrgChartPage;
