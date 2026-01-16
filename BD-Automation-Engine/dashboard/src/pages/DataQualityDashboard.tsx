/**
 * Data Quality Dashboard
 *
 * Monitors correlation coverage and data quality:
 * - Jobs matched to programs/contacts
 * - Contact completeness (email, phone, LinkedIn)
 * - Program data coverage
 * - Unmatched items requiring attention
 */

import { useMemo } from 'react';
import type { Job, Program, Contact } from '../types';
import { useCorrelation } from '../hooks/useCorrelation';

// =============================================================================
// TYPES
// =============================================================================

interface DataQualityDashboardProps {
  jobs: Job[];
  programs: Program[];
  contacts: Record<number, Contact[]> | Contact[];
  loading: boolean;
}

// Reserved for future use when we add more complex metrics
// interface QualityMetric {
//   label: string;
//   value: number;
//   total: number;
//   percentage: number;
//   status: 'good' | 'warning' | 'critical';
// }

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
}

function KPICard({ title, value, subtitle, status = 'neutral' }: KPICardProps) {
  const statusColors = {
    good: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    critical: 'border-l-red-500',
    neutral: 'border-l-blue-500',
  };

  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-4 ${statusColors[status]} p-4 shadow-sm`}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

interface ProgressBarProps {
  label: string;
  value: number;
  total: number;
  showPercentage?: boolean;
}

function ProgressBar({ label, value, total, showPercentage = true }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  let colorClass = 'bg-green-500';
  if (percentage < 50) colorClass = 'bg-red-500';
  else if (percentage < 80) colorClass = 'bg-yellow-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 font-medium">
          {value.toLocaleString()}/{total.toLocaleString()}
          {showPercentage && ` (${percentage}%)`}
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface UnmatchedItemProps {
  title: string;
  subtitle: string;
  reason: string;
  type: 'job' | 'contact' | 'program';
}

function UnmatchedItem({ title, subtitle, reason, type }: UnmatchedItemProps) {
  const icons = {
    job: '📄',
    contact: '👤',
    program: '🏛️',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <span className="text-lg">{icons[type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        <p className="text-xs text-orange-600 mt-1">{reason}</p>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataQualityDashboard({
  jobs,
  programs,
  contacts,
  loading,
}: DataQualityDashboardProps) {
  // Flatten contacts
  const flatContacts = useMemo(() => {
    if (Array.isArray(contacts)) return contacts;
    return Object.values(contacts).flat();
  }, [contacts]);

  // Get correlation stats
  const { stats, correlations, loading: correlationLoading } = useCorrelation(
    jobs,
    programs,
    flatContacts,
    { autoCorrelate: true, limit: 500 }
  );

  // Calculate job quality metrics
  const jobMetrics = useMemo(() => {
    if (jobs.length === 0) return null;

    const withTitle = jobs.filter(j => j.title).length;
    const withCompany = jobs.filter(j => j.company).length;
    const withLocation = jobs.filter(j => j.location || j.city).length;
    const withClearance = jobs.filter(j => j.clearance).length;
    const withProgram = jobs.filter(j => j.program || j.program_name).length;

    return {
      total: jobs.length,
      withTitle,
      withCompany,
      withLocation,
      withClearance,
      withProgram,
      completeness: Math.round(
        ((withTitle + withCompany + withLocation + withClearance) / (jobs.length * 4)) * 100
      ),
    };
  }, [jobs]);

  // Calculate contact quality metrics
  const contactMetrics = useMemo(() => {
    if (flatContacts.length === 0) return null;

    const withName = flatContacts.filter(c => c.name).length;
    const withEmail = flatContacts.filter(c => c.email).length;
    const withPhone = flatContacts.filter(c => c.phone).length;
    const withLinkedIn = flatContacts.filter(c => c.linkedin).length;
    const withTier = flatContacts.filter(c => c.tier && c.tier !== 6).length;
    const withCompany = flatContacts.filter(c => c.company).length;

    return {
      total: flatContacts.length,
      withName,
      withEmail,
      withPhone,
      withLinkedIn,
      withTier,
      withCompany,
      completeness: Math.round(
        ((withName + withEmail + withCompany + withTier) / (flatContacts.length * 4)) * 100
      ),
    };
  }, [flatContacts]);

  // Calculate program quality metrics
  const programMetrics = useMemo(() => {
    if (programs.length === 0) return null;

    const withName = programs.filter(p => p.name || p.acronym).length;
    const withAgency = programs.filter(p => p.agency).length;
    const withPrime = programs.filter(p => p.prime_contractor).length;
    const withValue = programs.filter(p => p.contract_value).length;
    const withLocation = programs.filter(p => p.location).length;

    return {
      total: programs.length,
      withName,
      withAgency,
      withPrime,
      withValue,
      withLocation,
      completeness: Math.round(
        ((withName + withAgency + withPrime + withValue) / (programs.length * 4)) * 100
      ),
    };
  }, [programs]);

  // Find unmatched items
  const unmatchedJobs = useMemo(() => {
    return correlations
      .filter(c => c.programs.length === 0)
      .slice(0, 10)
      .map(c => ({
        id: c.job.id,
        title: c.job.title || 'Untitled',
        subtitle: `${c.job.company || 'Unknown'} • ${c.job.location || 'Unknown'}`,
        reason: !c.job.location
          ? 'Missing location'
          : !c.job.company
          ? 'Missing company'
          : 'No program keywords found',
      }));
  }, [correlations]);

  const unmatchedContacts = useMemo(() => {
    // Contacts not matched to any program
    return flatContacts
      .filter(c => !c.program && (!c.matched_programs || c.matched_programs.length === 0))
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        title: c.name || 'Unknown',
        subtitle: `${c.company || 'Unknown'} • ${c.title || 'Unknown Title'}`,
        reason: 'No program assignment',
      }));
  }, [flatContacts]);

  // Overall quality score
  const overallQuality = useMemo(() => {
    const scores = [
      jobMetrics?.completeness || 0,
      contactMetrics?.completeness || 0,
      programMetrics?.completeness || 0,
      stats.programMatchRate || 0,
      stats.contactMatchRate || 0,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [jobMetrics, contactMetrics, programMetrics, stats]);

  if (loading || correlationLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-slate-600 mt-4">Analyzing data quality...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Quality</h1>
            <p className="text-slate-500 mt-1">
              Monitor correlation coverage and data completeness
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Export Report
            </button>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard
            title="Total Jobs"
            value={jobs.length.toLocaleString()}
            status="neutral"
          />
          <KPICard
            title="Total Programs"
            value={programs.length.toLocaleString()}
            status="neutral"
          />
          <KPICard
            title="Total Contacts"
            value={flatContacts.length.toLocaleString()}
            status="neutral"
          />
          <KPICard
            title="Match Rate"
            value={`${stats.programMatchRate}%`}
            subtitle="Jobs → Programs"
            status={stats.programMatchRate >= 80 ? 'good' : stats.programMatchRate >= 50 ? 'warning' : 'critical'}
          />
          <KPICard
            title="Quality Score"
            value={`${overallQuality}%`}
            subtitle="Overall"
            status={overallQuality >= 80 ? 'good' : overallQuality >= 50 ? 'warning' : 'critical'}
          />
        </div>

        {/* Correlation Coverage */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Correlation Coverage</h2>
          <div className="space-y-4">
            <ProgressBar
              label="Jobs → Programs"
              value={stats.jobsWithPrograms}
              total={stats.totalJobs}
            />
            <ProgressBar
              label="Jobs → Contacts"
              value={stats.jobsWithContacts}
              total={stats.totalJobs}
            />
            <ProgressBar
              label="Jobs → Related Jobs"
              value={stats.jobsWithRelatedJobs}
              total={stats.totalJobs}
            />
          </div>
        </div>

        {/* Data Completeness */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Jobs Completeness */}
          {jobMetrics && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Jobs Data</h3>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  jobMetrics.completeness >= 80 ? 'bg-green-100 text-green-700' :
                  jobMetrics.completeness >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {jobMetrics.completeness}% Complete
                </span>
              </div>
              <div className="space-y-3">
                <ProgressBar label="Has Title" value={jobMetrics.withTitle} total={jobMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Company" value={jobMetrics.withCompany} total={jobMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Location" value={jobMetrics.withLocation} total={jobMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Clearance" value={jobMetrics.withClearance} total={jobMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Program" value={jobMetrics.withProgram} total={jobMetrics.total} showPercentage={false} />
              </div>
            </div>
          )}

          {/* Contacts Completeness */}
          {contactMetrics && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Contacts Data</h3>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  contactMetrics.completeness >= 80 ? 'bg-green-100 text-green-700' :
                  contactMetrics.completeness >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {contactMetrics.completeness}% Complete
                </span>
              </div>
              <div className="space-y-3">
                <ProgressBar label="Has Name" value={contactMetrics.withName} total={contactMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Email" value={contactMetrics.withEmail} total={contactMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Phone" value={contactMetrics.withPhone} total={contactMetrics.total} showPercentage={false} />
                <ProgressBar label="Has LinkedIn" value={contactMetrics.withLinkedIn} total={contactMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Tier" value={contactMetrics.withTier} total={contactMetrics.total} showPercentage={false} />
              </div>
            </div>
          )}

          {/* Programs Completeness */}
          {programMetrics && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Programs Data</h3>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  programMetrics.completeness >= 80 ? 'bg-green-100 text-green-700' :
                  programMetrics.completeness >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {programMetrics.completeness}% Complete
                </span>
              </div>
              <div className="space-y-3">
                <ProgressBar label="Has Name" value={programMetrics.withName} total={programMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Agency" value={programMetrics.withAgency} total={programMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Prime" value={programMetrics.withPrime} total={programMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Value" value={programMetrics.withValue} total={programMetrics.total} showPercentage={false} />
                <ProgressBar label="Has Location" value={programMetrics.withLocation} total={programMetrics.total} showPercentage={false} />
              </div>
            </div>
          )}
        </div>

        {/* Unmatched Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unmatched Jobs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                Unmatched Jobs
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({correlations.filter(c => c.programs.length === 0).length} total)
                </span>
              </h3>
              <button className="text-sm text-blue-600 hover:underline">View All</button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {unmatchedJobs.length > 0 ? (
                unmatchedJobs.map(item => (
                  <UnmatchedItem
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    reason={item.reason}
                    type="job"
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  All jobs are matched to programs
                </p>
              )}
            </div>
          </div>

          {/* Unmatched Contacts */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                Contacts Without Programs
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({flatContacts.filter(c => !c.program && !c.matched_programs?.length).length} total)
                </span>
              </h3>
              <button className="text-sm text-blue-600 hover:underline">View All</button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {unmatchedContacts.length > 0 ? (
                unmatchedContacts.map(item => (
                  <UnmatchedItem
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    reason={item.reason}
                    type="contact"
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  All contacts have program assignments
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Data Source Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-slate-900">Local Files</p>
                  <p className="text-sm text-slate-500">
                    {jobs.length} jobs • {programs.length} programs • {flatContacts.length} contacts
                  </p>
                </div>
              </div>
              <span className="text-sm text-green-600 font-medium">Connected</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-slate-400 rounded-full" />
                <div>
                  <p className="font-medium text-slate-900">Notion API</p>
                  <p className="text-sm text-slate-500">Configure in Settings</p>
                </div>
              </div>
              <span className="text-sm text-slate-500 font-medium">Not Configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataQualityDashboard;
