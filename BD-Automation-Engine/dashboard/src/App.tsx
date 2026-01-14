import { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ExecutiveSummary } from './pages/ExecutiveSummary';
import { JobsPipeline } from './pages/JobsPipeline';
import { Programs } from './pages/Programs';
import { Contacts } from './pages/Contacts';
import { Contractors } from './pages/Contractors';
import { Locations } from './pages/Locations';
import { BDEvents } from './pages/BDEvents';
import { Opportunities } from './pages/Opportunities';
import { DailyPlaybook } from './pages/DailyPlaybook';
import { MindMap } from './pages/MindMap';
import { Settings } from './pages/Settings';
import { useData } from './hooks/useData';
import type { TabId } from './types';
import type { NativeNodeType } from './configs/nativeNodeConfigs';
import './index.css';

// Cross-navigation filter state
interface CrossNavFilter {
  type: 'program' | 'contractor' | 'company' | 'location';
  value: string;
}

// Mind map navigation state
interface MindMapNav {
  entityType: NativeNodeType;
  entityId: string;
  entityLabel: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('executive');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data, loading, error, refresh, lastUpdated } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [crossNavFilter, setCrossNavFilter] = useState<CrossNavFilter | null>(null);
  const [mindMapNav, setMindMapNav] = useState<MindMapNav | null>(null);

  // Cross-navigation handlers
  const handleNavigateToProgram = useCallback((programName: string) => {
    setCrossNavFilter({ type: 'program', value: programName });
    setActiveTab('programs');
  }, []);

  const handleNavigateToContractor = useCallback((contractorName: string) => {
    setCrossNavFilter({ type: 'contractor', value: contractorName });
    setActiveTab('contractors');
  }, []);

  const handleNavigateToLocation = useCallback((location: string) => {
    setCrossNavFilter({ type: 'location', value: location });
    setActiveTab('locations');
  }, []);

  // Navigate to Mind Map with a specific entity
  const handleNavigateToMindMap = useCallback(
    (entityType: NativeNodeType, entityId: string, entityLabel: string) => {
      setMindMapNav({ entityType, entityId, entityLabel });
      setActiveTab('mindmap');
    },
    []
  );

  // Clear filter when manually changing tabs
  const handleTabChange = useCallback((tab: TabId) => {
    setCrossNavFilter(null);
    setMindMapNav(null);
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <p className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</p>
          <p className="mb-4">{error}</p>
          <p className="text-sm mb-4">
            Make sure the correlation engine has been run and data files exist in the public/data folder.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'executive':
        return <ExecutiveSummary summary={data?.summary ?? null} loading={loading} />;
      case 'jobs':
        return (
          <JobsPipeline
            jobs={data?.jobs ?? []}
            loading={loading}
            onNavigateToProgram={handleNavigateToProgram}
            onNavigateToLocation={handleNavigateToLocation}
            onNavigateToMindMap={handleNavigateToMindMap}
          />
        );
      case 'programs':
        return (
          <Programs
            programs={data?.programs ?? []}
            loading={loading}
            initialFilter={crossNavFilter?.type === 'program' ? crossNavFilter.value : undefined}
            onNavigateToContractor={handleNavigateToContractor}
            onNavigateToLocation={handleNavigateToLocation}
            onNavigateToMindMap={handleNavigateToMindMap}
          />
        );
      case 'contacts':
        return (
          <Contacts
            contacts={data?.contacts ?? {}}
            loading={loading}
            initialCompanyFilter={crossNavFilter?.type === 'company' ? crossNavFilter.value : undefined}
            onNavigateToProgram={handleNavigateToProgram}
            onNavigateToMindMap={handleNavigateToMindMap}
          />
        );
      case 'contractors':
        return (
          <Contractors
            contractors={data?.contractors ?? []}
            loading={loading}
            initialFilter={crossNavFilter?.type === 'contractor' ? crossNavFilter.value : undefined}
          />
        );
      case 'locations':
        return (
          <Locations
            jobs={data?.jobs ?? []}
            programs={data?.programs ?? []}
            contacts={data?.contacts ?? {}}
            loading={loading}
            initialFilter={crossNavFilter?.type === 'location' ? crossNavFilter.value : undefined}
          />
        );
      case 'events':
        return (
          <BDEvents
            programs={data?.programs ?? []}
            contacts={data?.contacts ?? {}}
            loading={loading}
            onNavigateToProgram={handleNavigateToProgram}
          />
        );
      case 'opportunities':
        return (
          <Opportunities
            jobs={data?.jobs ?? []}
            programs={data?.programs ?? []}
            contacts={data?.contacts ?? {}}
            summary={data?.summary ?? null}
            loading={loading}
          />
        );
      case 'playbook':
        return <DailyPlaybook loading={loading} />;
      case 'mindmap':
        return (
          <MindMap
            initialEntityType={mindMapNav?.entityType}
            initialEntityId={mindMapNav?.entityId}
            initialEntityLabel={mindMapNav?.entityLabel}
          />
        );
      case 'settings':
        return (
          <Settings
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || loading}
        lastUpdated={lastUpdated}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-hidden">{renderContent()}</main>
    </div>
  );
}

export default App;
