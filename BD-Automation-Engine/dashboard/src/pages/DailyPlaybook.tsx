import { useState } from 'react';
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
} from 'lucide-react';

interface DailyPlaybookProps {
  loading: boolean;
}

interface PlaybookTask {
  id: string;
  time?: string;
  title: string;
  description: string;
  type: 'call' | 'email' | 'meeting' | 'research' | 'follow-up';
  priority: 'critical' | 'high' | 'medium' | 'low';
  completed: boolean;
  contact?: string;
  program?: string;
}

// Demo data - in production, this would come from the Playbook Generator
const DEMO_TASKS: PlaybookTask[] = [
  {
    id: '1',
    time: '9:00 AM',
    title: 'Review Critical Job Postings',
    description: 'Analyze 2 new critical-priority positions posted overnight',
    type: 'research',
    priority: 'critical',
    completed: false,
    program: 'DCGS-A',
  },
  {
    id: '2',
    time: '10:30 AM',
    title: 'Follow-up Call with GDIT PM',
    description: 'Discuss partnership opportunities on DES contract',
    type: 'call',
    priority: 'high',
    completed: false,
    contact: 'John Smith',
    program: 'Defense Enclave Services',
  },
  {
    id: '3',
    time: '11:00 AM',
    title: 'Send Executive Briefing',
    description: 'Prepare and send weekly BD metrics to leadership',
    type: 'email',
    priority: 'high',
    completed: false,
  },
  {
    id: '4',
    time: '2:00 PM',
    title: 'Team Meeting: Pipeline Review',
    description: 'Weekly review of job pipeline and contact status updates',
    type: 'meeting',
    priority: 'medium',
    completed: false,
  },
  {
    id: '5',
    title: 'Update Contact Records',
    description: 'Process 15 new LinkedIn connections into database',
    type: 'research',
    priority: 'low',
    completed: true,
  },
  {
    id: '6',
    title: 'DISA Contract Research',
    description: 'Research upcoming recompete opportunities',
    type: 'follow-up',
    priority: 'medium',
    completed: false,
    program: 'DISA Supply Chain Mgmt',
  },
];

const TYPE_ICONS = {
  call: Phone,
  email: Mail,
  meeting: Users,
  research: FileText,
  'follow-up': Target,
};

const TYPE_COLORS = {
  call: 'bg-green-100 text-green-700',
  email: 'bg-blue-100 text-blue-700',
  meeting: 'bg-purple-100 text-purple-700',
  research: 'bg-amber-100 text-amber-700',
  'follow-up': 'bg-cyan-100 text-cyan-700',
};

const PRIORITY_COLORS = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
};

function TaskCard({ task, onToggle }: { task: PlaybookTask; onToggle: () => void }) {
  const TypeIcon = TYPE_ICONS[task.type];
  const typeColor = TYPE_COLORS[task.type];
  const priorityColor = PRIORITY_COLORS[task.priority];

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 transition-all ${
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

export function DailyPlaybook({ loading }: DailyPlaybookProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState(DEMO_TASKS);

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const goToPreviousDay = () => {
    setSelectedDate((prev) => new Date(prev.getTime() - 86400000));
  };

  const goToNextDay = () => {
    setSelectedDate((prev) => new Date(prev.getTime() + 86400000));
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const scheduledTasks = tasks.filter((t) => t.time);
  const unscheduledTasks = tasks.filter((t) => !t.time);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Playbook</h1>
          <p className="text-slate-500">
            {completedCount}/{tasks.length} tasks completed
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="px-4 py-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-slate-900">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Today's Progress</span>
          <span className="text-sm font-bold text-slate-900">
            {Math.round((completedCount / tasks.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Scheduled Tasks */}
        {scheduledTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Scheduled
            </h2>
            <div className="space-y-3">
              {scheduledTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Unscheduled Tasks */}
        {unscheduledTasks.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-slate-400" />
              To Do (Anytime)
            </h2>
            <div className="space-y-3">
              {unscheduledTasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Playbook CTA */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900">Playbook Generator</p>
            <p className="text-sm text-blue-700">
              Run the BD Playbook Generator to create AI-powered daily tasks based on your data.
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Generate Playbook
          </button>
        </div>
      </div>
    </div>
  );
}
