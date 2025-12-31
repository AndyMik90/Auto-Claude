/**
 * Roadmap-related constants
 * Feature priority, complexity, and impact indicators
 */

// ============================================
// Roadmap Priority
// ============================================

export const ROADMAP_PRIORITY_LABELS: Record<string, string> = {
  must: 'priority.must',
  should: 'priority.should',
  could: 'priority.could',
  wont: 'priority.wont'
};

export const ROADMAP_PRIORITY_COLORS: Record<string, string> = {
  must: 'bg-destructive/10 text-destructive border-destructive/30',
  should: 'bg-warning/10 text-warning border-warning/30',
  could: 'bg-info/10 text-info border-info/30',
  wont: 'bg-muted text-muted-foreground border-muted'
};

// ============================================
// Roadmap Complexity
// ============================================

export const ROADMAP_COMPLEXITY_COLORS: Record<string, string> = {
  low: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive'
};

// ============================================
// Roadmap Impact
// ============================================

export const ROADMAP_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-success/10 text-success'
};

// ============================================
// Roadmap Status (for Kanban columns)
// ============================================

export interface RoadmapStatusColumn {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export const ROADMAP_STATUS_COLUMNS: RoadmapStatusColumn[] = [
  { id: 'under_review', label: 'status.underReview', color: 'border-t-muted-foreground/50', icon: 'Eye' },
  { id: 'planned', label: 'status.planned', color: 'border-t-info', icon: 'Calendar' },
  { id: 'in_progress', label: 'status.inProgress', color: 'border-t-primary', icon: 'Play' },
  { id: 'done', label: 'status.done', color: 'border-t-success', icon: 'Check' }
];

export const ROADMAP_STATUS_LABELS: Record<string, string> = {
  under_review: 'status.underReview',
  planned: 'status.planned',
  in_progress: 'status.inProgress',
  done: 'status.done'
};

export const ROADMAP_STATUS_COLORS: Record<string, string> = {
  under_review: 'bg-muted text-muted-foreground',
  planned: 'bg-info/10 text-info',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success'
};
