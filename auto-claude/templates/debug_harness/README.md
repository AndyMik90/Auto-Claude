# Debug Harness Templates

These templates are used by BUGFINDER-X to create minimal reproductions for bugs.

## Templates

### `python_harness.py`
Python debug harness template for reproducing bugs in Python code.

**Usage:**
```bash
# Copy template to your debug directory
cp auto-claude/templates/debug_harness/python_harness.py debug/harness/

# Create a fixture file
mkdir -p debug/fixtures
echo '{"input": "test"}' > debug/fixtures/input.json

# Edit the harness to call your suspect function
# Then run:
python debug/harness/python_harness.py
```

### `typescript_harness.ts`
TypeScript/Node.js debug harness template for reproducing bugs in TS/JS code.

**Usage:**
```bash
# Copy template to your debug directory
cp auto-claude/templates/debug_harness/typescript_harness.ts debug/harness/

# Create a fixture file
mkdir -p debug/fixtures
echo '{"input": "test"}' > debug/fixtures/input.json

# Edit the harness to call your suspect function
# Then run:
npx ts-node debug/harness/typescript_harness.ts
# or
node debug/harness/typescript_harness.js  # if compiled
```

## Fixture Files

Fixtures are frozen input data that reproduce the bug. They should be:
- **Minimal**: Include only what's needed to trigger the bug
- **Deterministic**: Same input = same result
- **JSON format**: Easy to inspect and version control

Example fixture (`debug/fixtures/input.json`):
```json
{
  "user_id": "123",
  "action": "login",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## BUGFINDER-X Integration

BUGFINDER-X automatically uses these templates when creating reproductions:
1. Detects project stack (Python, TypeScript, etc.)
2. Copies appropriate template
3. Edits template to call suspect function
4. Creates fixtures from real failure cases
5. Runs harness to verify reproduction

## Best Practices

1. **Keep harnesses simple**: One function call, minimal setup
2. **Print everything**: Environment, input, output, errors
3. **Exit codes**: 0 for success, 1 for failure
4. **Frozen data**: Never use live APIs or databases in harnesses
5. **Correlation IDs**: Include IDs to trace data through the system
