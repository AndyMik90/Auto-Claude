import { useMemo } from 'react';
import { Target, Users, Briefcase, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Job, Program, Contact, CorrelationSummary } from '../types';

interface OpportunitiesProps {
  jobs: Job[];
  programs: Program[];
  contacts: Record<string, Contact[]>;
  summary: CorrelationSummary | null;
  loading: boolean;
}

interface Opportunity {
  id: string;
  type: 'high_value_job' | 'connected_program' | 'executive_contact' | 'gap_analysis';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  actions: string[];
  relatedItems: string[];
  score: number;
}

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const PRIORITY_ICONS = {
  critical: AlertTriangle,
  high: TrendingUp,
  medium: Clock,
  low: CheckCircle2,
};

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const priorityColor = PRIORITY_COLORS[opportunity.priority];
  const PriorityIcon = PRIORITY_ICONS[opportunity.priority];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${priorityColor}`}>
            <PriorityIcon className="h-4 w-4" />
          </div>
          <div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityColor}`}>
              {opportunity.priority.charAt(0).toUpperCase() + opportunity.priority.slice(1)}
            </span>
          </div>
        </div>
        <span className="text-lg font-bold text-slate-400">{opportunity.score}</span>
      </div>

      <h3 className="font-semibold text-slate-900 mb-2">{opportunity.title}</h3>
      <p className="text-sm text-slate-600 mb-4">{opportunity.description}</p>

      {opportunity.actions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Recommended Actions</p>
          <ul className="space-y-1">
            {opportunity.actions.map((action, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {opportunity.relatedItems.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Related</p>
          <div className="flex flex-wrap gap-1">
            {opportunity.relatedItems.slice(0, 3).map((item, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Opportunities({ jobs, programs, contacts, summary, loading }: OpportunitiesProps) {
  // Generate opportunities based on data analysis
  const opportunities = useMemo<Opportunity[]>(() => {
    const opps: Opportunity[] = [];

    // 1. High-value jobs with critical priority
    const criticalJobs = jobs.filter((j) => {
      if (typeof j.bd_priority === 'number') return j.bd_priority >= 80;
      const str = String(j.bd_priority).toLowerCase();
      return str.includes('critical') || str.includes('🔴');
    });

    criticalJobs.slice(0, 5).forEach((job) => {
      opps.push({
        id: `job-${job.id}`,
        type: 'high_value_job',
        title: `Critical Priority: ${job.title}`,
        description: `High-priority job opportunity at ${job.company || 'Unknown Company'}. ${job.clearance ? `Requires ${job.clearance} clearance.` : ''}`,
        priority: 'critical',
        score: typeof job.bd_priority === 'number' ? Math.round(job.bd_priority) : 90,
        actions: [
          'Review job requirements and qualifications',
          'Identify internal candidates with matching skills',
          'Prepare competitive bid strategy',
        ],
        relatedItems: [job.company, job.location, job.program_name].filter(Boolean) as string[],
      });
    });

    // 2. Programs with high contact count (connected programs)
    const connectedPrograms = programs
      .filter((p) => p.contact_count > 10)
      .sort((a, b) => b.contact_count - a.contact_count)
      .slice(0, 5);

    connectedPrograms.forEach((program) => {
      opps.push({
        id: `program-${program.id}`,
        type: 'connected_program',
        title: `Well-Connected: ${program.name}`,
        description: `Program with ${program.contact_count} known contacts. Strong network position for BD activities.`,
        priority: 'high',
        score: Math.min(100, Math.round(50 + program.contact_count * 2)),
        actions: [
          'Map key stakeholders and decision makers',
          'Schedule informational meetings',
          'Identify partnership opportunities',
        ],
        relatedItems: [program.prime_contractor, program.agency, program.location].filter(Boolean) as string[],
      });
    });

    // 3. Tier 1 executives (high-value contacts)
    const tier1Contacts = contacts['1'] || [];
    if (tier1Contacts.length > 0) {
      opps.push({
        id: 'executive-contacts',
        type: 'executive_contact',
        title: `${tier1Contacts.length} Executive-Level Contacts`,
        description: 'C-Suite and executive contacts available for strategic engagement.',
        priority: 'high',
        score: 85,
        actions: [
          'Prioritize relationship building with key executives',
          'Plan executive briefings and presentations',
          'Identify warm introduction opportunities',
        ],
        relatedItems: tier1Contacts.slice(0, 3).map((c) => c.name || c.title || 'Executive'),
      });
    }

    // 4. Gap analysis opportunities
    if (summary) {
      const { match_rates } = summary.statistics;

      if (match_rates.jobs_to_programs < 10) {
        opps.push({
          id: 'gap-jobs-programs',
          type: 'gap_analysis',
          title: 'Job-Program Correlation Gap',
          description: `Only ${match_rates.jobs_to_programs.toFixed(1)}% of jobs are matched to programs. Opportunity to improve data linkage.`,
          priority: 'medium',
          score: 60,
          actions: [
            'Review program tagging in job records',
            'Run enhanced matching algorithms',
            'Update program database with missing entries',
          ],
          relatedItems: ['Data Quality', 'Matching Engine', 'Program Database'],
        });
      }

      if (match_rates.contacts_to_programs < 50) {
        opps.push({
          id: 'gap-contacts-programs',
          type: 'gap_analysis',
          title: 'Contact-Program Intelligence Gap',
          description: `${match_rates.contacts_to_programs.toFixed(1)}% contact-program match rate. Room for improved intelligence mapping.`,
          priority: 'low',
          score: 40,
          actions: [
            'Enrich contact records with program affiliations',
            'Cross-reference LinkedIn data',
            'Update organizational mapping',
          ],
          relatedItems: ['Contact Intelligence', 'Program Mapping'],
        });
      }
    }

    // Sort by score descending
    return opps.sort((a, b) => b.score - a.score);
  }, [jobs, programs, contacts, summary]);

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
        <h1 className="text-2xl font-bold text-slate-900">BD Opportunities</h1>
        <p className="text-slate-500">AI-identified opportunities based on data correlation analysis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {opportunities.filter((o) => o.priority === 'critical').length}
              </p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {opportunities.filter((o) => o.priority === 'high').length}
              </p>
              <p className="text-xs text-slate-500">High Priority</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{(contacts['1'] || []).length}</p>
              <p className="text-xs text-slate-500">Executives</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Briefcase className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{programs.filter((p) => p.contact_count > 10).length}</p>
              <p className="text-xs text-slate-500">Connected Programs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="flex-1 overflow-y-auto">
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Target className="h-12 w-12 mb-4 text-slate-300" />
            <p>No opportunities identified yet. Run the correlation engine to generate insights.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
