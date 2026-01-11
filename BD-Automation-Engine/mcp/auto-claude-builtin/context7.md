# Context7 MCP Server

Real-time documentation lookup for libraries and frameworks.

## Overview

Context7 provides agents with access to current documentation, bypassing training data limitations. This is crucial for:
- Recently updated libraries
- Correct API signatures
- Current best practices
- Accurate code examples

## Capabilities

### Documentation Search
Search for library documentation by name and query:
```
Query: "react useState hook"
Returns: Current React documentation for useState
```

### API Reference Lookup
Get specific function/method documentation:
```
Function: "pandas.DataFrame.merge"
Returns: Full API documentation with parameters and examples
```

### Package Information
Get package metadata and versions:
```
Package: "anthropic"
Returns: Version info, installation instructions, quick start
```

## Supported Sources

| Source | Packages |
|--------|----------|
| npm | JavaScript/TypeScript packages |
| PyPI | Python packages |
| Crates.io | Rust packages |
| RubyGems | Ruby packages |
| Go Packages | Go modules |
| Official Docs | Major frameworks |

## Use Cases in BD Automation

### 1. Notion SDK Usage
When implementing Notion integrations:
```
Query: "@notionhq/client createPage"
Returns: Current API for creating Notion pages
```

### 2. Anthropic SDK
For Claude API integration:
```
Query: "anthropic python messages create"
Returns: Current message API documentation
```

### 3. n8n Node Development
When building custom n8n nodes:
```
Query: "n8n-workflow INodeType"
Returns: Node type interface documentation
```

## Agent Integration

### When Agents Use Context7

1. **Planning Phase**: Research current API patterns
2. **Implementation**: Verify function signatures
3. **Debugging**: Check for API changes
4. **Code Review**: Validate usage patterns

### Example Agent Workflow
```
Planner Agent:
1. "What's the current API for Notion database queries?"
   → Context7 returns latest @notionhq/client docs

2. Plans implementation using current API
   → Avoids deprecated methods

Coder Agent:
1. Implements using Context7-verified patterns
2. Uses correct parameter names and types
```

## Configuration

Context7 is automatically enabled in Auto Claude. No additional configuration needed.

### Customization (if needed)
In `apps/backend/core/client.py`:
```python
# Context7 is included in default MCP servers
mcp_servers = ["context7", "graphiti", ...]
```

## Comparison: With vs Without Context7

### Without Context7
```python
# Agent might use outdated API
client = Anthropic()
response = client.completions.create(  # ❌ Deprecated
    model="claude-2",
    prompt="..."
)
```

### With Context7
```python
# Agent uses current API
client = Anthropic()
response = client.messages.create(  # ✅ Current
    model="claude-sonnet-4-5-20250929",
    messages=[...]
)
```

## Best Practices

1. **Always verify** API usage with Context7 for external libraries
2. **Check versions** when documentation differs from expectations
3. **Use for debugging** when code doesn't work as expected
4. **Reference in planning** to ensure current patterns

## Limitations

- Requires internet connectivity
- Some private/internal packages not indexed
- Very new packages may have limited docs
- Rate limits apply for heavy usage
