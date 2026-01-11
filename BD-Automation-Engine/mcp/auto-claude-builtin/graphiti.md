# Graphiti Memory System

Persistent knowledge graph memory for cross-session context and learning.

## Overview

Graphiti provides Auto Claude with memory that persists across sessions. Unlike context windows that reset, Graphiti builds a growing knowledge graph of:
- Project patterns and conventions
- Past solutions to similar problems
- Discovered gotchas and workarounds
- Codebase insights

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Session                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Planner │  │  Coder  │  │   QA    │  │  Fixer  │    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │            │            │            │          │
│       └────────────┼────────────┼────────────┘          │
│                    │            │                        │
│              ┌─────▼────────────▼─────┐                 │
│              │   Graphiti Memory      │                 │
│              │   Manager              │                 │
│              └──────────┬─────────────┘                 │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              LadybugDB (Embedded)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Knowledge Graph                       │   │
│  │  ┌──────┐    ┌──────┐    ┌──────┐              │   │
│  │  │Entity│───▶│Relation│◀──│Entity│              │   │
│  │  │      │    │       │    │      │              │   │
│  │  │React │    │uses   │    │hooks │              │   │
│  │  │comp  │    │pattern│    │state │              │   │
│  │  └──────┘    └──────┘    └──────┘              │   │
│  │                                                  │   │
│  │  Semantic Embeddings (via configured provider)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Capabilities

### 1. Context Retrieval
Get relevant past context for current task:
```python
memory.get_context_for_session("Implementing Notion integration")
# Returns: Past insights about Notion API, pagination gotchas, etc.
```

### 2. Insight Storage
Save discoveries for future sessions:
```python
memory.add_session_insight(
    "Pattern: Notion API requires explicit pagination for large databases"
)
```

### 3. Semantic Search
Find related information by meaning:
```python
memory.search("error handling in API calls")
# Returns: Past solutions involving try/catch, retries, etc.
```

### 4. Entity Relationships
Query knowledge graph structure:
```python
memory.get_related_entities("React component")
# Returns: hooks, state, props, lifecycle, etc.
```

## Data Storage

### Location
```
.auto-claude/specs/XXX-feature/
└── graphiti/
    ├── entities.json     # Knowledge graph nodes
    ├── relations.json    # Entity relationships
    ├── embeddings.db     # Vector embeddings
    └── insights.json     # Session insights
```

### Persistence
- Data persists between sessions
- Specific to each spec/feature
- Can be backed up with spec folder

## Configuration

### Enable Graphiti
In `apps/backend/.env`:
```bash
GRAPHITI_ENABLED=true
```

### Provider Configuration
Graphiti supports multiple LLM/embedding providers:

```bash
# Option 1: Anthropic (recommended)
ANTHROPIC_API_KEY=your-key

# Option 2: OpenAI
OPENAI_API_KEY=your-key

# Option 3: Azure OpenAI
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com

# Option 4: Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# Option 5: Google AI
GOOGLE_AI_API_KEY=your-key
```

## Usage in Agents

### Automatic Memory Collection
Agents automatically contribute to memory:
```
Coder Agent discovers: "Notion API rate limits at 3 req/sec"
→ Stored in Graphiti
→ Future sessions know to add delays
```

### Memory-Informed Planning
Planner retrieves past context:
```
New task: "Add Notion sync feature"
Planner queries: "What do we know about Notion integration?"
→ Gets: Rate limits, pagination patterns, error handling
→ Plans accordingly
```

### QA Learning
QA agents learn from past issues:
```
Past QA: "Missing null check on API response"
→ Stored as pattern
Future QA: Automatically checks for null handling
```

## Memory Types

### 1. Insights
High-level learnings and patterns:
```json
{
  "type": "insight",
  "content": "React state updates are batched in event handlers",
  "source": "coder-session-123",
  "relevance_score": 0.85
}
```

### 2. Entities
Codebase concepts and components:
```json
{
  "type": "entity",
  "name": "UserAuthContext",
  "entity_type": "react_context",
  "properties": {
    "location": "src/contexts/UserAuthContext.tsx",
    "exports": ["useAuth", "AuthProvider"]
  }
}
```

### 3. Relations
Connections between entities:
```json
{
  "type": "relation",
  "source": "LoginForm",
  "target": "UserAuthContext",
  "relation_type": "uses",
  "confidence": 0.92
}
```

## Best Practices

1. **Let It Learn**: Memory improves over time - more sessions = better context
2. **Review Insights**: Periodically check stored insights for accuracy
3. **Spec Isolation**: Each spec has its own memory - keeps context relevant
4. **Backup Important Specs**: Memory is in `.auto-claude/` folder

## Troubleshooting

### Memory Not Persisting
1. Check `GRAPHITI_ENABLED=true`
2. Verify write permissions on `.auto-claude/`
3. Check provider API key is valid

### Irrelevant Context Retrieved
1. Memory may need more sessions to calibrate
2. Try more specific queries
3. Clear old/incorrect insights if needed

### High API Costs
1. Use Ollama for local embeddings
2. Reduce embedding frequency
3. Limit stored insight count
