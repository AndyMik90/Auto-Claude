import { format } from 'date-fns';
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  Circle,
  Phone,
  Mail,
  Users,
  FileText,
  Target,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Briefcase,
  UserCheck,
  Building2,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useBDPlaybook } from '../hooks/useBDPlaybook';
import type { PlaybookTask, TaskType, TaskPriority } from '../services/playbookGenerator';

interface DailyPlaybookProps {
  loading: boolean;
}

const TYPE_ICONS: Record<TaskType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  research: FileText,
  'follow-up': Target,
};

const TYPE_COLORS: Record<TaskType, string> = {
  call: 'bg-green-100 text-green-700',
  email: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  research: 'bg-amber-100 text-amber-700',
  'follow-up': 'bg-cyan-100 text-cyan-700',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
};

const PRIORITY_BG: Record<TaskPriority, string> = {
  critical: 'bg-red-50 border-red-200',
  high: 'bg-orange-50 border-orange-200',
  medium: 'bg-white border-slate-200',
  low: 'bg-white border-slate-200',
};

function TaskCard({ task, onToggle }: { task: PlaybookTask; onToggle: () => void }) {
  const TypeIcon = TYPE_ICONS[task.type];
  const typeColor = TYPE_COLORS[task.type];
  const priorityColor = PRIORITY_COLORS[task.priority];
  const priorityBg = PRIORITY_BG[task.priority];

  return (
    <div
      className={`rounded-lg shadow-sm border p-4 transition-all ${priorityBg} ${
        task.completed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-1 flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}
        >
          {task.completed ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColor}`}>
              <TypeIcon className="h-3 w-3 inline mr-1" />
              {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
            </span>
            <span className={`text-xs font-medium ${priorityColor}`}>
              {task.priority.toUpperCase()}
            </span>
            {task.priority === 'critical' && (
              <AlertTriangle className={`h-4 w-4 ${priorityColor}`} />
            )}
          </div>

          <h3 className={`font-medium text-slate-900 ${task.completed ? 'line-through' : ''}`}>
            {task.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">{task.description}</p>

          {(task.contact || task.program) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {task.contact && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Contact: {task.contact}
                </span>
              )}
              {task.program && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  {task.program}
                </span>
              )}
            </div>
          )}
        </div>

        {task.time && (
          <div className="flex-shrink-0 text-right">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {task.time}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function EnrichmentStatsCard({ stats }: { stats: ReturnType<typeof useBDPlaybook>['enrichmentStats'] }) {
  if (!stats) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Data Enrichment Stats
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-slate-500">Jobs Analyzed</div>
          <div className="text-xl font-bold text-slate-900">{stats.totalJobs}</div>
        </div>
        <div>
          <div className="text-slate-500">Matched to Programs</div>
          <div className="text-xl font-bold text-green-600">{stats.matchedToProgram}</div>
          <div className="text-xs text-slate-400">
            {Math.round(stats.matchRate * 100)}% match rate
          </div>
        </div>
        <div>
          <div className="text-slate-500">With Contacts</div>
          <div className="text-xl font-bold text-blue-600">{stats.withContacts}</div>
        </div>
        <div>
          <div className="text-slate-500">Critical Priority</div>
          <div className="text-xl font-bold text-red-600">{stats.byPriority.critical}</div>
        </div>
      </div>
      {stats.topPrograms.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-1">Top Programs:</div>
          <div className="flex flex-wrap gap-1">
            {stats.topPrograms.slice(0, 5).map((p) => (
              <span key={p.name} className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                {p.name} ({p.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaybookStatsCard({ playbook }: { playbook: ReturnType<typeof useBDPlaybook>['playbook'] }) {
  if (!playbook) return null;

  const { stats } = playbook;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 text-center">
        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        <div className="text-xs text-slate-500">Total Tasks</div>
      </div>
      <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-3 text-center">
        <div className="text-2xl font-bold text-red-600">{stats.byPriority.critical}</div>
        <div className="text-xs text-slate-500">Critical</div>
      </div>
      <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-3 text-center">
        <div className="text-2xl font-bold text-orange-600">{stats.byPriority.high}</div>
        <div className="text-xs text-slate-500">High</div>
      </div>
      <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-3 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.byType.call + stats.byType.email}</div>
        <div className="text-xs text-slate-500">Outreach</div>
      </div>
      <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-200 p-3 text-center">
        <div className="text-2xl font-bold text-purple-600">{stats.byType.meeting}</div>
        <div className="text-xs text-slate-500">Meetings</div>
      </div>
    </div>
  );
}

export function DailyPlaybook({ loading: _parentLoading }: DailyPlaybookProps) {
  const {
    playbook,
    enrichedJobs,
    contacts,
    programs,
    loading,
    error,
    isConfigured,
    enrichmentStats,
    refresh,
    setDate,
    toggleTask,
    currentDate,
  } = useBDPlaybook();

  const goToPreviousDay = () => {
    setDate(new Date(currentDate.getTime() - 86400000));
  };

  const goToNextDay = () => {
    setDate(new Date(currentDate.getTime() + 86400000));
  };

  const goToToday = () => {
    setDate(new Date());
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-slate-600">Loading BD data and generating playbook...</p>
      </div>
    );
  }

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Building2 className="h-16 w-16 text-slate-300 mb-4" />
        <p className="text-xl font-semibold text-slate-700 mb-2">Notion Not Configured</p>
        <p className="text-center max-w-md mb-4">
          To generate your BD Playbook, connect your Notion workspace in Settings.
          The playbook automatically analyzes your jobs, programs, and contacts.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertTriangle className="h-16 w-16 text-red-400 mb-4" />
        <p className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</p>
        <p className="text-center max-w-md mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // No data state
  if (!playbook || playbook.tasks.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Playbook</h1>
            <p className="text-slate-500">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={refresh}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Enrichment Stats */}
        <EnrichmentStatsCard stats={enrichmentStats} />

        {/* No tasks message */}
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <Calendar className="h-16 w-16 text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-700 mb-2">No Tasks for This Date</p>
          <p className="text-center max-w-md mb-4">
            There are no BD tasks scheduled for {format(currentDate, 'MMMM d, yyyy')}.
            Try navigating to today or check your data sources.
          </p>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Today
            </button>
          </div>
        </div>

        {/* Data summary */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              {enrichedJobs.length} jobs analyzed
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {programs.length} programs loaded
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              {contacts.length} contacts available
            </span>
          </div>
        </div>
      </div>
    );
  }

  const tasks = playbook.tasks;
  const completedCount = tasks.filter((t) => t.completed).length;
  const scheduledTasks = tasks.filter((t) => t.time);
  const unscheduledTasks = tasks.filter((t) => !t.time);

  // Group unscheduled by priority
  const criticalTasks = unscheduledTasks.filter(t => t.priority === 'critical');
  const highTasks = unscheduledTasks.filter(t => t.priority === 'high');
  const otherTasks = unscheduledTasks.filter(t => t.priority !== 'critical' && t.priority !== 'high');

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Playbook</h1>
          <p className="text-slate-500">
            {completedCount}/{tasks.length} tasks completed
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2 hover:bg-slate-50"
            >
              <CalendarCheck className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-slate-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </button>
            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Playbook Stats */}
      <PlaybookStatsCard playbook={playbook} />

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Today's Progress</span>
          <span className="text-sm font-bold text-slate-900">
            {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Enrichment Stats (collapsible) */}
      <EnrichmentStatsCard stats={enrichmentStats} />

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Critical Tasks - Always show first */}
        {criticalTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Priority ({criticalTasks.length})
            </h2>
            <div className="space-y-3">
              {criticalTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Tasks */}
        {scheduledTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Scheduled ({scheduledTasks.length})
            </h2>
            <div className="space-y-3">
              {scheduledTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}

        {/* High Priority Tasks */}
        {highTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-orange-700 mb-3 flex items-center gap-2">
              <Target className="h-5 w-5" />
              High Priority ({highTasks.length})
            </h2>
            <div className="space-y-3">
              {highTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Other Tasks */}
        {otherTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              Other Tasks ({otherTasks.length})
            </h2>
            <div className="space-y-3">
              {otherTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Data summary footer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              {enrichedJobs.length} jobs
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {programs.length} programs
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              {contacts.length} contacts
            </span>
          </div>
          <span className="text-slate-400">
            Playbook auto-generated from your Notion data
          </span>
        </div>
      </div>
    </div>
  );
}
