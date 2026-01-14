import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { Job, Program, Contact } from '../types';

interface LocationsProps {
  jobs: Job[];
  programs: Program[];
  contacts: Record<string, Contact[]>;
  loading: boolean;
  initialFilter?: string;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToProgram?: (programId: string) => void;
  onNavigateToContact?: (contactId: string) => void;
}

interface LocationAggregate {
  name: string;
  normalizedName: string;
  jobs: Job[];
  programs: Program[];
  contacts: Contact[];
  jobCount: number;
  programCount: number;
  contactCount: number;
  totalCount: number;
}

function normalizeLocation(location: string): string {
  if (!location) return 'Unknown';
  // Normalize common variations
  return location
    .trim()
    .replace(/,\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\.$/g, '');
}

function LocationCard({
  location,
  expanded,
  onToggle,
}: {
  location: LocationAggregate;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">{location.name}</h3>
            <p className="text-sm text-slate-500">
              {location.totalCount} total entities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Count badges */}
          <div className="flex gap-2">
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              <Briefcase className="h-3 w-3" />
              {location.jobCount}
            </span>
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              <Building2 className="h-3 w-3" />
              {location.programCount}
            </span>
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              <Users className="h-3 w-3" />
              {location.contactCount}
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-4">
          {/* Jobs Section */}
          {location.jobs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-green-600" />
                Jobs ({location.jobCount})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {location.jobs.slice(0, 10).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {job.title}
                      </p>
                      <p className="text-xs text-slate-500">{job.company}</p>
                    </div>
                    {job.source_url && (
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
                {location.jobs.length > 10 && (
                  <p className="text-xs text-slate-500 text-center py-1">
                    +{location.jobs.length - 10} more jobs
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Programs Section */}
          {location.programs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Programs ({location.programCount})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {location.programs.slice(0, 10).map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {program.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {program.prime_contractor} &bull; {program.agency}
                      </p>
                    </div>
                  </div>
                ))}
                {location.programs.length > 10 && (
                  <p className="text-xs text-slate-500 text-center py-1">
                    +{location.programs.length - 10} more programs
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contacts Section */}
          {location.contacts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Contacts ({location.contactCount})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {location.contacts.slice(0, 10).map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {contact.title} &bull; {contact.company}
                      </p>
                    </div>
                    {contact.linkedin && (
                      <a
                        href={contact.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
                {location.contacts.length > 10 && (
                  <p className="text-xs text-slate-500 text-center py-1">
                    +{location.contacts.length - 10} more contacts
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Locations({
  jobs,
  programs,
  contacts,
  loading,
  initialFilter,
}: LocationsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'total' | 'jobs' | 'programs' | 'contacts' | 'name'>('total');

  // Apply initial filter from cross-navigation
  useEffect(() => {
    if (initialFilter) {
      setSearchQuery(initialFilter);
    }
  }, [initialFilter]);

  // Flatten contacts from tier-based structure
  const allContacts = useMemo(() => {
    const flat: Contact[] = [];
    Object.values(contacts).forEach((tierContacts) => {
      flat.push(...tierContacts);
    });
    return flat;
  }, [contacts]);

  // Aggregate data by location
  const locationAggregates = useMemo(() => {
    const aggregateMap = new Map<string, LocationAggregate>();

    // Add jobs to locations
    jobs.forEach((job) => {
      const normalized = normalizeLocation(job.location);
      if (!aggregateMap.has(normalized)) {
        aggregateMap.set(normalized, {
          name: job.location || 'Unknown',
          normalizedName: normalized,
          jobs: [],
          programs: [],
          contacts: [],
          jobCount: 0,
          programCount: 0,
          contactCount: 0,
          totalCount: 0,
        });
      }
      const agg = aggregateMap.get(normalized)!;
      agg.jobs.push(job);
      agg.jobCount++;
      agg.totalCount++;
    });

    // Add programs to locations
    programs.forEach((program) => {
      const normalized = normalizeLocation(program.location);
      if (!aggregateMap.has(normalized)) {
        aggregateMap.set(normalized, {
          name: program.location || 'Unknown',
          normalizedName: normalized,
          jobs: [],
          programs: [],
          contacts: [],
          jobCount: 0,
          programCount: 0,
          contactCount: 0,
          totalCount: 0,
        });
      }
      const agg = aggregateMap.get(normalized)!;
      agg.programs.push(program);
      agg.programCount++;
      agg.totalCount++;
    });

    // Add contacts to locations (infer from company or leave as Unknown)
    // Since contacts don't have explicit location, we'll skip them for now
    // In Phase A of the Mind Map, we'll add location inference

    return Array.from(aggregateMap.values());
  }, [jobs, programs, allContacts]);

  // Filter and sort locations
  const filteredLocations = useMemo(() => {
    let filtered = locationAggregates;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query) ||
          loc.jobs.some((j) => j.title.toLowerCase().includes(query) || j.company?.toLowerCase().includes(query)) ||
          loc.programs.some((p) => p.name.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'jobs':
          return b.jobCount - a.jobCount;
        case 'programs':
          return b.programCount - a.programCount;
        case 'contacts':
          return b.contactCount - a.contactCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'total':
        default:
          return b.totalCount - a.totalCount;
      }
    });

    return filtered;
  }, [locationAggregates, searchQuery, sortBy]);

  const toggleExpanded = (locationName: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationName)) {
        next.delete(locationName);
      } else {
        next.add(locationName);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Summary statistics
  const totalJobs = locationAggregates.reduce((sum, loc) => sum + loc.jobCount, 0);
  const totalPrograms = locationAggregates.reduce((sum, loc) => sum + loc.programCount, 0);
  const uniqueLocations = locationAggregates.filter((l) => l.name !== 'Unknown').length;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
        <p className="text-slate-500">
          {uniqueLocations} unique locations &bull; {totalJobs} jobs &bull; {totalPrograms} programs
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search locations, jobs, programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="total">Sort by Total Count</option>
          <option value="jobs">Sort by Jobs</option>
          <option value="programs">Sort by Programs</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Locations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredLocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <MapPin className="h-12 w-12 mb-4 text-slate-300" />
            <p>No locations match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLocations.map((location) => (
              <LocationCard
                key={location.normalizedName}
                location={location}
                expanded={expandedLocations.has(location.normalizedName)}
                onToggle={() => toggleExpanded(location.normalizedName)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
