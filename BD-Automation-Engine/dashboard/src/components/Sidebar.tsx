import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  Factory,
  MapPin,
  Calendar,
  Target,
  CalendarCheck,
  Network,
  Settings,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { TabId } from '../types';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'executive', label: 'Executive Summary', icon: LayoutDashboard },
  { id: 'jobs', label: 'Jobs Pipeline', icon: Briefcase },
  { id: 'programs', label: 'Programs/Contracts', icon: Building2 },
  { id: 'contacts', label: 'Contact Intelligence', icon: Users },
  { id: 'contractors', label: 'Contractors', icon: Factory },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'events', label: 'BD Events', icon: Calendar },
  { id: 'opportunities', label: 'BD Opportunities', icon: Target },
  { id: 'playbook', label: 'Daily Playbook', icon: CalendarCheck },
  { id: 'mindmap', label: 'Mind Map', icon: Network },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  activeTab,
  onTabChange,
  onRefresh,
  isRefreshing,
  lastUpdated,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside
      className={`bg-slate-900 text-white flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-blue-400">BD Intelligence</h1>
            <p className="text-xs text-slate-400">Dashboard</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-slate-400" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id}>
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={collapsed ? tab.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{tab.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            isRefreshing
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title={collapsed ? 'Refresh Data' : undefined}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {!collapsed && <span className="text-sm">Refresh Data</span>}
        </button>
        {!collapsed && lastUpdated && (
          <p className="mt-2 text-xs text-slate-500 text-center">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>
    </aside>
  );
}
