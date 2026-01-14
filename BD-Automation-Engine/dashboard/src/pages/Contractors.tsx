import { useState, useMemo, useEffect } from 'react';
import { Search, Globe, MapPin, Users, Briefcase, Tag } from 'lucide-react';
import type { Contractor } from '../types';

interface ContractorsProps {
  contractors: Contractor[];
  loading: boolean;
  initialFilter?: string;
}

function ContractorCard({ contractor }: { contractor: Contractor }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-lg">{contractor.name}</h3>
          {contractor.website && (
            <a
              href={contractor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="truncate">{new URL(contractor.website).hostname}</span>
            </a>
          )}
        </div>
      </div>

      {contractor.description && (
        <p className="text-sm text-slate-600 line-clamp-3 mb-4">{contractor.description}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Users className="h-4 w-4 text-slate-400" />
          {contractor.contact_count || 0} contacts
        </span>
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Briefcase className="h-4 w-4 text-slate-400" />
          {contractor.job_count || 0} jobs
        </span>
      </div>

      {/* Locations */}
      {contractor.locations && contractor.locations.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">Locations</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {contractor.locations.slice(0, 5).map((loc, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {loc}
              </span>
            ))}
            {contractor.locations.length > 5 && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                +{contractor.locations.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Capabilities */}
      {contractor.capabilities && contractor.capabilities.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
            <Tag className="h-4 w-4" />
            <span className="font-medium">Capabilities</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {contractor.capabilities.slice(0, 5).map((cap, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                {cap}
              </span>
            ))}
            {contractor.capabilities.length > 5 && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                +{contractor.capabilities.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Programs */}
      {contractor.programs && contractor.programs.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Active Programs</p>
          <div className="flex flex-wrap gap-1">
            {contractor.programs.slice(0, 3).map((prog, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                {prog}
              </span>
            ))}
            {contractor.programs.length > 3 && (
              <span className="text-xs text-slate-500">
                +{contractor.programs.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Contractors({
  contractors,
  loading,
  initialFilter,
}: ContractorsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Apply initial filter from cross-navigation
  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
    }
  }, [initialFilter]);

  const filteredContractors = useMemo(() => {
    if (!searchQuery) return contractors;
    const query = searchQuery.toLowerCase();
    return contractors.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.capabilities?.some((cap) => cap.toLowerCase().includes(query)) ||
        c.locations?.some((loc) => loc.toLowerCase().includes(query))
    );
  }, [contractors, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contractors</h1>
        <p className="text-slate-500">{contractors.length} total contractors &bull; {filteredContractors.length} shown</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search contractors, capabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Contractors Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredContractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Search className="h-12 w-12 mb-4 text-slate-300" />
            <p>No contractors match your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContractors.map((contractor) => (
              <ContractorCard key={contractor.id} contractor={contractor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
