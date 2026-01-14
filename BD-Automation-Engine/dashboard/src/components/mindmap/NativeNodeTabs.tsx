// NativeNodeTabs.tsx - Tab selector for switching between native node views
import { Target, FileText, User, MapPin, Calendar, Building2, Landmark, Briefcase } from 'lucide-react';
import type { NativeNodeType } from '../../configs/nativeNodeConfigs';
import { NATIVE_NODE_TABS } from '../../configs/nativeNodeConfigs';

interface NativeNodeTabsProps {
  activeType: NativeNodeType;
  onTypeChange: (type: NativeNodeType) => void;
  disabled?: boolean;
}

// Icon mapping for each node type
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  FileText,
  User,
  MapPin,
  Calendar,
  Building2,
  Landmark,
  Briefcase,
};

function TabIcon({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = iconMap[iconName];
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
}

export function NativeNodeTabs({ activeType, onTypeChange, disabled }: NativeNodeTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
      {NATIVE_NODE_TABS.map((tab) => {
        const isActive = tab.type === activeType;
        return (
          <button
            key={tab.type}
            onClick={() => onTypeChange(tab.type)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
              transition-all duration-200
              ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={tab.label}
          >
            <TabIcon iconName={tab.icon} className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// Compact version for smaller screens
export function NativeNodeTabsCompact({ activeType, onTypeChange, disabled }: NativeNodeTabsProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md">
      {NATIVE_NODE_TABS.map((tab) => {
        const isActive = tab.type === activeType;
        return (
          <button
            key={tab.type}
            onClick={() => onTypeChange(tab.type)}
            disabled={disabled}
            className={`
              p-2 rounded transition-all duration-200
              ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={tab.label}
          >
            <TabIcon iconName={tab.icon} className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

// Dropdown version for very small screens
interface NativeNodeDropdownProps extends NativeNodeTabsProps {
  className?: string;
}

export function NativeNodeDropdown({
  activeType,
  onTypeChange,
  disabled,
  className = '',
}: NativeNodeDropdownProps) {
  const activeTab = NATIVE_NODE_TABS.find((t) => t.type === activeType) || NATIVE_NODE_TABS[0];

  return (
    <div className={`relative ${className}`}>
      <select
        value={activeType}
        onChange={(e) => onTypeChange(e.target.value as NativeNodeType)}
        disabled={disabled}
        className={`
          appearance-none w-full px-4 py-2 pr-8
          bg-white border border-slate-300 rounded-lg
          text-sm font-medium text-slate-700
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {NATIVE_NODE_TABS.map((tab) => (
          <option key={tab.type} value={tab.type}>
            {tab.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <TabIcon iconName={activeTab.icon} className="w-4 h-4 text-slate-500" />
      </div>
    </div>
  );
}

export default NativeNodeTabs;
