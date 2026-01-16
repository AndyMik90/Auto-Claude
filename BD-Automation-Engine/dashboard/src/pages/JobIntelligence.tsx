/**
 * Job Intelligence View
 *
 * PRIMARY PAGE - Shows jobs with complete correlation picture:
 * - Job → Matched Programs (with confidence scores and signals)
 * - Job → Matched Contacts (with role classification)
 * - Job → Related Jobs (PTS history, competitor jobs)
 */

import { useState, useMemo } from 'react';
import type { Job, Program, Contact } from '../types';
import { useCorrelation } from '../hooks/useCorrelation';
import type {
  JobCorrelation,
  ProgramMatch,
  ContactMatch,
  RelatedJob,
  MatchSignal,
} from '../services/correlationEngine';

// =============================================================================
// TYPES
// =============================================================================

interface JobIntelligenceProps {
  jobs: Job[];
  programs: Program[];
  contacts: Record<number, Contact[]> | Contact[];
  loading: boolean;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ConfidenceBadgeProps {
  confidence: number;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  let colorClass = 'bg-red-100 text-red-700 border-red-200';
  if (confidence >= 80) {
    colorClass = 'bg-green-100 text-green-700 border-green-200';
  } else if (confidence >= 60) {
    colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
  } else if (confidence >= 40) {
    colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${colorClass}`}>
      {confidence}%
    </span>
  );
}

interface TierBadgeProps {
  tier: number;
}

function TierBadge({ tier }: TierBadgeProps) {
  const colors: Record<number, string> = {
    1: 'bg-purple-600',
    2: 'bg-blue-600',
    3: 'bg-cyan-600',
    4: 'bg-emerald-600',
    5: 'bg-lime-600',
    6: 'bg-gray-500',
  };

  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-full ${colors[tier] || colors[6]}`}>
      {tier}
    </span>
  );
}

interface RoleBadgeProps {
  role: string;
}

function RoleBadge({ role }: RoleBadgeProps) {
  const styles: Record<string, string> = {
    'Hiring Manager': 'bg-red-100 text-red-700 border-red-200',
    'Program Manager': 'bg-purple-100 text-purple-700 border-purple-200',
    'Team Lead': 'bg-blue-100 text-blue-700 border-blue-200',
    'Team Member': 'bg-green-100 text-green-700 border-green-200',
    'Related Contact': 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${styles[role] || styles['Related Contact']}`}>
      {role}
    </span>
  );
}

interface MatchSignalsProps {
  signals: MatchSignal[];
}

function MatchSignals({ signals }: MatchSignalsProps) {
  const matchedSignals = signals.filter(s => s.matched);
  if (matchedSignals.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {matchedSignals.map((signal, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
          <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>{signal.description}</span>
        </div>
      ))}
    </div>
  );
}

interface JobListItemProps {
  correlation: JobCorrelation;
  isSelected: boolean;
  onClick: () => void;
}

function JobListItem({ correlation, isSelected, onClick }: JobListItemProps) {
  const { job, overallConfidence, programs } = correlation;
  const isHot = overallConfidence >= 70;

  return (
    <div
      onClick={onClick}
      className={`
        p-3 border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-900 truncate">
              {job.title || 'Untitled Job'}
            </h4>
            {isHot && (
              <span className="text-orange-500 text-xs" title="Hot Lead">
                🔥
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {job.company || 'Unknown Company'} • {job.location || 'Unknown Location'}
          </p>
          {programs.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              → {programs[0].program.name || programs[0].program.acronym}
            </p>
          )}
        </div>
        <ConfidenceBadge confidence={overallConfidence} />
      </div>
    </div>
  );
}

interface ProgramMatchCardProps {
  match: ProgramMatch;
}

function ProgramMatchCard({ match }: ProgramMatchCardProps) {
  const { program, confidence, signals, isPrimary } = match;

  return (
    <div className={`p-4 rounded-lg border ${isPrimary ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900">
              {program.name || program.acronym || 'Unknown Program'}
            </h4>
            {isPrimary && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
                Primary
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {program.agency || 'Unknown Agency'} • {program.prime_contractor || 'Unknown Prime'}
          </p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Contract Value:</span>
          <span className="ml-1 text-slate-700">{program.contract_value || 'N/A'}</span>
        </div>
        <div>
          <span className="text-slate-500">Recompete:</span>
          <span className="ml-1 text-slate-700">{program.recompete_date || 'N/A'}</span>
        </div>
        <div>
          <span className="text-slate-500">Location:</span>
          <span className="ml-1 text-slate-700">{program.location || 'N/A'}</span>
        </div>
        <div>
          <span className="text-slate-500">Priority:</span>
          <span className="ml-1 text-slate-700">{program.bd_priority || 'N/A'}</span>
        </div>
      </div>

      <MatchSignals signals={signals} />
    </div>
  );
}

interface ContactMatchCardProps {
  match: ContactMatch;
}

function ContactMatchCard({ match }: ContactMatchCardProps) {
  const { contact, confidence, roleLabel } = match;

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <TierBadge tier={contact.tier || 6} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-medium text-slate-900 truncate">
              {contact.name || 'Unknown'}
            </h5>
            <RoleBadge role={roleLabel} />
          </div>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            {contact.title || 'Unknown Title'}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {contact.company || 'Unknown Company'}
          </p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="text-xs text-blue-600 hover:underline"
          >
            📧 Email
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="text-xs text-blue-600 hover:underline"
          >
            📱 Call
          </a>
        )}
        {contact.linkedin && (
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            🔗 LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

interface RelatedJobCardProps {
  relatedJob: RelatedJob;
}

function RelatedJobCard({ relatedJob }: RelatedJobCardProps) {
  const { job, relationship, relationshipLabel, confidence } = relatedJob;

  const relationshipStyles: Record<string, string> = {
    pts_history: 'bg-green-100 text-green-700 border-green-200',
    competitor: 'bg-orange-100 text-orange-700 border-orange-200',
    similar_role: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded border ${relationshipStyles[relationship]}`}>
              {relationshipLabel}
            </span>
          </div>
          <h5 className="text-sm font-medium text-slate-900 mt-1 truncate">
            {job.title || 'Untitled'}
          </h5>
          <p className="text-xs text-slate-600 truncate">
            {job.company || 'Unknown'} • {job.location || 'Unknown'}
          </p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function JobIntelligence({ jobs, programs, contacts, loading }: JobIntelligenceProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    minConfidence: 0,
    company: '',
    location: '',
  });

  // Flatten contacts if they're grouped by tier
  const flatContacts = useMemo(() => {
    if (Array.isArray(contacts)) return contacts;
    return Object.values(contacts).flat();
  }, [contacts]);

  // Run correlation engine
  const {
    correlations,
    stats,
    loading: correlationLoading,
    searchCorrelations,
    getCorrelation,
  } = useCorrelation(jobs, programs, flatContacts, {
    autoCorrelate: true,
    limit: 500, // Limit for performance
  });

  // Filter and search correlations
  const filteredCorrelations = useMemo(() => {
    let result = searchQuery ? searchCorrelations(searchQuery) : correlations;

    // Apply confidence filter
    if (filters.minConfidence > 0) {
      result = result.filter(c => c.overallConfidence >= filters.minConfidence);
    }

    // Apply company filter
    if (filters.company) {
      result = result.filter(c =>
        c.job.company?.toLowerCase().includes(filters.company.toLowerCase())
      );
    }

    // Apply location filter
    if (filters.location) {
      result = result.filter(c =>
        c.job.location?.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    // Sort by confidence
    return result.sort((a, b) => b.overallConfidence - a.overallConfidence);
  }, [correlations, searchQuery, filters, searchCorrelations]);

  // Get selected job correlation
  const selectedCorrelation = useMemo(() => {
    if (!selectedJobId) return null;
    return filteredCorrelations.find(c => c.job.id === selectedJobId) || getCorrelation(selectedJobId);
  }, [selectedJobId, filteredCorrelations, getCorrelation]);

  // Auto-select first job if none selected
  useMemo(() => {
    if (!selectedJobId && filteredCorrelations.length > 0) {
      setSelectedJobId(filteredCorrelations[0].job.id);
    }
  }, [filteredCorrelations, selectedJobId]);

  // Extract unique companies and locations for filters
  const companies = useMemo(() => {
    const set = new Set(jobs.map(j => j.company).filter(Boolean));
    return Array.from(set).sort();
  }, [jobs]);

  // Locations prepared for future filter dropdown (commented out until needed)
  // const locations = useMemo(() => {
  //   const set = new Set(jobs.map(j => j.location).filter(Boolean));
  //   return Array.from(set).sort();
  // }, [jobs]);

  if (loading || correlationLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-600 mt-4">Loading intelligence data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Job Intelligence</h1>
            <p className="text-sm text-slate-500 mt-1">
              {stats.totalJobs} jobs • {stats.programMatchRate}% matched to programs • {stats.contactMatchRate}% matched to contacts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Import Jobs
            </button>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Sync Data
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Job List */}
        <div className="w-96 flex flex-col bg-white border-r border-slate-200">
          {/* Search and Filters */}
          <div className="p-4 border-b border-slate-100">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2 mt-2">
              <select
                value={filters.company}
                onChange={(e) => setFilters(f => ({ ...f, company: e.target.value }))}
                className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Companies</option>
                {companies.slice(0, 20).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={filters.minConfidence.toString()}
                onChange={(e) => setFilters(f => ({ ...f, minConfidence: parseInt(e.target.value) }))}
                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="0">All Scores</option>
                <option value="40">40%+</option>
                <option value="60">60%+</option>
                <option value="80">80%+</option>
              </select>
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-slate-500 px-4 py-2 bg-slate-50 border-b border-slate-100">
              {filteredCorrelations.length} Jobs
            </div>
            {filteredCorrelations.map((correlation) => (
              <JobListItem
                key={correlation.job.id}
                correlation={correlation}
                isSelected={selectedJobId === correlation.job.id}
                onClick={() => setSelectedJobId(correlation.job.id)}
              />
            ))}
            {filteredCorrelations.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                No jobs match your filters
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Correlation Details */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedCorrelation ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Selected Job Header */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedCorrelation.job.title || 'Untitled Job'}
                    </h2>
                    <p className="text-slate-600 mt-1">
                      {selectedCorrelation.job.company || 'Unknown'} • {selectedCorrelation.job.location || 'Unknown'} • {selectedCorrelation.job.clearance || 'Unknown Clearance'}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Posted: {selectedCorrelation.job.scraped_at || 'Unknown'} • Source: {selectedCorrelation.job.source || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <ConfidenceBadge confidence={selectedCorrelation.overallConfidence} />
                    <p className="text-xs text-slate-500 mt-1">Overall Confidence</p>
                  </div>
                </div>
              </div>

              {/* Three Column Layout for Matches */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Program Matches */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      🎯 Program Match
                      <span className="text-xs font-normal text-slate-500">
                        ({selectedCorrelation.programs.length} found)
                      </span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedCorrelation.programs.length > 0 ? (
                      selectedCorrelation.programs.slice(0, 3).map((match, idx) => (
                        <ProgramMatchCard key={idx} match={match} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No program matches found
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact Matches */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      👥 Contacts
                      <span className="text-xs font-normal text-slate-500">
                        ({selectedCorrelation.contacts.length} found)
                      </span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedCorrelation.contacts.length > 0 ? (
                      selectedCorrelation.contacts.slice(0, 5).map((match, idx) => (
                        <ContactMatchCard key={idx} match={match} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No contact matches found
                      </p>
                    )}
                  </div>
                </div>

                {/* Related Jobs */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      📋 Related Jobs
                      <span className="text-xs font-normal text-slate-500">
                        ({selectedCorrelation.relatedJobs.length} found)
                      </span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedCorrelation.relatedJobs.length > 0 ? (
                      selectedCorrelation.relatedJobs.slice(0, 5).map((rj, idx) => (
                        <RelatedJobCard key={idx} relatedJob={rj} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No related jobs found
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              Select a job to view its intelligence profile
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobIntelligence;
