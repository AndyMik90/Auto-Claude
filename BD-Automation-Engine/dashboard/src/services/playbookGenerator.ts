/**
 * BD Playbook Generator
 *
 * Generates daily actionable tasks based on:
 * - Enriched job opportunities
 * - Contact follow-up schedules
 * - Program recompete dates
 * - Priority levels
 */

import type { EnrichedJob } from './enrichmentEngine';
import type { NotionContact, NotionProgram } from './notionApi';

// Playbook task types
export type TaskType = 'call' | 'email' | 'meeting' | 'research' | 'follow-up';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

// A single playbook task
export interface PlaybookTask {
  id: string;
  time?: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  completed: boolean;
  contact?: string;
  contactId?: string;
  program?: string;
  programId?: string;
  jobId?: string;
  dueDate?: Date;
  sourceType: 'job' | 'contact' | 'program' | 'scheduled';
}

// Daily playbook with all tasks
export interface DailyPlaybook {
  date: Date;
  tasks: PlaybookTask[];
  stats: {
    total: number;
    byPriority: Record<TaskPriority, number>;
    byType: Record<TaskType, number>;
  };
}

// Generate unique ID
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate tasks from enriched jobs
 */
function generateJobTasks(enrichedJobs: EnrichedJob[], targetDate: Date): PlaybookTask[] {
  const tasks: PlaybookTask[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const isToday = today.getTime() === target.getTime();

  // Only generate job-based tasks for today or past dates
  if (!isToday && target > today) {
    return tasks;
  }

  // Critical and high priority jobs get immediate attention
  const urgentJobs = enrichedJobs.filter(ej =>
    ej.bdPriority === 'critical' || ej.bdPriority === 'high'
  );

  // Top 5 critical jobs
  const criticalJobs = urgentJobs.filter(ej => ej.bdPriority === 'critical').slice(0, 3);
  criticalJobs.forEach((ej, idx) => {
    const time = `${9 + idx}:00 AM`;

    // Research task for unmatched critical jobs
    if (!ej.matchedProgram) {
      tasks.push({
        id: generateId(),
        time,
        title: `Research: ${ej.job.title}`,
        description: `Critical priority job needs program identification. ${ej.job.company ? `Company: ${ej.job.company}` : ''}`,
        type: 'research',
        priority: 'critical',
        completed: false,
        program: ej.job.program || undefined,
        jobId: ej.job.id,
        sourceType: 'job',
      });
    }

    // Outreach task if we have contacts
    if (ej.relatedContacts.length > 0) {
      const contact = ej.relatedContacts[0];
      const taskType: TaskType = contact.email ? 'email' : contact.phone ? 'call' : 'follow-up';

      tasks.push({
        id: generateId(),
        time: `${9 + idx}:30 AM`,
        title: `${taskType === 'call' ? 'Call' : 'Contact'} ${contact.name}`,
        description: `Discuss ${ej.job.title} opportunity. ${contact.title ? `Title: ${contact.title}` : ''}`,
        type: taskType,
        priority: 'critical',
        completed: false,
        contact: contact.name,
        contactId: contact.id,
        program: ej.matchedProgram?.name,
        programId: ej.matchedProgram?.id,
        jobId: ej.job.id,
        sourceType: 'job',
      });
    }
  });

  // High priority jobs - generate review tasks
  const highJobs = urgentJobs.filter(ej => ej.bdPriority === 'high').slice(0, 5);
  if (highJobs.length > 0) {
    tasks.push({
      id: generateId(),
      time: '11:00 AM',
      title: 'Review High-Priority Jobs',
      description: `${highJobs.length} high-priority opportunities need review: ${highJobs.map(ej => ej.job.title).slice(0, 3).join(', ')}${highJobs.length > 3 ? '...' : ''}`,
      type: 'research',
      priority: 'high',
      completed: false,
      sourceType: 'job',
    });
  }

  // DCGS-specific jobs
  const dcgsJobs = enrichedJobs.filter(ej => ej.job.dcgs_relevance).slice(0, 3);
  if (dcgsJobs.length > 0) {
    tasks.push({
      id: generateId(),
      title: 'Review DCGS Opportunities',
      description: `${dcgsJobs.length} DCGS-relevant jobs identified. Programs: ${[...new Set(dcgsJobs.map(ej => ej.matchedProgram?.name).filter(Boolean))].join(', ') || 'Unmatched'}`,
      type: 'research',
      priority: dcgsJobs.some(ej => ej.bdPriority === 'critical') ? 'high' : 'medium',
      completed: false,
      sourceType: 'job',
    });
  }

  return tasks;
}

/**
 * Generate tasks from contact follow-ups
 */
function generateContactTasks(contacts: NotionContact[], targetDate: Date): PlaybookTask[] {
  const tasks: PlaybookTask[] = [];
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  // Find contacts with outreach due on or before target date
  const dueContacts = contacts.filter(contact => {
    if (!contact.nextOutreachDate) return false;
    const outreachDate = new Date(contact.nextOutreachDate);
    outreachDate.setHours(0, 0, 0, 0);
    return outreachDate <= target;
  });

  // Group by priority
  const criticalContacts = dueContacts.filter(c => c.bdPriority.includes('Critical'));
  const highContacts = dueContacts.filter(c => c.bdPriority.includes('High'));
  const otherContacts = dueContacts.filter(c =>
    !c.bdPriority.includes('Critical') && !c.bdPriority.includes('High')
  );

  // Generate tasks for critical contacts
  criticalContacts.slice(0, 3).forEach(contact => {
    const taskType: TaskType = contact.email ? 'email' : contact.phone ? 'call' : 'follow-up';
    tasks.push({
      id: generateId(),
      title: `Urgent: Contact ${contact.name}`,
      description: `Scheduled outreach due. ${contact.title} at ${contact.company || contact.program}. ${contact.relationshipStrength} relationship.`,
      type: taskType,
      priority: 'critical',
      completed: false,
      contact: contact.name,
      contactId: contact.id,
      program: contact.program || undefined,
      dueDate: new Date(contact.nextOutreachDate),
      sourceType: 'contact',
    });
  });

  // Generate tasks for high priority contacts
  highContacts.slice(0, 5).forEach(contact => {
    const taskType: TaskType = contact.email ? 'email' : contact.phone ? 'call' : 'follow-up';
    tasks.push({
      id: generateId(),
      title: `Follow-up: ${contact.name}`,
      description: `${contact.title || 'Contact'} - ${contact.program || contact.company || 'Unknown program'}`,
      type: taskType,
      priority: 'high',
      completed: false,
      contact: contact.name,
      contactId: contact.id,
      program: contact.program || undefined,
      dueDate: new Date(contact.nextOutreachDate),
      sourceType: 'contact',
    });
  });

  // Batch task for other contacts
  if (otherContacts.length > 0) {
    tasks.push({
      id: generateId(),
      title: 'Standard Contact Follow-ups',
      description: `${otherContacts.length} contacts due for follow-up: ${otherContacts.slice(0, 3).map(c => c.name).join(', ')}${otherContacts.length > 3 ? '...' : ''}`,
      type: 'follow-up',
      priority: 'medium',
      completed: false,
      sourceType: 'contact',
    });
  }

  return tasks;
}

/**
 * Generate tasks from program events (recompetes, etc.)
 */
function generateProgramTasks(programs: NotionProgram[], targetDate: Date): PlaybookTask[] {
  const tasks: PlaybookTask[] = [];
  const target = new Date(targetDate);

  // Find programs with upcoming recompetes
  const upcomingRecompetes = programs.filter(program => {
    if (!program.recompete_date) return false;
    const recompete = new Date(program.recompete_date);
    const monthsUntil = (recompete.getTime() - target.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsUntil > 0 && monthsUntil <= 12; // Within next 12 months
  });

  // Critical programs recompeting soon (3 months)
  const criticalRecompetes = upcomingRecompetes.filter(p => {
    const recompete = new Date(p.recompete_date);
    const monthsUntil = (recompete.getTime() - target.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsUntil <= 3;
  });

  if (criticalRecompetes.length > 0) {
    tasks.push({
      id: generateId(),
      title: 'Review Upcoming Recompetes',
      description: `${criticalRecompetes.length} programs recompeting within 3 months: ${criticalRecompetes.map(p => p.name).join(', ')}`,
      type: 'research',
      priority: 'high',
      completed: false,
      sourceType: 'program',
    });
  }

  // High-priority programs needing attention
  const highPriorityPrograms = programs.filter(p =>
    p.bd_priority?.includes('Critical') || p.bd_priority?.includes('High')
  );

  if (highPriorityPrograms.length > 0 && target.getDay() === 1) { // Mondays
    tasks.push({
      id: generateId(),
      title: 'Weekly Priority Program Review',
      description: `Review status of ${highPriorityPrograms.length} high-priority programs`,
      type: 'meeting',
      priority: 'high',
      completed: false,
      sourceType: 'program',
    });
  }

  return tasks;
}

/**
 * Generate standard scheduled tasks
 */
function generateScheduledTasks(targetDate: Date): PlaybookTask[] {
  const tasks: PlaybookTask[] = [];
  const dayOfWeek = targetDate.getDay();

  // Daily executive briefing prep (weekdays)
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    tasks.push({
      id: generateId(),
      time: '8:30 AM',
      title: 'Review BD Dashboard',
      description: 'Check new jobs, contact updates, and priority changes',
      type: 'research',
      priority: 'medium',
      completed: false,
      sourceType: 'scheduled',
    });
  }

  // Weekly pipeline review (Fridays)
  if (dayOfWeek === 5) {
    tasks.push({
      id: generateId(),
      time: '2:00 PM',
      title: 'Weekly Pipeline Review',
      description: 'Compile weekly BD metrics and prepare executive summary',
      type: 'meeting',
      priority: 'high',
      completed: false,
      sourceType: 'scheduled',
    });
  }

  // Monthly contact database cleanup (1st of month)
  if (targetDate.getDate() === 1) {
    tasks.push({
      id: generateId(),
      title: 'Monthly Contact Audit',
      description: 'Review and update contact database, verify information, archive stale contacts',
      type: 'research',
      priority: 'medium',
      completed: false,
      sourceType: 'scheduled',
    });
  }

  return tasks;
}

/**
 * Generate a complete daily playbook
 */
export function generateDailyPlaybook(
  enrichedJobs: EnrichedJob[],
  contacts: NotionContact[],
  programs: NotionProgram[],
  targetDate: Date = new Date()
): DailyPlaybook {
  // Generate all task types
  const jobTasks = generateJobTasks(enrichedJobs, targetDate);
  const contactTasks = generateContactTasks(contacts, targetDate);
  const programTasks = generateProgramTasks(programs, targetDate);
  const scheduledTasks = generateScheduledTasks(targetDate);

  // Combine and sort tasks
  const allTasks = [...jobTasks, ...contactTasks, ...programTasks, ...scheduledTasks];

  // Sort by priority then by time
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  allTasks.sort((a, b) => {
    // Scheduled tasks (with time) first
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) {
      // Parse time for comparison
      const parseTime = (t: string): number => {
        const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 0;
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      const timeDiff = parseTime(a.time) - parseTime(b.time);
      if (timeDiff !== 0) return timeDiff;
    }
    // Then by priority
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Calculate stats
  const byPriority: Record<TaskPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byType: Record<TaskType, number> = {
    call: 0,
    email: 0,
    meeting: 0,
    research: 0,
    'follow-up': 0,
  };

  allTasks.forEach(task => {
    byPriority[task.priority]++;
    byType[task.type]++;
  });

  return {
    date: targetDate,
    tasks: allTasks,
    stats: {
      total: allTasks.length,
      byPriority,
      byType,
    },
  };
}

/**
 * Get priority label with emoji
 */
export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return 'Unknown';
  }
}

/**
 * Filter playbook tasks by criteria
 */
export function filterPlaybookTasks(
  tasks: PlaybookTask[],
  filters: {
    priority?: TaskPriority[];
    type?: TaskType[];
    completed?: boolean;
    sourceType?: PlaybookTask['sourceType'][];
  }
): PlaybookTask[] {
  return tasks.filter(task => {
    if (filters.priority && !filters.priority.includes(task.priority)) return false;
    if (filters.type && !filters.type.includes(task.type)) return false;
    if (filters.completed !== undefined && task.completed !== filters.completed) return false;
    if (filters.sourceType && !filters.sourceType.includes(task.sourceType)) return false;
    return true;
  });
}
