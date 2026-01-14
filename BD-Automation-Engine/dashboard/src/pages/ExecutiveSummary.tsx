import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Briefcase, Building2, Users, Factory, TrendingUp, AlertCircle } from 'lucide-react';
import type { CorrelationSummary } from '../types';

interface ExecutiveSummaryProps {
  summary: CorrelationSummary | null;
  loading: boolean;
}

const TIER_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#6b7280'];
const PRIORITY_COLORS = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function MatchRateCard({
  title,
  rate,
  matched,
  total,
}: {
  title: string;
  rate: number;
  matched: number;
  total: number;
}) {
  const getColorClass = (rate: number) => {
    if (rate >= 50) return 'text-green-600 bg-green-100';
    if (rate >= 25) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600">{title}</span>
        <span className={`text-sm font-bold px-2 py-0.5 rounded ${getColorClass(rate)}`}>
          {rate.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${rate >= 50 ? 'bg-green-500' : rate >= 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {matched.toLocaleString()} / {total.toLocaleString()} matched
      </p>
    </div>
  );
}

export function ExecutiveSummary({ summary, loading }: ExecutiveSummaryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p>No data available. Run the correlation engine to generate data.</p>
      </div>
    );
  }

  const { statistics, priority_distribution, contacts_by_tier, top_programs_by_jobs } = summary;

  // Prepare tier data for pie chart
  const tierData = Object.entries(contacts_by_tier).map(([tier, count], index) => ({
    name: `Tier ${tier}`,
    value: count,
    color: TIER_COLORS[index] || TIER_COLORS[5],
  }));

  // Prepare priority data
  const priorityData = Object.entries(priority_distribution).map(([priority, count]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count,
    color: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#6b7280',
  }));

  // Prepare programs data for bar chart
  const programsData = top_programs_by_jobs.slice(0, 5).map((p) => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
    contacts: p.contact_count,
    jobs: p.job_count,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Summary</h1>
          <p className="text-slate-500">
            BD Intelligence Overview &bull; Generated {new Date(summary.generated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <TrendingUp className="h-5 w-5" />
          <span className="text-sm font-medium">Live Data</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={statistics.total_jobs}
          icon={Briefcase}
          color="bg-blue-600"
          subtitle="In pipeline"
        />
        <StatCard
          title="Programs"
          value={statistics.total_programs}
          icon={Building2}
          color="bg-purple-600"
          subtitle="Active contracts"
        />
        <StatCard
          title="Contacts"
          value={statistics.total_contacts}
          icon={Users}
          color="bg-cyan-600"
          subtitle="Intelligence database"
        />
        <StatCard
          title="Contractors"
          value={statistics.total_contractors}
          icon={Factory}
          color="bg-orange-600"
          subtitle="Prime & subs"
        />
      </div>

      {/* Match Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MatchRateCard
          title="Jobs → Programs"
          rate={statistics.match_rates.jobs_to_programs}
          matched={statistics.jobs_matched_to_programs}
          total={statistics.total_jobs}
        />
        <MatchRateCard
          title="Jobs → Contacts"
          rate={statistics.match_rates.jobs_to_contacts}
          matched={statistics.jobs_matched_to_contacts}
          total={statistics.total_jobs}
        />
        <MatchRateCard
          title="Contacts → Programs"
          rate={statistics.match_rates.contacts_to_programs}
          matched={statistics.contacts_matched_to_programs}
          total={statistics.total_contacts}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Tiers Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Contacts by Tier</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {tierData.map((tier, index) => (
              <div key={index} className="flex items-center gap-1.5 text-sm">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: tier.color }} />
                <span className="text-slate-600">{tier.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Jobs by Priority</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 justify-center">
            {priorityData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 text-sm">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Programs Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Programs by Contact Count</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={programsData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="contacts" fill="#2563eb" radius={[0, 4, 4, 0]} name="Contacts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
