import { useState, useMemo, useEffect } from 'react';
import { Search, Building2, Users, Briefcase, MapPin, DollarSign, X, Network, Calendar, Shield, TrendingUp, FileText } from 'lucide-react';
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

function getPriorityBadge(priority: string): { color: string; label: string } {
  const p = priority?.toLowerCase() || '';
  if (p.includes('critical') || p.includes('🔴')) return { color: 'bg-red-100 text-red-700', label: 'Critical' };
  if (p.includes('high') || p.includes('🟠')) return { color: 'bg-orange-100 text-orange-700', label: 'High' };
  if (p.includes('medium') || p.includes('🟡')) return { color: 'bg-yellow-100 text-yellow-700', label: 'Medium' };
  if (p.includes('low') || p.includes('⚪')) return { color: 'bg-gray-100 text-gray-600', label: 'Low' };
  return { color: 'bg-slate-100 text-slate-600', label: priority || 'Unknown' };
}

function getHiringVelocityBadge(velocity: string): { color: string } {
  const v = velocity?.toLowerCase() || '';
  if (v === 'high') return { color: 'bg-green-100 text-green-700' };
  if (v === 'medium') return { color: 'bg-yellow-100 text-yellow-700' };
  if (v === 'low') return { color: 'bg-orange-100 text-orange-700' };
  if (v === 'none') return { color: 'bg-gray-100 text-gray-600' };
  return { color: 'bg-slate-100 text-slate-600' };
}

function getPTSBadge(pts: string): { color: string } {
  const p = pts?.toLowerCase() || '';
  if (p === 'current') return { color: 'bg-green-100 text-green-700' };
  if (p === 'past') return { color: 'bg-blue-100 text-blue-700' };
  if (p === 'target') return { color: 'bg-orange-100 text-orange-700' };
  return { color: 'bg-gray-100 text-gray-600' };
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
  const priority = getPriorityBadge(program.bd_priority);
  const hiringBadge = getHiringVelocityBadge(program.hiring_velocity);
  const ptsBadge = getPTSBadge(program.pts_involvement);

  // Format recompete date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* BD Priority Badge */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${priority.color}`}>
              {priority.label}
            </span>
            {/* Program Type Badge */}
            {program.program_type && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                {program.program_type}
              </span>
            )}
            {/* PTS Involvement Badge */}
            {program.pts_involvement && program.pts_involvement !== 'None' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${ptsBadge.color}`}>
                PTS: {program.pts_involvement}
              </span>
            )}
          </div>
          {/* Program Name and Acronym */}
          <h3 className="font-semibold text-slate-900 line-clamp-2">
            {program.name}
            {program.acronym && <span className="text-slate-500 ml-1">({program.acronym})</span>}
          </h3>
          {/* Agency */}
          {program.agency && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {program.agency}
            </p>
          )}
        </div>
        {/* Mind Map Button */}
        {onNavigateToMindMap && (
          <button
            onClick={() => onNavigateToMindMap('PROGRAM', program.id, program.name)}
            className="p-1.5 text-slate-400 hover:text-purple-600 transition-colors rounded hover:bg-purple-50"
            title="Explore in Mind Map"
          >
            <Network className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Details */}
      <div className="space-y-2">
        {/* Prime Contractor */}
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

        {/* Contract Value & Vehicle */}
        {(program.contract_value || program.contract_vehicle) && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <span>
              {program.contract_value && program.contract_value}
              {program.contract_value && program.contract_vehicle && ' • '}
              {program.contract_vehicle && program.contract_vehicle}
            </span>
          </div>
        )}

        {/* Location */}
        {program.location && (
          <button
            onClick={() => onNavigateToLocation?.(program.location)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
            title="View all entities at this location"
          >
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="hover:underline line-clamp-1">{program.location}</span>
          </button>
        )}

        {/* Clearance Requirements */}
        {program.clearance_requirements && program.clearance_requirements.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Shield className="h-4 w-4 text-slate-400" />
            <span>{program.clearance_requirements.join(', ')}</span>
          </div>
        )}

        {/* Recompete Date */}
        {program.recompete_date && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>Recompete: {formatDate(program.recompete_date)}</span>
          </div>
        )}

        {/* Hiring Velocity */}
        {program.hiring_velocity && program.hiring_velocity !== 'None' && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${hiringBadge.color}`}>
              Hiring: {program.hiring_velocity}
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      {program.notes && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-start gap-2 text-sm text-slate-500">
            <FileText className="h-4 w-4 text-slate-400 mt-0.5" />
            <p className="line-clamp-2">{program.notes}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(program.job_count !== undefined && program.job_count > 0) && (
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Briefcase className="h-4 w-4" />
              {program.job_count} jobs
            </span>
          )}
          {(program.contact_count !== undefined && program.contact_count > 0) && (
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Users className="h-4 w-4" />
              {program.contact_count} contacts
            </span>
          )}
        </div>
        {program.period_of_performance && (
          <span className="text-xs text-slate-400">
            PoP: {formatDate(program.period_of_performance)}
          </span>
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
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [programTypeFilter, setProgramTypeFilter] = useState<string>('all');
  const [ptsFilter, setPtsFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'priority' | 'recompete'>('priority');

  // Apply initial filter from cross-navigation
  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
    }
  }, [initialFilter]);

  // Get unique values for filters
  const agencies = useMemo(() => {
    const unique = new Set(programs.map((p) => p.agency).filter(Boolean));
    return Array.from(unique).sort();
  }, [programs]);

  const programTypes = useMemo(() => {
    const unique = new Set(programs.map((p) => p.program_type).filter(Boolean));
    return Array.from(unique).sort();
  }, [programs]);

  const ptsInvolvements = useMemo(() => {
    const unique = new Set(programs.map((p) => p.pts_involvement).filter(Boolean));
    return Array.from(unique).sort();
  }, [programs]);

  // Filter and sort programs
  const filteredPrograms = useMemo(() => {
    let result = programs.filter((program) => {
      // Skip programs without names
      if (!program.name) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          program.name?.toLowerCase().includes(query) ||
          program.acronym?.toLowerCase().includes(query) ||
          program.agency?.toLowerCase().includes(query) ||
          program.prime_contractor?.toLowerCase().includes(query) ||
          program.location?.toLowerCase().includes(query) ||
          program.notes?.toLowerCase().includes(query) ||
          program.program_type?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Agency filter
      if (agencyFilter !== 'all' && program.agency !== agencyFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'all') {
        const priority = getPriorityBadge(program.bd_priority).label.toLowerCase();
        if (priority !== priorityFilter) return false;
      }

      // Program type filter
      if (programTypeFilter !== 'all' && program.program_type !== programTypeFilter) {
        return false;
      }

      // PTS involvement filter
      if (ptsFilter !== 'all' && program.pts_involvement !== ptsFilter) {
        return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const priorityOrder: Record<string, number> = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'unknown': 4 };
          const aPriority = getPriorityBadge(a.bd_priority).label.toLowerCase();
          const bPriority = getPriorityBadge(b.bd_priority).label.toLowerCase();
          return (priorityOrder[aPriority] ?? 4) - (priorityOrder[bPriority] ?? 4);
        }
        case 'recompete':
          if (!a.recompete_date && !b.recompete_date) return 0;
          if (!a.recompete_date) return 1;
          if (!b.recompete_date) return -1;
          return new Date(a.recompete_date).getTime() - new Date(b.recompete_date).getTime();
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });

    return result;
  }, [programs, searchQuery, agencyFilter, priorityFilter, programTypeFilter, ptsFilter, sortBy]);

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
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search programs, agencies, contractors, locations..."
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
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Agencies</option>
          {agencies.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Program Type Filter */}
        <select
          value={programTypeFilter}
          onChange={(e) => setProgramTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Program Types</option>
          {programTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* PTS Involvement Filter */}
        <select
          value={ptsFilter}
          onChange={(e) => setPtsFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All PTS Status</option>
          {ptsInvolvements.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="priority">Sort by Priority</option>
          <option value="recompete">Sort by Recompete Date</option>
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
