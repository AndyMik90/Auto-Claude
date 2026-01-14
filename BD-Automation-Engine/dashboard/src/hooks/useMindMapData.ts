// useMindMapData.ts - Mind Map Data Loading with Tier-Based Progressive Expansion
// Max 20 nodes per expansion tier

import { useEffect, useCallback, useState } from 'react';
import { useMindMapStore } from '../stores/mindMapStore';
import type { MindMapNode, MindMapEdge, NodeType } from '../stores/mindMapStore';
import { useData } from './useData';
import type { Job, Program, Contact, DashboardData } from '../types';
import type { NativeNodeType } from '../configs/nativeNodeConfigs';
import {
  getNodeConfig,
  shouldAutoExpand,
} from '../configs/nativeNodeConfigs';

// ============================================================================
// Constants
// ============================================================================

const MAX_NODES_PER_TIER = 20;
const LOAD_DELAY_MS = 150;

// ============================================================================
// Node ID Utilities
// ============================================================================

function createNodeId(type: NativeNodeType, entityId: string): string {
  return `${type.toLowerCase()}-${entityId}`;
}

function createEdgeId(sourceId: string, targetId: string, relationship: string): string {
  return `${sourceId}-${relationship}-${targetId}`;
}

// ============================================================================
// Data Transformers
// ============================================================================

function jobToNode(
  job: Job,
  tier: number,
  parentId: string | null,
  isNative: boolean = false
): MindMapNode {
  const matchCount =
    (job.matched_programs?.length || 0) + (job.matched_contacts?.length || 0) + (job.location ? 1 : 0);

  return {
    id: createNodeId('JOB', job.id),
    type: 'JOB' as NodeType,
    label: job.title,
    subtitle: job.company,
    priority: normalizePriority(job.bd_priority),
    bdScore: job.bd_score,
    tier,
    clearance: job.clearance,
    tags: job.matched_programs,
    metadata: job as unknown as Record<string, unknown>,
    parentId,
    relationship: parentId ? 'located_at' : undefined,
    isNative,
    isExpanded: isNative,
    isLoading: false,
    childCount: matchCount,
    loadedChildCount: 0,
  };
}

function programToNode(
  program: Program,
  tier: number,
  parentId: string | null,
  isNative: boolean = false
): MindMapNode {
  return {
    id: createNodeId('PROGRAM', program.id),
    type: 'PROGRAM' as NodeType,
    label: program.name,
    subtitle: program.prime_contractor,
    priority: normalizePriority(program.priority),
    tier,
    tags: [program.agency, program.contract_vehicle].filter(Boolean),
    metadata: program as unknown as Record<string, unknown>,
    parentId,
    relationship: parentId ? 'mapped_to' : undefined,
    isNative,
    isExpanded: isNative,
    isLoading: false,
    childCount: program.job_count + program.contact_count,
    loadedChildCount: 0,
  };
}

function contactToNode(
  contact: Contact,
  tier: number,
  parentId: string | null,
  isNative: boolean = false
): MindMapNode {
  return {
    id: createNodeId('CONTACT', contact.id),
    type: 'CONTACT' as NodeType,
    label: contact.name,
    subtitle: contact.title,
    priority: normalizePriority(contact.bd_priority),
    tier,
    tags: contact.matched_programs,
    metadata: contact as unknown as Record<string, unknown>,
    parentId,
    relationship: parentId ? 'works_on' : undefined,
    isNative,
    isExpanded: isNative,
    isLoading: false,
    childCount: contact.matched_programs?.length || 0,
    loadedChildCount: 0,
  };
}

function locationToNode(
  location: string,
  tier: number,
  parentId: string | null,
  counts: { jobs: number; contacts: number; programs: number } = { jobs: 0, contacts: 0, programs: 0 }
): MindMapNode {
  const locationId = location.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    id: createNodeId('LOCATION', locationId),
    type: 'LOCATION' as NodeType,
    label: location,
    tier,
    metadata: { name: location, ...counts },
    parentId,
    relationship: parentId ? 'located_at' : undefined,
    isNative: false,
    isExpanded: false,
    isLoading: false,
    childCount: counts.jobs + counts.contacts + counts.programs,
    loadedChildCount: 0,
  };
}

function primeToNode(
  primeName: string,
  tier: number,
  parentId: string | null,
  programCount: number = 0
): MindMapNode {
  const primeId = primeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return {
    id: createNodeId('PRIME', primeId),
    type: 'PRIME' as NodeType,
    label: primeName,
    tier,
    metadata: { name: primeName, program_count: programCount },
    parentId,
    relationship: parentId ? 'runs' : undefined,
    isNative: false,
    isExpanded: false,
    isLoading: false,
    childCount: programCount,
    loadedChildCount: 0,
  };
}

function normalizePriority(priority: string | number | undefined): MindMapNode['priority'] {
  if (priority === undefined || priority === null) return 'standard';
  const p = String(priority).toLowerCase();
  if (p === 'critical' || p === '1' || p.includes('critical')) return 'critical';
  if (p === 'high' || p === '2' || p.includes('high')) return 'high';
  if (p === 'medium' || p === '3' || p.includes('medium')) return 'medium';
  if (p === 'low' || p === '4' || p.includes('low')) return 'low';
  return 'standard';
}

// ============================================================================
// Graph Building Functions
// ============================================================================

function buildNativeNodeGraph(
  type: NativeNodeType,
  entityId: string,
  dashboardData: DashboardData
): { nodes: MindMapNode[]; edges: MindMapEdge[] } {
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];
  const config = getNodeConfig(type);

  switch (type) {
    case 'JOB': {
      const job = dashboardData.jobs.find((j) => j.id === entityId);
      if (!job) break;

      const nativeNode = jobToNode(job, 0, null, true);
      nodes.push(nativeNode);

      // Tier 1: Auto-expand immediate connections (max 20)
      if (shouldAutoExpand(config, 1)) {
        let addedCount = 0;

        // Add matched programs (limit 5)
        const matchedPrograms = dashboardData.programs
          .filter((p) => job.matched_programs?.includes(p.name))
          .slice(0, Math.min(5, MAX_NODES_PER_TIER - addedCount));

        matchedPrograms.forEach((program) => {
          const programNode = programToNode(program, 1, nativeNode.id);
          nodes.push(programNode);
          edges.push({
            id: createEdgeId(nativeNode.id, programNode.id, 'mapped_to'),
            source: nativeNode.id,
            target: programNode.id,
            relationship: 'mapped_to',
          });
          addedCount++;
        });

        // Add location (limit 1)
        if (job.location && addedCount < MAX_NODES_PER_TIER) {
          const jobsAtLocation = dashboardData.jobs.filter(
            (j) => j.location === job.location
          ).length;
          const locationNode = locationToNode(job.location, 1, nativeNode.id, {
            jobs: jobsAtLocation,
            contacts: 0,
            programs: 0,
          });
          nodes.push(locationNode);
          edges.push({
            id: createEdgeId(nativeNode.id, locationNode.id, 'located_at'),
            source: nativeNode.id,
            target: locationNode.id,
            relationship: 'located_at',
          });
          addedCount++;
        }

        // Add matched contacts (limit remaining)
        const allContacts = Object.values(dashboardData.contacts).flat();
        const matchedContacts = allContacts
          .filter((c) => job.matched_contacts?.includes(c.name))
          .slice(0, Math.min(5, MAX_NODES_PER_TIER - addedCount));

        matchedContacts.forEach((contact) => {
          const contactNode = contactToNode(contact, 1, nativeNode.id);
          nodes.push(contactNode);
          edges.push({
            id: createEdgeId(nativeNode.id, contactNode.id, 'hiring_manager'),
            source: nativeNode.id,
            target: contactNode.id,
            relationship: 'hiring_manager',
          });
          addedCount++;
        });

        // Add prime if company exists
        if (job.company && addedCount < MAX_NODES_PER_TIER) {
          const primePrograms = dashboardData.programs.filter(
            (p) => p.prime_contractor?.toLowerCase() === job.company.toLowerCase()
          ).length;
          const primeNode = primeToNode(job.company, 1, nativeNode.id, primePrograms);
          nodes.push(primeNode);
          edges.push({
            id: createEdgeId(nativeNode.id, primeNode.id, 'posted_by'),
            source: nativeNode.id,
            target: primeNode.id,
            relationship: 'posted_by',
          });
          addedCount++;
        }

        nativeNode.loadedChildCount = addedCount;
      }
      break;
    }

    case 'PROGRAM': {
      const program = dashboardData.programs.find((p) => p.id === entityId);
      if (!program) break;

      const nativeNode = programToNode(program, 0, null, true);
      nodes.push(nativeNode);

      if (shouldAutoExpand(config, 1)) {
        let addedCount = 0;

        // Add prime contractor
        if (program.prime_contractor && addedCount < MAX_NODES_PER_TIER) {
          const primePrograms = dashboardData.programs.filter(
            (p) => p.prime_contractor === program.prime_contractor
          ).length;
          const primeNode = primeToNode(program.prime_contractor, 1, nativeNode.id, primePrograms);
          nodes.push(primeNode);
          edges.push({
            id: createEdgeId(nativeNode.id, primeNode.id, 'run_by'),
            source: nativeNode.id,
            target: primeNode.id,
            relationship: 'run_by',
          });
          addedCount++;
        }

        // Add location
        if (program.location && addedCount < MAX_NODES_PER_TIER) {
          const locationNode = locationToNode(program.location, 1, nativeNode.id);
          nodes.push(locationNode);
          edges.push({
            id: createEdgeId(nativeNode.id, locationNode.id, 'operates_at'),
            source: nativeNode.id,
            target: locationNode.id,
            relationship: 'operates_at',
          });
          addedCount++;
        }

        // Add jobs mapped to this program
        const programJobs = dashboardData.jobs
          .filter(
            (j) =>
              j.program_name === program.name || j.matched_programs?.includes(program.name)
          )
          .sort((a, b) => (b.bd_score || 0) - (a.bd_score || 0))
          .slice(0, Math.min(10, MAX_NODES_PER_TIER - addedCount));

        programJobs.forEach((job) => {
          const jobNode = jobToNode(job, 1, nativeNode.id);
          nodes.push(jobNode);
          edges.push({
            id: createEdgeId(nativeNode.id, jobNode.id, 'has_job'),
            source: nativeNode.id,
            target: jobNode.id,
            relationship: 'has_job',
          });
          addedCount++;
        });

        nativeNode.loadedChildCount = addedCount;
      }
      break;
    }

    case 'CONTACT': {
      const allContacts = Object.values(dashboardData.contacts).flat();
      const contact = allContacts.find((c) => c.id === entityId);
      if (!contact) break;

      const nativeNode = contactToNode(contact, 0, null, true);
      nodes.push(nativeNode);

      if (shouldAutoExpand(config, 1)) {
        let addedCount = 0;

        // Add employer/prime
        if (contact.company && addedCount < MAX_NODES_PER_TIER) {
          const primePrograms = dashboardData.programs.filter(
            (p) => p.prime_contractor?.toLowerCase() === contact.company.toLowerCase()
          ).length;
          const primeNode = primeToNode(contact.company, 1, nativeNode.id, primePrograms);
          nodes.push(primeNode);
          edges.push({
            id: createEdgeId(nativeNode.id, primeNode.id, 'employed_by'),
            source: nativeNode.id,
            target: primeNode.id,
            relationship: 'employed_by',
          });
          addedCount++;
        }

        // Add matched programs
        const matchedPrograms = dashboardData.programs
          .filter(
            (p) => contact.matched_programs?.includes(p.name) || p.name === contact.program
          )
          .slice(0, Math.min(5, MAX_NODES_PER_TIER - addedCount));

        matchedPrograms.forEach((program) => {
          const programNode = programToNode(program, 1, nativeNode.id);
          nodes.push(programNode);
          edges.push({
            id: createEdgeId(nativeNode.id, programNode.id, 'works_on'),
            source: nativeNode.id,
            target: programNode.id,
            relationship: 'works_on',
          });
          addedCount++;
        });

        nativeNode.loadedChildCount = addedCount;
      }
      break;
    }

    case 'LOCATION': {
      const locationName = entityId;
      const jobsAtLocation = dashboardData.jobs.filter((j) =>
        j.location?.toLowerCase().includes(locationName.toLowerCase())
      );
      const programsAtLocation = dashboardData.programs.filter((p) =>
        p.location?.toLowerCase().includes(locationName.toLowerCase())
      );

      const nativeNode = locationToNode(locationName, 0, null, {
        jobs: jobsAtLocation.length,
        contacts: 0,
        programs: programsAtLocation.length,
      });
      nativeNode.isNative = true;
      nativeNode.isExpanded = true;
      nodes.push(nativeNode);

      if (shouldAutoExpand(config, 1)) {
        let addedCount = 0;

        // Add programs at location
        programsAtLocation.slice(0, Math.min(5, MAX_NODES_PER_TIER)).forEach((program) => {
          const programNode = programToNode(program, 1, nativeNode.id);
          nodes.push(programNode);
          edges.push({
            id: createEdgeId(nativeNode.id, programNode.id, 'hosts'),
            source: nativeNode.id,
            target: programNode.id,
            relationship: 'hosts',
          });
          addedCount++;
        });

        // Add top jobs at location
        jobsAtLocation
          .sort((a, b) => (b.bd_score || 0) - (a.bd_score || 0))
          .slice(0, Math.min(10, MAX_NODES_PER_TIER - addedCount))
          .forEach((job) => {
            const jobNode = jobToNode(job, 1, nativeNode.id);
            nodes.push(jobNode);
            edges.push({
              id: createEdgeId(nativeNode.id, jobNode.id, 'job_at'),
              source: nativeNode.id,
              target: jobNode.id,
              relationship: 'job_at',
            });
            addedCount++;
          });

        nativeNode.loadedChildCount = addedCount;
      }
      break;
    }

    case 'BD_EVENT': {
      // BD Events placeholder - would come from separate data source
      const nativeNode: MindMapNode = {
        id: createNodeId('BD_EVENT', entityId),
        type: 'BD_EVENT' as NodeType,
        label: entityId,
        tier: 0,
        metadata: { name: entityId },
        parentId: null,
        isNative: true,
        isExpanded: true,
        isLoading: false,
        childCount: 0,
        loadedChildCount: 0,
      };
      nodes.push(nativeNode);
      break;
    }
  }

  return { nodes, edges };
}

async function loadChildrenForNode(
  nodeId: string,
  nodes: Map<string, MindMapNode>,
  _edges: MindMapEdge[],
  dashboardData: DashboardData
): Promise<{ nodes: MindMapNode[]; edges: MindMapEdge[] }> {
  const parentNode = nodes.get(nodeId);
  if (!parentNode) return { nodes: [], edges: [] };

  const newNodes: MindMapNode[] = [];
  const newEdges: MindMapEdge[] = [];
  const nextTier = parentNode.tier + 1;
  const existingNodeIds = new Set(Array.from(nodes.keys()));

  switch (parentNode.type) {
    case 'PROGRAM': {
      const program = parentNode.metadata as unknown as Program;
      const allContacts = Object.values(dashboardData.contacts).flat();
      const programContacts = allContacts
        .filter(
          (c) =>
            c.program === program.name ||
            c.matched_programs?.includes(program.name) ||
            c.company?.toLowerCase() === program.prime_contractor?.toLowerCase()
        )
        .slice(0, MAX_NODES_PER_TIER);

      programContacts.forEach((contact) => {
        const contactNode = contactToNode(contact, nextTier, nodeId);
        if (!existingNodeIds.has(contactNode.id)) {
          newNodes.push(contactNode);
          newEdges.push({
            id: createEdgeId(nodeId, contactNode.id, 'contact'),
            source: nodeId,
            target: contactNode.id,
            relationship: 'contact',
          });
        }
      });
      break;
    }

    case 'LOCATION': {
      const locationData = parentNode.metadata as { name: string };
      const locationName = locationData.name;

      const jobsAtLocation = dashboardData.jobs
        .filter((j) => j.location?.toLowerCase().includes(locationName.toLowerCase()))
        .slice(0, MAX_NODES_PER_TIER);

      jobsAtLocation.forEach((job) => {
        const jobNode = jobToNode(job, nextTier, nodeId);
        if (!existingNodeIds.has(jobNode.id)) {
          newNodes.push(jobNode);
          newEdges.push({
            id: createEdgeId(nodeId, jobNode.id, 'job_at'),
            source: nodeId,
            target: jobNode.id,
            relationship: 'job_at',
          });
        }
      });
      break;
    }

    case 'PRIME': {
      const primeData = parentNode.metadata as { name: string };
      const primeName = primeData.name;

      const primePrograms = dashboardData.programs
        .filter((p) => p.prime_contractor?.toLowerCase() === primeName.toLowerCase())
        .slice(0, MAX_NODES_PER_TIER);

      primePrograms.forEach((program) => {
        const programNode = programToNode(program, nextTier, nodeId);
        if (!existingNodeIds.has(programNode.id)) {
          newNodes.push(programNode);
          newEdges.push({
            id: createEdgeId(nodeId, programNode.id, 'runs'),
            source: nodeId,
            target: programNode.id,
            relationship: 'runs',
          });
        }
      });
      break;
    }

    case 'JOB': {
      const job = parentNode.metadata as unknown as Job;
      const relatedJobs = dashboardData.jobs
        .filter(
          (j) =>
            j.id !== job.id &&
            (j.program_name === job.program_name ||
              j.location === job.location ||
              j.company === job.company)
        )
        .slice(0, MAX_NODES_PER_TIER);

      relatedJobs.forEach((relatedJob) => {
        const jobNode = jobToNode(relatedJob, nextTier, nodeId);
        if (!existingNodeIds.has(jobNode.id)) {
          newNodes.push(jobNode);
          newEdges.push({
            id: createEdgeId(nodeId, jobNode.id, 'related'),
            source: nodeId,
            target: jobNode.id,
            relationship: 'related',
          });
        }
      });
      break;
    }

    case 'CONTACT': {
      const contact = parentNode.metadata as unknown as Contact;
      const allContacts = Object.values(dashboardData.contacts).flat();
      const colleagues = allContacts
        .filter(
          (c) =>
            c.id !== contact.id &&
            (c.company === contact.company || c.program === contact.program)
        )
        .slice(0, MAX_NODES_PER_TIER);

      colleagues.forEach((colleague) => {
        const contactNode = contactToNode(colleague, nextTier, nodeId);
        if (!existingNodeIds.has(contactNode.id)) {
          newNodes.push(contactNode);
          newEdges.push({
            id: createEdgeId(nodeId, contactNode.id, 'colleague'),
            source: nodeId,
            target: contactNode.id,
            relationship: 'colleague',
          });
        }
      });
      break;
    }
  }

  return { nodes: newNodes, edges: newEdges };
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseMindMapDataResult {
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  nodeCount: number;
  edgeCount: number;
  // Native node actions
  setNativeNode: (type: NativeNodeType, id: string) => void;
  // Expansion actions
  expandNode: (nodeId: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  canExpand: (nodeId: string) => boolean;
  isNodeExpanded: (nodeId: string) => boolean;
  isNodeLoading: (nodeId: string) => boolean;
}

export function useMindMapData(): UseMindMapDataResult {
  const { data: dashboardData, loading: dataLoading, error: dataError } = useData();
  const {
    setGraphData,
    addNodes,
    setLoading,
    setError,
    setNodeLoading,
    expandNode: storeExpandNode,
    collapseNode: storeCollapseNode,
    setNativeNode: storeSetNativeNode,
    isLoading,
    error,
    nodes,
    edges,
    canExpand: storeCanExpand,
    isExpanded: storeIsExpanded,
    isNodeLoading: storeIsNodeLoading,
  } = useMindMapStore();

  const [hasLoaded, setHasLoaded] = useState(false);

  // Set native node and build initial graph
  const setNativeNode = useCallback(
    (type: NativeNodeType, id: string) => {
      if (!dashboardData) return;

      setLoading(true);
      storeSetNativeNode(type, id);

      try {
        const graph = buildNativeNodeGraph(type, id, dashboardData);
        setGraphData(graph.nodes, graph.edges);
        setHasLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load native node');
      } finally {
        setLoading(false);
      }
    },
    [dashboardData, setGraphData, setLoading, setError, storeSetNativeNode]
  );

  // Expand a node to show its children
  const expandNode = useCallback(
    async (nodeId: string) => {
      if (!dashboardData) return;

      setNodeLoading(nodeId, true);

      try {
        // Simulate async loading
        await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));

        const { nodes: newNodes, edges: newEdges } = await loadChildrenForNode(
          nodeId,
          nodes,
          edges,
          dashboardData
        );

        if (newNodes.length > 0) {
          addNodes(newNodes, newEdges);
        }

        storeExpandNode(nodeId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to expand node');
      } finally {
        setNodeLoading(nodeId, false);
      }
    },
    [dashboardData, nodes, edges, addNodes, storeExpandNode, setNodeLoading, setError]
  );

  // Collapse a node
  const collapseNode = useCallback(
    (nodeId: string) => {
      storeCollapseNode(nodeId);
    },
    [storeCollapseNode]
  );

  // Load initial data when dashboard data becomes available
  const loadData = useCallback(async () => {
    if (!dashboardData || hasLoaded) return;

    setLoading(true);
    setError(null);

    try {
      // Default: Load first job as native node
      if (dashboardData.jobs.length > 0) {
        const firstJob = dashboardData.jobs[0];
        const graph = buildNativeNodeGraph('JOB', firstJob.id, dashboardData);
        setGraphData(graph.nodes, graph.edges);
        storeSetNativeNode('JOB', firstJob.id);
      }
      setHasLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mind map data';
      setError(message);
      console.error('Mind map data loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [dashboardData, hasLoaded, setGraphData, setLoading, setError, storeSetNativeNode]);

  // Auto-load on mount when data is available
  useEffect(() => {
    if (dashboardData && !hasLoaded && !isLoading && !dataLoading) {
      loadData();
    }
  }, [dashboardData, hasLoaded, isLoading, dataLoading, loadData]);

  return {
    isLoading: isLoading || dataLoading,
    error: error || dataError,
    reload: loadData,
    nodeCount: nodes.size,
    edgeCount: edges.length,
    setNativeNode,
    expandNode,
    collapseNode,
    canExpand: storeCanExpand,
    isNodeExpanded: storeIsExpanded,
    isNodeLoading: storeIsNodeLoading,
  };
}

// ============================================================================
// Additional Hooks
// ============================================================================

// Hook to get filtered nodes by type
export function useMindMapNodesByType(type: NodeType): MindMapNode[] {
  const nodes = useMindMapStore((state) => state.nodes);
  return Array.from(nodes.values()).filter((n) => n.type === type);
}

// Hook to get selected node with full details
export function useSelectedNode(): MindMapNode | null {
  const selectedNodeId = useMindMapStore((state) => state.selectedNodeId);
  const getNode = useMindMapStore((state) => state.getNode);

  if (!selectedNodeId) return null;
  return getNode(selectedNodeId) || null;
}

// Hook to get connected nodes for a given node
export function useConnectedNodes(nodeId: string | null): MindMapNode[] {
  const getConnectedNodes = useMindMapStore((state) => state.getConnectedNodes);

  if (!nodeId) return [];
  return getConnectedNodes(nodeId);
}

// Hook for graph data suitable for D3 force simulation
export function useGraphData() {
  const getGraphData = useMindMapStore((state) => state.getGraphData);
  return getGraphData();
}

// Hook to get child nodes for expansion
export function useChildNodes(parentId: string | null): MindMapNode[] {
  const getChildNodes = useMindMapStore((state) => state.getChildNodes);

  if (!parentId) return [];
  return getChildNodes(parentId);
}
