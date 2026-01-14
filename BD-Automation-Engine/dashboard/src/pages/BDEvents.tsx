import { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Users,
  Building2,
  Plus,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Info,
} from 'lucide-react';
import type { Program, Contact } from '../types';

interface BDEventsProps {
  programs: Program[];
  contacts: Record<string, Contact[]>;
  loading: boolean;
  onNavigateToProgram?: (programName: string) => void;
}

// Placeholder BD Event interface
interface BDEvent {
  id: string;
  name: string;
  type: 'conference' | 'trade_show' | 'networking' | 'webinar' | 'meeting' | 'briefing' | 'other';
  date: string;
  endDate?: string;
  location: string;
  description?: string;
  website?: string;
  attendingPrimes: string[];
  attendingPrograms: string[];
  targetContacts: string[];
  notes?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
}

// Sample placeholder events (in real app, these would come from storage/API)
const SAMPLE_EVENTS: BDEvent[] = [
  {
    id: 'evt-1',
    name: 'FedTech Connect 2026',
    type: 'conference',
    date: '2026-02-15',
    endDate: '2026-02-17',
    location: 'Washington, D.C.',
    description: 'Annual federal technology conference featuring top primes and government agencies.',
    website: 'https://example.com/fedtech',
    attendingPrimes: ['General Dynamics', 'Northrop Grumman', 'Leidos'],
    attendingPrograms: ['DCGS-A', 'JADC2'],
    targetContacts: [],
    priority: 'high',
    status: 'upcoming',
  },
  {
    id: 'evt-2',
    name: 'AFCEA West',
    type: 'trade_show',
    date: '2026-03-10',
    endDate: '2026-03-12',
    location: 'San Diego, CA',
    description: 'Major defense and government IT trade show.',
    attendingPrimes: ['Raytheon', 'L3Harris', 'BAE Systems'],
    attendingPrograms: [],
    targetContacts: [],
    priority: 'high',
    status: 'upcoming',
  },
  {
    id: 'evt-3',
    name: 'DoD Cloud Modernization Webinar',
    type: 'webinar',
    date: '2026-01-25',
    location: 'Virtual',
    description: 'Discussion on cloud modernization strategies in DoD.',
    attendingPrimes: [],
    attendingPrograms: [],
    targetContacts: [],
    priority: 'medium',
    status: 'upcoming',
  },
];

const EVENT_TYPE_LABELS: Record<BDEvent['type'], string> = {
  conference: 'Conference',
  trade_show: 'Trade Show',
  networking: 'Networking',
  webinar: 'Webinar',
  meeting: 'Meeting',
  briefing: 'Briefing',
  other: 'Other',
};

const EVENT_TYPE_COLORS: Record<BDEvent['type'], string> = {
  conference: 'bg-purple-100 text-purple-700',
  trade_show: 'bg-blue-100 text-blue-700',
  networking: 'bg-green-100 text-green-700',
  webinar: 'bg-cyan-100 text-cyan-700',
  meeting: 'bg-amber-100 text-amber-700',
  briefing: 'bg-red-100 text-red-700',
  other: 'bg-slate-100 text-slate-700',
};

const PRIORITY_COLORS: Record<BDEvent['priority'], string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

function EventCard({
  event,
  expanded,
  onToggle,
  onNavigateToProgram,
}: {
  event: BDEvent;
  expanded: boolean;
  onToggle: () => void;
  onNavigateToProgram?: (programName: string) => void;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">{event.name}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${EVENT_TYPE_COLORS[event.type]}`}>
                {EVENT_TYPE_LABELS[event.type]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(event.date)}
                {event.endDate && ` - ${formatDate(event.endDate)}`}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-1 rounded ${PRIORITY_COLORS[event.priority]}`}>
            {event.priority.charAt(0).toUpperCase() + event.priority.slice(1)}
          </span>
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {getDaysUntil(event.date)}
          </span>
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
          {event.description && (
            <p className="text-sm text-slate-600">{event.description}</p>
          )}

          {/* Attending Primes */}
          {event.attendingPrimes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                Attending Primes
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.attendingPrimes.map((prime, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700"
                  >
                    {prime}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attending Programs */}
          {event.attendingPrograms.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                Related Programs
              </h4>
              <div className="flex flex-wrap gap-2">
                {event.attendingPrograms.map((program, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigateToProgram?.(program)}
                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    {program}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            {event.website && (
              <a
                href={event.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Event Website
              </a>
            )}
            <span className="text-xs text-slate-400">
              ID: {event.id}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function BDEvents({
  loading,
  onNavigateToProgram,
}: BDEventsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Use sample events for now
  const events = SAMPLE_EVENTS;

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          event.name.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.attendingPrimes.some((p) => p.toLowerCase().includes(query)) ||
          event.attendingPrograms.some((p) => p.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && event.type !== typeFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== 'all' && event.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, typeFilter, priorityFilter]);

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
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

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BD Events</h1>
          <p className="text-slate-500">
            {events.length} events &bull; {filteredEvents.length} shown
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => {
            // Placeholder for add event modal
            alert('Add Event functionality coming soon!\n\nThis will allow you to manually add BD events, link them to programs and primes, and track target contacts.');
          }}
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">BD Events - Beta Feature</p>
          <p className="text-blue-700">
            Track upcoming conferences, trade shows, and networking events. Link events to programs and contacts
            for coordinated BD activities. Currently showing sample data - add your own events to get started.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search events, primes, programs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Calendar className="h-12 w-12 mb-4 text-slate-300" />
            <p className="mb-2">No events match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setPriorityFilter('all');
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                expanded={expandedEvents.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
                onNavigateToProgram={onNavigateToProgram}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Upcoming: {events.filter((e) => e.status === 'upcoming').length}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            Unique Primes: {new Set(events.flatMap((e) => e.attendingPrimes)).size}
          </span>
        </div>
        <span>Data source: Manual entry</span>
      </div>
    </div>
  );
}
