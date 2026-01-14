import { useState, useMemo, useEffect } from 'react';
import { Search, Building2, Users, Briefcase, MapPin, DollarSign, X, Network } from 'lucide-react';
import type { Program } from '../types';
import type { NativeNodeType } from '../configs/nativeNodeConfigs';

interface ProgramsProps {
  programs: Program[];
  loading: boolean;
  initialFilter?: string;
  onNavigateToContractor?: (contractorName: string) => void;
  onNavigateToLocation?: (location: string) => void;
  onNavigateToMindMap?: (entityType: NativeNodeType, entityId: string, entityLabel: string) => void;
}

function ProgramCard({
  program,
  onNavigateToContractor,
  onNavigateToLocation,
  onNavigateToMindMap,
}: {
  program: Program;
  onNavigateToContractor?: (contractorName: string) => void;
  onNavigateToLocation?: (location: string) => void;
  onNavigateToMindMap?: (entityType: NativeNodeType, entityId: string, entityLabel: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900 line-clamp-2">{program.name}</h3>
          {program.agency && (
            <p className="text-sm text-slate-500 mt-1">{program.agency}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onNavigateToMindMap && (
            <button
              onClick={() => onNavigateToMindMap('PROGRAM', program.id, program.name)}
              className="p-1.5 text-slate-400 hover:text-purple-600 transition-colors rounded hover:bg-purple-50"
              title="Explore in Mind Map"
            >
              <Network className="h-4 w-4" />
            </button>
          )}
          {program.status && (
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              program.status.toLowerCase() === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {program.status}
            </span>
          )}
        </div>
      </div>

      {program.description && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">{program.description}</p>
      )}

      <div className="space-y-2">
        {program.prime_contractor && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="font-medium">Prime:</span>
            <button
              onClick={() => onNavigateToContractor?.(program.prime_contractor)}
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              title="View contractor details"
            >
              {program.prime_contractor}
            </button>
          </div>
        )}
        {program.location && (
          <button
            onClick={() => onNavigateToLocation?.(program.location)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
            title="View all entities at this location"
          >
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="hover:underline">{program.location}</span>
          </button>
        )}
        {program.contract_value > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <span>${(program.contract_value / 1000000).toFixed(1)}M</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            {program.contact_count || 0} contacts
          </span>
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <Briefcase className="h-4 w-4" />
            {program.job_count || 0} jobs
          </span>
        </div>
        {program.naics_code && (
          <span className="text-xs text-slate-400">NAICS: {program.naics_code}</span>
        )}
      </div>
    </div>
  );
}

export function Programs({
  programs,
  loading,
  initialFilter,
  onNavigateToContractor,
  onNavigateToLocation,
  onNavigateToMindMap,
}: ProgramsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'contacts' | 'jobs'>('contacts');

  // Apply initial filter from cross-navigation
  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
    }
  }, [initialFilter]);

  // Get unique agencies
  const agencies = useMemo(() => {
    const unique = new Set(programs.map((p) => p.agency).filter(Boolean));
    return Array.from(unique).sort();
  }, [programs]);

  // Filter and sort programs
  const filteredPrograms = useMemo(() => {
    let result = programs.filter((program) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          program.name?.toLowerCase().includes(query) ||
          program.agency?.toLowerCase().includes(query) ||
          program.prime_contractor?.toLowerCase().includes(query) ||
          program.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Agency filter
      if (agencyFilter !== 'all' && program.agency !== agencyFilter) {
        return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'contacts':
          return (b.contact_count || 0) - (a.contact_count || 0);
        case 'jobs':
          return (b.job_count || 0) - (a.job_count || 0);
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });

    return result;
  }, [programs, searchQuery, agencyFilter, sortBy]);

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
        <h1 className="text-2xl font-bold text-slate-900">Programs & Contracts</h1>
        <p className="text-slate-500">{programs.length} total programs &bull; {filteredPrograms.length} shown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search programs, agencies, contractors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                initialFilter && searchQuery === initialFilter
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {initialFilter && searchQuery === initialFilter && (
            <p className="text-xs text-blue-600 mt-1">Filtered from job: "{initialFilter}"</p>
          )}
        </div>

        {/* Agency Filter */}
        <select
          value={agencyFilter}
          onChange={(e) => setAgencyFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Agencies</option>
          {agencies.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="contacts">Sort by Contacts</option>
          <option value="jobs">Sort by Jobs</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Programs Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredPrograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Building2 className="h-12 w-12 mb-4 text-slate-300" />
            <p>No programs match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onNavigateToContractor={onNavigateToContractor}
                onNavigateToLocation={onNavigateToLocation}
                onNavigateToMindMap={onNavigateToMindMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
