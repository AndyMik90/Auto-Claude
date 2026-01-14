# Mind Map Dashboard Architecture Analysis
## Comparison with Current Implementation & Recommended Updates
### Analysis Date: January 2026

---

## Executive Summary

The **Mind_Map_Dashboard_Architecture_v1.md** spec defines an ambitious **interactive graph-based exploration system** that fundamentally transforms how BD intelligence data is visualized and navigated. This is a paradigm shift from the traditional tabular/card-based dashboard I've built to a **relationship-centric, explorable graph**.

### Key Insight
The current dashboard (Phase 6) shows data in isolation. The Mind Map spec enables **traversing relationships** - starting from ANY entity and expanding outward to discover connections that flat views miss.

---

## Part 1: Gap Analysis - Current vs. Spec

### 1.1 Current Dashboard Capabilities

| Feature | Current Status | Mind Map Spec Requirement |
|---------|----------------|---------------------------|
| Jobs View | ✅ Card grid with filters | 🎯 Graph node with expandable relationships |
| Programs View | ✅ Card grid with sorting | 🎯 Graph node showing Prime, Customer, Locations |
| Contacts View | ✅ Organized by Tier (1-6) | 🎯 Graph node with team hierarchy, reports-to chain |
| Contractors View | ✅ Card grid | 🎯 Graph node linking to placements, programs |
| BD Events | ❌ Not implemented | 🎯 Full entity with primes/programs attending |
| Task Orders | ❌ Not implemented | 🎯 Nested under Programs |
| Teams | ❌ Not implemented | 🎯 Nested under Task Orders |
| Locations | ❌ Not implemented | 🎯 Full entity aggregating jobs/contacts/programs |
| Customers (Agencies) | ❌ Not implemented | 🎯 Full entity owning Programs |
| PTS Contractors | ❌ Not implemented | 🎯 Full entity with skills matching |
| PTS Past Performance | ❌ Not implemented | 🎯 Full entity linking to programs/roles |

### 1.2 Missing Entity Types

The spec defines **14 entity types**. Current implementation has **4**:

```
CURRENT (4):                    SPEC REQUIRES (14):
✅ Job                          ✅ Job
✅ Program                      ✅ Program
✅ Contact                      ✅ Contact
✅ Contractor                   ✅ Prime (enhanced Contractor)
                                ❌ Subcontractor
                                ❌ Task Order
                                ❌ Team
                                ❌ Location (as first-class entity)
                                ❌ BD Event
                                ❌ Customer (Agency)
                                ❌ PTS Contractor
                                ❌ PTS Past Performance
                                ❌ Functional Area
                                ❌ Clearance (as entity)
```

### 1.3 Missing Relationship System

**Current**: No explicit relationships - data is siloed
**Spec Requires**: Full bidirectional relationship matrix with 60+ relationship types

Critical missing relationships:
- Job → Program → Prime → Contacts (drill-down chain)
- Contact → Team → Task Order → Program (org chart chain)
- Location → Programs + Jobs + Contacts (geographic clustering)
- BD Event → Primes → Programs → Target Contacts (event prep chain)

---

## Part 2: Architecture Changes Required

### 2.1 Data Model Expansion

**Current Data Model (4 entities, minimal relationships):**
```typescript
// Current: Flat, isolated entities
interface Job { id, title, company, location, clearance, bd_priority, ... }
interface Program { id, name, prime_contractor, ... }
interface Contact { id, name, title, tier, ... }
interface Contractor { id, name, ... }
```

**Required Data Model (14 entities, full relationships):**
```typescript
// New: Graph-based with explicit relationships
interface GraphNode {
  id: string;
  type: NodeType; // JOB | PROGRAM | PRIME | CONTACT | LOCATION | BD_EVENT | ...
  data: EntityData;
  relationships: Relationship[];
  attachments: Attachment[]; // Notes, tasks, hyperlinks, callouts
}

interface Relationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType; // 'mapped_to' | 'posted_by' | 'located_at' | ...
  weight?: number;
  metadata?: Record<string, unknown>;
}

interface Attachment {
  id: string;
  type: 'note' | 'todo' | 'task' | 'hyperlink' | 'callout' | 'label' | 'comment' | 'image' | 'equation';
  data: AttachmentData;
}
```

### 2.2 Correlation Engine Enhancement

**Current correlation_engine.py outputs:**
- `jobs_enriched.json` - Jobs with bd_score
- `programs_enriched.json` - Programs with job/contact counts
- `contacts_classified.json` - Contacts by tier
- `contractors_enriched.json` - Contractor profiles
- `correlation_summary.json` - Statistics

**Required outputs for Mind Map:**
```
mindmap_nodes.json          # All 14 entity types as graph nodes
mindmap_edges.json          # All relationships between nodes
native_node_configs.json    # Expansion rules per native node type
bd_formula_cache.json       # Pre-generated BD messaging per contact/job
```

### 2.3 New React Components Required

**Current Components (8 pages):**
```
src/pages/
├── ExecutiveSummary.tsx    # KPI dashboard
├── JobsPipeline.tsx        # Job cards
├── Programs.tsx            # Program cards
├── Contacts.tsx            # Contact cards by tier
├── Contractors.tsx         # Contractor cards
├── Opportunities.tsx       # BD opportunities
├── DailyPlaybook.tsx       # Task list
└── Settings.tsx            # Configuration
```

**Required New Components:**
```
src/components/mindmap/
├── MindMapCanvas.tsx       # D3/Cytoscape graph container
├── MindMapNode.tsx         # Individual node rendering
├── MindMapEdge.tsx         # Relationship line rendering
├── NotePanel.tsx           # Detail panel for selected node
├── NativeNodeTabs.tsx      # Tab selector (Job/Program/Contact/Location/Event)
├── ContextMenu.tsx         # Right-click actions
├── ControlBar.tsx          # Search, filters, layout, export
├── MiniMap.tsx             # Navigation overview
└── AttachmentPanel.tsx     # Notes, tasks, callouts editor

src/hooks/
├── useMindMapData.ts       # Graph data fetching
├── useMindMapLayout.ts     # D3 force/radial layout
├── useMindMapSelection.ts  # Selection state
└── useMindMapExport.ts     # OPML, JSON, PNG export

src/stores/
└── mindMapStore.ts         # Zustand state management
```

---

## Part 3: Recommended Implementation Roadmap

### Phase A: Data Foundation (Correlation Engine v2)

**Priority: HIGH** | **Effort: 2-3 days**

1. **Add new entity extraction to correlation_engine.py:**
   - Extract Locations from job/contact/program data
   - Create BD_Event entities (manual input initially)
   - Create Task Order entities (infer from program/location clusters)
   - Create Team entities (infer from contact clusters)
   - Extract Customers (agencies) from program data

2. **Build relationship inference engine:**
   - Job → Program: Location + keywords matching
   - Job → Contact: Hiring manager inference
   - Contact → Team: Same location + program clustering
   - Contact → hierarchy: Title-based tier assignment
   - Program → Prime: Existing field extraction
   - Location → aggregations: Count jobs/contacts/programs per location

3. **Output new JSON formats:**
   ```python
   def export_graph_data(self):
       """Export data in graph format for mind map."""
       nodes = []
       edges = []

       # Add all job nodes
       for job in self.jobs:
           nodes.append({
               'id': f'job_{job.id}',
               'type': 'JOB',
               'data': job.to_dict()
           })
           # Add job → program edge
           if job.program_id:
               edges.append({
                   'source': f'job_{job.id}',
                   'target': f'program_{job.program_id}',
                   'relationship': 'mapped_to'
               })
       # ... similar for all entity types

       return {'nodes': nodes, 'edges': edges}
   ```

### Phase B: Mind Map Core UI

**Priority: HIGH** | **Effort: 3-4 days**

1. **Install graph visualization library:**
   ```bash
   npm install react-force-graph-2d d3-force cytoscape cytoscape-react
   npm install zustand @radix-ui/react-context-menu
   ```

2. **Create MindMapCanvas with D3 force layout:**
   - Render nodes from `mindmap_nodes.json`
   - Render edges from `mindmap_edges.json`
   - Implement zoom/pan/drag
   - Implement node selection

3. **Create NotePanel:**
   - Show entity details for selected node
   - Display BD Formula for jobs/contacts
   - Action buttons (Call, Email, LinkedIn, Export)

4. **Create NativeNodeTabs:**
   - Job | Program | Prime | Location | Event | Contact | PTS tabs
   - Switching tab changes expansion configuration

### Phase C: Node Expansion System

**Priority: HIGH** | **Effort: 2-3 days**

1. **Implement tier-based expansion:**
   - Tier 1: Auto-expand immediate children
   - Tier 2+: Click to expand
   - Progressive loading (max 20 nodes per expansion)

2. **Create expansion configurations:**
   ```typescript
   const JOB_NATIVE_CONFIG = {
     tier_1: [
       { node: 'PROGRAM', relationship: 'mapped_to' },
       { node: 'LOCATION', relationship: 'located_at' },
       { node: 'CONTACT', relationship: 'hiring_manager' }
     ],
     tier_2: [
       { node: 'PRIME', relationship: 'program.prime_contractor' },
       { node: 'TASK_ORDER', relationship: 'program.task_orders' }
     ],
     // ...
   };
   ```

3. **Implement expand/collapse animations:**
   - Spring physics for smooth expansion
   - Auto-layout recalculation on expand

### Phase D: Advanced Features

**Priority: MEDIUM** | **Effort: 3-4 days**

1. **Context menu:**
   - Expand All, Collapse, Hide, Focus, Set as Native Node
   - Copy details, Export branch

2. **Attachments system:**
   - Notes (auto-generated BD Formula, user-editable)
   - To-Do items (sync with Daily Playbook)
   - Tasks with due dates
   - Callouts for pain points
   - Labels for custom tagging

3. **Export functionality:**
   - OPML for XMind import
   - JSON for data backup
   - PNG/SVG for presentations

4. **Search and filter:**
   - Full-text search across all nodes
   - Filter by node type, priority, location
   - Color-by selector (BD Priority, Tier, Program Branch)

### Phase E: Integration

**Priority: MEDIUM** | **Effort: 1-2 days**

1. **Add Mind Map as 9th tab to dashboard**
2. **Link from existing views to Mind Map:**
   - Click job card → Open Mind Map with job as native node
   - Click contact → Open Mind Map with contact centered
3. **Sync Mind Map todos with Daily Playbook tab**

---

## Part 4: Specific Recommendations

### 4.1 Technology Selection

| Component | Recommended | Reason |
|-----------|-------------|--------|
| Graph Library | **react-force-graph-2d** | Lightweight, React-native, good performance |
| Fallback for large graphs | **Cytoscape.js** | Better for 500+ nodes |
| State Management | **Zustand** | Simple, performant, already spec'd |
| Context Menu | **@radix-ui/react-context-menu** | Accessible, customizable |
| Export | **html-to-image** + **xmlbuilder2** | For PNG/SVG and OPML |

### 4.2 Performance Considerations

1. **Progressive loading:** Never load more than 100 nodes at once
2. **Canvas rendering:** Switch to Canvas for >500 nodes (D3 Canvas renderer)
3. **Web Workers:** Offload force simulation calculations
4. **Virtualization:** Only render visible edges
5. **Caching:** Cache expanded subtrees, expire after 30 min

### 4.3 Integration with Existing Dashboard

The Mind Map should **complement, not replace** the existing dashboard:

- **Executive Summary**: Keep for KPIs and high-level stats
- **Jobs/Programs/Contacts**: Keep as list views for bulk operations
- **Mind Map**: Add as primary exploration tool for relationship discovery
- **Daily Playbook**: Keep for task management, sync with Mind Map todos

### 4.4 Quick Wins

Before full Mind Map implementation, enhance current dashboard with:

1. **Add clickable links between entities:**
   - Job card shows Program name → Click to filter programs by that program
   - Contact card shows Company → Click to see other contacts at that company

2. **Add Location entity:**
   - Create Locations page showing aggregations
   - Jobs by location, Contacts by location

3. **Add BD Events placeholder:**
   - Even without scraping, allow manual BD Event entry
   - Link to programs/contacts manually

---

## Part 5: Estimated Effort

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| Phase A | Data Foundation (Correlation Engine v2) | 2-3 days | HIGH |
| Phase B | Mind Map Core UI | 3-4 days | HIGH |
| Phase C | Node Expansion System | 2-3 days | HIGH |
| Phase D | Advanced Features | 3-4 days | MEDIUM |
| Phase E | Integration | 1-2 days | MEDIUM |
| **Total** | | **11-16 days** | |

---

## Part 6: Files Created/Modified Summary

### New Files to Create

```
scripts/data_correlation/
├── graph_exporter.py           # Export to graph format
├── relationship_inferrer.py    # Infer relationships
└── entity_extractor.py         # Extract new entity types

dashboard/src/components/mindmap/
├── MindMapCanvas.tsx
├── MindMapNode.tsx
├── MindMapEdge.tsx
├── NotePanel.tsx
├── NativeNodeTabs.tsx
├── ContextMenu.tsx
├── ControlBar.tsx
├── MiniMap.tsx
└── AttachmentPanel.tsx

dashboard/src/hooks/
├── useMindMapData.ts
├── useMindMapLayout.ts
├── useMindMapSelection.ts
└── useMindMapExport.ts

dashboard/src/stores/
└── mindMapStore.ts

dashboard/src/configs/
├── nativeNodeConfigs.ts
└── layoutConfigs.ts
```

### Existing Files to Modify

```
scripts/data_correlation/correlation_engine.py
  - Add entity extraction for Locations, BD Events, Task Orders, Teams, Customers
  - Add relationship inference engine
  - Add graph export method

dashboard/src/App.tsx
  - Add Mind Map tab/route

dashboard/src/types/index.ts
  - Add new entity types
  - Add relationship types
  - Add attachment types
```

---

## Conclusion

The Mind Map Architecture spec represents a **major evolution** of the BD Dashboard from a reporting tool to an **interactive intelligence exploration system**. The current Phase 6 dashboard provides a solid foundation, but significant new development is required to implement the graph-based visualization.

**Recommended approach:**
1. Complete Phases 7-8 (BD Formula Generator, Daily Playbook) using current architecture
2. Implement Phase A (Data Foundation) to prepare graph data
3. Build Phase B (Mind Map Core) as a new tab
4. Iterate on Phases C-E based on user feedback

This positions the dashboard to become a best-in-class BD intelligence tool that reveals connections hidden in traditional views.

---

*Analysis completed: January 13, 2026*
