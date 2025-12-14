# Product Requirements Document: Intelligent Validation System

**Project:** Auto Claude - Intelligent Validation System
**Version:** 1.0
**Date:** 2025-12-13
**Author:** Atlas (Principal Software Architect)
**Status:** Draft for Implementation

---

## Executive Summary

### Project Overview
Auto Claude is an autonomous coding framework that builds software through coordinated AI agent sessions. Currently, it has basic per-chunk verification, but lacks a robust, production-grade validation system. This PRD defines a comprehensive **Intelligent Validation System** that adapts verification strategies based on task risk, project type, and available testing infrastructure.

### Success Metrics
- **Test Coverage**: 90%+ of code changes have automated test coverage
- **QA Loop Efficiency**: <3 iterations average to QA approval
- **Risk Detection Accuracy**: 95%+ accuracy in high-risk change classification
- **Zero Critical Escapes**: No critical security issues or data loss events in production
- **Autonomous Test Creation**: 80%+ of test infrastructure created autonomously by QA agent

### Technology Stack
- **Core Language**: Python 3.10+
- **Testing Frameworks**: pytest (Python), Vitest/Jest (JS/TS), Playwright (E2E), Go test, Cargo test
- **Security Scanning**: semgrep, npm audit, bandit, safety
- **Project Analysis**: Existing `project_analyzer.py` and `security.py`
- **Agent Framework**: Claude SDK (existing)
- **Storage**: File-based (JSON/Markdown) in spec directories

### Timeline Estimate
- **Phase 1 (Complexity Assessor Enhancement)**: 1-2 weeks
- **Phase 2 (Verification Strategy)**: 1-2 weeks
- **Phase 3 (Smart Test Discovery + CI Integration)**: 1-2 weeks
- **Phase 4 (QA Test Creation)**: 2-3 weeks
- **Phase 5 (Security Scanning)**: 1-2 weeks
- **Phase 6 (Multi-Service Orchestration)**: 1-2 weeks
- **Phase 7 (QA Loop + No-Test Projects)**: 1-2 weeks
- **Total**: 8-13 weeks

### Resource Requirements
- **1 Senior Backend Engineer**: Core validation engine, risk assessment
- **1 QA Automation Engineer**: Test framework integration, E2E testing
- **1 DevOps Engineer** (Part-time): Security scanning, deployment pipelines
- **AI Agents**: Planner, Coder, QA Reviewer, QA Fixer (existing agents with enhancements)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Feature Requirements](#feature-requirements)
   - [1. Task Risk Classification](#1-task-risk-classification)
   - [2. Verification Strategy (Planner Phase)](#2-verification-strategy-planner-phase)
   - [3. Smart Test Discovery](#3-smart-test-discovery)
   - [4. QA Test Creation](#4-qa-test-creation)
   - [5. Project Type Adaptation](#5-project-type-adaptation)
   - [6. High-Risk Validation](#6-high-risk-validation)
   - [7. QA Loop](#7-qa-loop)
   - [8. No-Test Projects](#8-no-test-projects)
3. [Technical Specifications](#technical-specifications)
4. [Implementation Plan](#implementation-plan)
5. [Testing & Validation](#testing--validation)
6. [Success Criteria](#success-criteria)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PLANNER AGENT                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Risk Classifier → Verification Strategy Builder          │  │
│  │   - Analyzes task scope                                   │  │
│  │   - Determines risk level (low/medium/high/critical)      │  │
│  │   - Defines verification requirements per chunk           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                 implementation_plan.json
         ┌───────────────────────────────────────┐
         │ + verification_strategy section       │
         │ + risk_level per chunk                │
         │ + required_test_types                 │
         └───────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         CODER AGENT                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Implements chunks WITHOUT creating tests                 │  │
│  │   - Focuses on functionality                              │  │
│  │   - Tests could break as implementation evolves           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   All chunks completed
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        QA AGENT                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Smart Test Discovery Module                              │  │
│  │   - Detects: package.json, pyproject.toml, Cargo.toml    │  │
│  │   - Identifies available test frameworks                  │  │
│  │   - Maps frameworks → test commands                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Test Creation Module                                      │  │
│  │   - Reads verification_strategy from plan                 │  │
│  │   - Creates coherent test suite for ENTIRE feature        │  │
│  │   - Unit + Integration + E2E as needed                    │  │
│  │   - High-risk: adds security tests                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Test Execution & Validation Module                        │  │
│  │   - Runs all tests                                        │  │
│  │   - For high-risk: security scan + staging deploy         │  │
│  │   - Generates qa_report.md                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│                  APPROVED or REJECTED                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                          REJECTED?
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      QA FIXER AGENT                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Reads QA_FIX_REQUEST.md → Applies fixes → Back to QA     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Loop until APPROVED
                   (Max: MAX_QA_ITERATIONS)
```

### Data Flow

1. **Planning Phase**: Planner analyzes task → Generates risk classification + verification strategy → Stores in `implementation_plan.json`
2. **Implementation Phase**: Coder implements chunks → NO test creation (tests would become stale)
3. **QA Phase**: QA Agent discovers test infrastructure → Creates comprehensive tests → Executes → Reports
4. **Fix Phase** (if needed): QA Fixer reads issues → Fixes code → QA re-validates

### Key Files & Directories

```
auto-claude/specs/XXX-name/
├── implementation_plan.json     # NOW INCLUDES: verification_strategy
├── risk_assessment.json         # NEW: Risk analysis results
├── test_discovery.json          # NEW: Detected test frameworks/commands
├── tests/                       # NEW: QA-generated tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── security_scan_results.json   # NEW: Security scan outputs (high-risk only)
├── qa_report.md                 # ENHANCED: Test results + validation
└── QA_FIX_REQUEST.md            # Existing: Fix requests
```

### Integration Points

- **`project_analyzer.py`**: Extend to detect test frameworks (Jest, pytest, Playwright, etc.)
- **`security.py`**: Add validators for security scanning tools (semgrep, npm audit, etc.)
- **`qa_loop.py`**: Enhance to include test creation before validation
- **`prompts/planner.md`**: Add risk assessment + verification strategy instructions
- **`prompts/qa_reviewer.md`**: Add test creation + smart discovery instructions

---

## Feature Requirements

### 1. Task Risk Classification

#### 1.1 User Story
**As a** development team,
**I want** the system to automatically classify task risk level,
**So that** high-risk changes receive appropriate validation depth.

#### 1.2 Functional Requirements

**FR-1.1: Integration with Existing Complexity Assessor**

The risk classification system **extends the existing AI-driven complexity assessor** (`prompts/complexity_assessor.md`) rather than replacing it. The complexity assessor already analyzes:
- Scope (files, services, cross-cutting concerns)
- Integrations (external services, dependencies)
- Infrastructure (Docker, database, config)
- Knowledge (patterns exist, research needed)
- Risk (concerns, security considerations)

**Key Principle**: Use AI judgment for flexibility, not rigid rules.

**FR-1.2: Enhanced Complexity Assessment Output**

Extend `complexity_assessment.json` to include validation recommendations:

```json
{
  "complexity": "standard",
  "workflow_type": "feature",
  "confidence": 0.85,
  "reasoning": "New API endpoint with auth changes...",

  "analysis": {
    "scope": { ... },
    "integrations": { ... },
    "infrastructure": { ... },
    "knowledge": { ... },
    "risk": {
      "level": "high",
      "concerns": ["authentication changes", "user data access"],
      "security_sensitive_areas": ["auth", "user_data"],
      "notes": "Modifies login flow"
    }
  },

  "validation_recommendations": {
    "risk_level": "high",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration", "e2e"],
    "security_scan_required": true,
    "staging_deployment_required": true,
    "reasoning": "Auth changes require comprehensive testing and security scan"
  },

  "recommended_phases": [...],
  "flags": { ... }
}
```

**FR-1.3: Risk Level Mapping (AI-Guided)**

The AI complexity assessor uses these guidelines (not rigid rules):

| Indicators | Typical Risk Level |
|------------|-------------------|
| Docs, typos, comments, README | LOW (may skip validation) |
| UI tweaks, config, single-file | LOW |
| New features, 3-10 files | MEDIUM |
| Database, API changes, auth | HIGH |
| Payment, data deletion, security-critical | CRITICAL |

**FR-1.4: Validation Mode Recommendations**

The AI assessor recommends validation depth:

| Risk Level | Validation Mode | Tests | Security | Staging |
|------------|-----------------|-------|----------|---------|
| **TRIVIAL** | Skip | None | No | No |
| **LOW** | Minimal | Unit only (if exist) | No | No |
| **MEDIUM** | Standard | Unit + Integration | No | No |
| **HIGH** | Full | Unit + Integration + E2E | Yes | Optional |
| **CRITICAL** | Full + Manual | All + Security tests | Yes | Yes |

#### 1.3 Acceptance Criteria
- [ ] Complexity assessor extended with `validation_recommendations` field
- [ ] AI correctly identifies trivial tasks (docs, typos) for skip-validation
- [ ] Risk level influences test creation depth
- [ ] Security-sensitive keywords trigger HIGH+ risk classification
- [ ] Planner agent reads and uses validation recommendations

#### 1.4 Technical Specifications

**Enhancement**: `auto-claude/prompts/complexity_assessor.md`

Add new section after "PHASE 3: OUTPUT ASSESSMENT":

```markdown
## PHASE 3.5: VALIDATION RECOMMENDATIONS

Based on your complexity and risk analysis, recommend validation depth:

### Skip Validation Criteria (TRIVIAL)
Set `skip_validation: true` ONLY when ALL of these are true:
- Changes are documentation-only (*.md, *.rst, comments)
- OR changes are purely cosmetic (whitespace, formatting)
- OR changes are version bumps with no code changes
- No functional code is modified
- Confidence is >= 0.9

### Minimal Mode Criteria (LOW)
Set `minimal_mode: true` when:
- Single service affected
- < 5 files modified
- No database changes
- No API signature changes
- No security-sensitive areas touched

### Security Scan Required
Set `security_scan_required: true` when ANY of these:
- Authentication/authorization code touched
- User data handling modified
- Payment/financial code involved
- API keys, secrets, or credentials involved
- New dependencies with network access

### Staging Deployment Required
Set `staging_deployment_required: true` when:
- Database migrations involved
- Breaking API changes
- Risk level is CRITICAL

### Output Format
Add to complexity_assessment.json:

\`\`\`json
"validation_recommendations": {
  "risk_level": "[trivial|low|medium|high|critical]",
  "skip_validation": [true|false],
  "minimal_mode": [true|false],
  "test_types_required": ["unit", "integration", "e2e"],
  "security_scan_required": [true|false],
  "staging_deployment_required": [true|false],
  "reasoning": "[Why this validation depth was chosen]"
}
\`\`\`
```

**Module**: `auto-claude/risk_classifier.py`

This module reads the AI-generated `complexity_assessment.json` and provides programmatic access:

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional
import json

@dataclass
class ValidationRecommendations:
    risk_level: str  # trivial/low/medium/high/critical
    skip_validation: bool
    minimal_mode: bool
    test_types_required: List[str]
    security_scan_required: bool
    staging_deployment_required: bool
    reasoning: str

@dataclass
class RiskAssessment:
    complexity: str  # simple/standard/complex
    workflow_type: str
    confidence: float
    risk_level: str
    validation: ValidationRecommendations

class RiskClassifier:
    """Reads AI-generated complexity assessment and provides risk classification."""

    def load_assessment(self, spec_dir: Path) -> Optional[RiskAssessment]:
        """Load complexity_assessment.json from spec directory."""
        assessment_file = spec_dir / "complexity_assessment.json"
        if not assessment_file.exists():
            return None

        with open(assessment_file) as f:
            data = json.load(f)

        validation = data.get("validation_recommendations", {})
        return RiskAssessment(
            complexity=data.get("complexity", "standard"),
            workflow_type=data.get("workflow_type", "feature"),
            confidence=data.get("confidence", 0.5),
            risk_level=validation.get("risk_level", "medium"),
            validation=ValidationRecommendations(
                risk_level=validation.get("risk_level", "medium"),
                skip_validation=validation.get("skip_validation", False),
                minimal_mode=validation.get("minimal_mode", False),
                test_types_required=validation.get("test_types_required", ["unit"]),
                security_scan_required=validation.get("security_scan_required", False),
                staging_deployment_required=validation.get("staging_deployment_required", False),
                reasoning=validation.get("reasoning", "")
            )
        )

    def should_skip_validation(self, spec_dir: Path) -> bool:
        """Quick check if validation can be skipped entirely."""
        assessment = self.load_assessment(spec_dir)
        return assessment and assessment.validation.skip_validation

    def get_required_test_types(self, spec_dir: Path) -> List[str]:
        """Get list of required test types based on risk."""
        assessment = self.load_assessment(spec_dir)
        if not assessment:
            return ["unit"]  # Default to unit tests
        return assessment.validation.test_types_required
```

---

### 2. Verification Strategy (Planner Phase)

#### 2.1 User Story
**As a** Planner Agent,
**I want** to define verification strategy during planning,
**So that** the QA Agent knows what types of tests are expected.

#### 2.2 Functional Requirements

**FR-2.1: Verification Strategy Definition**
- Planner reads `risk_assessment.json`
- For EACH chunk, defines:
  - **Expected test types**: unit, integration, e2e, security
  - **Acceptance criteria**: Specific behaviors to verify
  - **Test coverage targets**: Percentage or critical paths
  - **Security requirements**: Scans needed (if high-risk)

**FR-2.2: Implementation Plan Enhancement**
Add `verification_strategy` section to `implementation_plan.json`:
```json
{
  "workflow_type": "feature",
  "risk_assessment": {
    "overall_risk_level": "high",
    "risk_score": 68
  },
  "verification_strategy": {
    "test_creation_phase": "post_implementation",
    "test_types_required": ["unit", "integration", "e2e"],
    "security_scanning_required": true,
    "staging_deployment_required": true,
    "acceptance_criteria": [
      "All API endpoints return correct status codes",
      "Database migrations are reversible",
      "Authentication flow works end-to-end"
    ]
  },
  "phases": [
    {
      "id": "phase-1-backend",
      "chunks": [
        {
          "id": "chunk-1-1",
          "description": "Create user model with auth fields",
          "verification": {
            "expected_test_types": ["unit"],
            "acceptance_criteria": [
              "User model validates email format",
              "Password hashing works correctly"
            ],
            "security_concerns": ["password_storage"]
          }
        }
      ]
    }
  ]
}
```

**FR-2.3: Guidance, Not Requirements**
- Verification strategy is GUIDANCE for QA Agent
- QA Agent can ADD tests if coder did more than planned
- QA Agent can SKIP tests if chunk was not implemented
- Strategy is a starting point, not a constraint

#### 2.3 Acceptance Criteria
- [ ] Planner generates verification strategy for all risk levels
- [ ] Strategy adapts based on risk level (more tests for high-risk)
- [ ] QA Agent reads and uses strategy as guidance
- [ ] QA Agent can override strategy with justification

#### 2.4 Technical Specifications

**Enhancement**: `auto-claude/prompts/planner.md`

Add new section after "PHASE 3: CREATE implementation_plan.json":

```markdown
## PHASE 3.5: DEFINE VERIFICATION STRATEGY

After creating the implementation plan, define how QA will verify the implementation.

### Read Risk Assessment

cat risk_assessment.json

### Define Verification Strategy

Based on risk level, define:

1. **Test Types Required**
   - LOW risk: Unit tests only
   - MEDIUM risk: Unit + Integration tests
   - HIGH risk: Unit + Integration + E2E
   - CRITICAL risk: All above + Security tests + Staging deployment

2. **Security Requirements** (if risk_level >= HIGH)
   - security_scanning_required: true
   - staging_deployment_required: true
   - tools: ["semgrep", "bandit", "npm audit"]

3. **Acceptance Criteria**
   - List specific behaviors to verify
   - Map to chunks (which chunk verifies which criteria)

4. **Test Coverage Targets** (optional)
   - unit_coverage: 80%
   - integration_coverage: 60%

### Add to implementation_plan.json

Update the plan with verification_strategy section.
```

---

### 3. Smart Test Discovery

#### 3.1 User Story
**As a** QA Agent,
**I want** to automatically discover available test frameworks and commands,
**So that** I can run tests without manual configuration.

#### 3.2 Functional Requirements

**FR-3.1: Test Framework Detection**

Inspect project configuration files to detect test frameworks:

| File | Frameworks Detected |
|------|---------------------|
| `package.json` → `scripts.test` | Jest, Vitest, Mocha, Jasmine, Playwright, Cypress |
| `package.json` → `devDependencies` | `@playwright/test`, `cypress`, `jest`, `vitest` |
| `pyproject.toml` → `[tool.pytest]` | pytest |
| `pytest.ini`, `setup.cfg`, `tox.ini` | pytest |
| `Cargo.toml` → `[dev-dependencies]` | Cargo test |
| `go.mod` | Go test |
| `Gemfile` → `gem 'rspec'` | RSpec |
| `composer.json` → `phpunit` | PHPUnit |

**FR-3.2: Test Command Mapping**

Map detected frameworks to executable commands:

```python
FRAMEWORK_COMMANDS = {
    # JavaScript/TypeScript
    "jest": "npm test",  # or yarn test, pnpm test
    "vitest": "npm run test",
    "playwright": "npx playwright test",
    "cypress": "npx cypress run",
    "mocha": "npm test",

    # Python
    "pytest": "pytest tests/",

    # Rust
    "cargo_test": "cargo test",

    # Go
    "go_test": "go test ./...",

    # Ruby
    "rspec": "bundle exec rspec",

    # PHP
    "phpunit": "vendor/bin/phpunit",
}
```

**FR-3.3: Custom Script Detection**

If `package.json` has custom test scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest unit/",
    "test:integration": "vitest integration/",
    "test:e2e": "playwright test"
  }
}
```

Detect and use:
- `npm run test` → Run all tests
- `npm run test:unit` → Run unit tests
- `npm run test:integration` → Run integration tests
- `npm run test:e2e` → Run E2E tests

**FR-3.4: Output Format**

Store discovered commands in `test_discovery.json`:
```json
{
  "project_type": "nodejs_typescript",
  "frameworks_detected": [
    {
      "name": "vitest",
      "type": "unit",
      "command": "npm run test:unit",
      "config_file": "vitest.config.ts"
    },
    {
      "name": "playwright",
      "type": "e2e",
      "command": "npx playwright test",
      "config_file": "playwright.config.ts"
    }
  ],
  "test_directories": [
    "tests/unit",
    "tests/integration",
    "e2e"
  ],
  "coverage_command": "npm run test -- --coverage"
}
```

#### 3.3 Acceptance Criteria
- [ ] Detects Jest, Vitest, pytest, Playwright, Cypress, Go test, Cargo test
- [ ] Correctly maps frameworks to commands (npm/yarn/pnpm/bun detection)
- [ ] Handles projects with multiple test frameworks
- [ ] Stores discovery results in `test_discovery.json`

#### 3.4 Technical Specifications

**Module**: `auto-claude/test_discovery.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional
import json

@dataclass
class TestFramework:
    name: str
    type: str  # unit, integration, e2e
    command: str
    config_file: Optional[str]

class TestDiscovery:
    """Discovers test frameworks and commands in a project."""

    def discover(self, project_dir: Path) -> Dict:
        """Main entry point: discover all test frameworks."""
        pass

    def _detect_package_manager(self, project_dir: Path) -> str:
        """Detect npm/yarn/pnpm/bun."""
        pass

    def _discover_js_frameworks(self, project_dir: Path) -> List[TestFramework]:
        """Discover JS/TS test frameworks from package.json."""
        pass

    def _discover_python_frameworks(self, project_dir: Path) -> List[TestFramework]:
        """Discover Python test frameworks."""
        pass

    def _discover_rust_frameworks(self, project_dir: Path) -> List[TestFramework]:
        """Discover Rust test frameworks."""
        pass

    def _discover_go_frameworks(self, project_dir: Path) -> List[TestFramework]:
        """Discover Go test frameworks."""
        pass

    def _find_test_directories(self, project_dir: Path) -> List[str]:
        """Find test directories (tests/, __tests__, etc.)."""
        pass
```

**Integration**: Extend `project_analyzer.py` to include test framework detection.

---

### 4. QA Test Creation

#### 4.1 User Story
**As a** QA Agent,
**I want** to create comprehensive tests AFTER all chunks are complete,
**So that** I have a coherent test suite that covers the entire feature.

#### 4.2 Functional Requirements

**FR-4.1: Test Creation Timing**
- QA Agent creates tests AFTER all chunks marked as "completed"
- NEVER during chunk implementation (tests would break as code evolves)
- Creates coherent test suite covering entire feature

**FR-4.2: Test Types Created**

Based on `verification_strategy`:

| Test Type | When to Create | Example |
|-----------|----------------|---------|
| **Unit** | Always (all risk levels) | Test individual functions, methods, components |
| **Integration** | MEDIUM+ risk | Test service interactions, API endpoints |
| **E2E** | HIGH+ risk | Test full user flows, browser automation |
| **Security** | HIGH+ risk with security concerns | Test auth, authorization, input validation |

**FR-4.3: Test Creation Process**

1. **Read Verification Strategy**
   - Load `implementation_plan.json` → `verification_strategy`
   - Load `test_discovery.json` → Available frameworks

2. **Analyze Implemented Code**
   - Read all files changed in chunks
   - Identify: Functions to test, API endpoints, UI components

3. **Generate Tests**
   - Use detected framework syntax
   - Follow project patterns (read existing tests for style)
   - Create tests in appropriate directories

4. **Test Organization**
   ```
   specs/XXX/tests/
   ├── unit/
   │   ├── test_user_model.py
   │   └── test_auth_service.py
   ├── integration/
   │   └── test_user_api.py
   └── e2e/
       └── test_user_registration_flow.spec.ts
   ```

**FR-4.4: Test Template Examples**

**Python/pytest Unit Test**:
```python
# specs/XXX/tests/unit/test_user_model.py
import pytest
from app.models.user import User

def test_user_email_validation():
    """User model should validate email format."""
    user = User(email="invalid-email", password="test123")
    with pytest.raises(ValueError):
        user.validate()

def test_password_hashing():
    """Password should be hashed before storage."""
    user = User(email="test@example.com", password="plaintext")
    assert user.password != "plaintext"
    assert user.password.startswith("$2b$")  # bcrypt hash
```

**JavaScript/Vitest Integration Test**:
```typescript
// specs/XXX/tests/integration/test_user_api.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app'

describe('POST /api/users', () => {
  it('should create a new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@example.com',
        password: 'secure123'
      })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body.email).toBe('test@example.com')
  })

  it('should reject invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'invalid',
        password: 'secure123'
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('email')
  })
})
```

**Playwright E2E Test**:
```typescript
// specs/XXX/tests/e2e/test_user_registration.spec.ts
import { test, expect } from '@playwright/test'

test('user can register and login', async ({ page }) => {
  await page.goto('http://localhost:3000/register')

  // Fill registration form
  await page.fill('input[name="email"]', 'newuser@example.com')
  await page.fill('input[name="password"]', 'secure123')
  await page.fill('input[name="confirmPassword"]', 'secure123')
  await page.click('button[type="submit"]')

  // Should redirect to dashboard
  await expect(page).toHaveURL('http://localhost:3000/dashboard')
  await expect(page.locator('h1')).toContainText('Welcome')
})
```

**FR-4.5: QA Agent Can Add Tests Beyond Strategy**

If coder implemented additional functionality not in the plan:
- QA Agent SHOULD create tests for it
- QA Agent updates `implementation_plan.json` to reflect actual scope
- QA report includes: "Additional tests created for <feature> (not in original plan)"

#### 4.3 Acceptance Criteria
- [ ] Tests are created AFTER all chunks complete
- [ ] Test suite is coherent (not fragmented per-chunk)
- [ ] Tests follow project conventions (analyzed from existing tests)
- [ ] Tests are organized by type (unit, integration, e2e)
- [ ] QA Agent can add tests for unplanned functionality

#### 4.4 Technical Specifications

**Enhancement**: `auto-claude/prompts/qa_reviewer.md`

Add new section before "PHASE 3: RUN AUTOMATED TESTS":

```markdown
## PHASE 2.5: CREATE TESTS (If No Tests Exist)

**CRITICAL**: If the implementation has NO tests, you MUST create them now.

### Step 1: Read Verification Strategy

cat implementation_plan.json | jq '.verification_strategy'

### Step 2: Read Test Discovery Results

cat test_discovery.json

### Step 3: Analyze Implemented Code

# Find all files changed
git diff main --name-only

# Read implemented files to understand what to test
cat [files from diff]

### Step 4: Create Tests

Based on verification_strategy.test_types_required:

1. **Unit Tests**: Test individual functions/methods
   - Framework: [from test_discovery.json]
   - Location: tests/unit/ or __tests__/unit/
   - Pattern: test_*.py, *.test.ts, *_test.go

2. **Integration Tests**: Test service interactions
   - Framework: [from test_discovery.json]
   - Location: tests/integration/
   - Pattern: test_*_api.py, *.integration.test.ts

3. **E2E Tests**: Test full user flows (if required)
   - Framework: Playwright or Cypress
   - Location: e2e/ or tests/e2e/
   - Pattern: *.spec.ts

### Step 5: Follow Existing Patterns

# Find existing tests to copy style
find . -name "test_*.py" -o -name "*.test.ts" | head -5

# Read 2-3 existing test files to understand:
# - Naming conventions
# - Import patterns
# - Assertion style
# - Mocking/fixture patterns

### Step 6: Verify Tests Run

After creating tests, verify they execute:

# Run the test command from test_discovery.json
[test_command]

# If tests fail, FIX them before proceeding
# Tests must be GREEN before QA approval
```

---

### 5. Project Type Adaptation

#### 5.1 User Story
**As a** QA Agent,
**I want** validation strategies to adapt to project type,
**So that** I use appropriate verification methods for each stack.

#### 5.2 Functional Requirements

**FR-5.1: Project Type Detection**

Detect project type from:
- **`project_index.json`** (created by Planner)
- File patterns (HTML, package.json, pyproject.toml, etc.)
- Dependencies

**FR-5.2: Validation Strategies by Project Type**

| Project Type | Validation Strategy |
|--------------|---------------------|
| **Simple HTML/CSS** | - Visual verification (screenshots)<br>- Lighthouse (performance, accessibility)<br>- Link checking |
| **React/Vue SPA** | - Component tests (Vitest/Jest)<br>- E2E (Playwright)<br>- Browser console errors<br>- Lighthouse |
| **Fullstack (Next.js, Rails)** | - API tests (REST/GraphQL)<br>- Frontend tests<br>- Integration tests<br>- Database migration tests |
| **Python API (FastAPI, Flask)** | - pytest (unit + integration)<br>- httpx for API testing<br>- Database rollback tests |
| **CLI Tool** | - Command output verification<br>- Exit code checks<br>- Edge case testing (invalid args) |
| **Mobile (React Native, Flutter)** | - Unit tests<br>- Integration tests<br>- Emulator testing (if available) |

**FR-5.3: Fallback Strategies**

If NO test infrastructure exists:
- **Browser Verification**: Start dev server, load pages, check console
- **API Verification**: Manual curl/httpx requests to endpoints
- **CLI Verification**: Run commands, verify output
- **Documentation**: Create `MANUAL_TEST_PLAN.md` with steps

**FR-5.4: Example Adaptation: Simple HTML/CSS**

```python
# QA Agent detects: No package.json, just HTML/CSS files
# Validation strategy:
1. Start simple HTTP server (python -m http.server)
2. Load each page in headless browser (Playwright)
3. Take screenshots (before/after)
4. Check console for errors
5. Run Lighthouse audit:
   - Performance score > 90
   - Accessibility score > 90
   - No broken links
```

**FR-5.5: Example Adaptation: Python API**

```python
# QA Agent detects: FastAPI project with pytest
# Validation strategy:
1. Run pytest tests/ (unit + integration)
2. Check coverage (pytest --cov)
3. Test API endpoints with httpx:
   - POST /api/users (201 expected)
   - GET /api/users/123 (200 expected)
   - DELETE /api/users/999 (404 expected)
4. Check database migrations:
   - alembic current (should be latest)
   - Test rollback (alembic downgrade -1 && alembic upgrade head)
```

#### 5.3 Acceptance Criteria
- [ ] QA Agent adapts validation to project type
- [ ] Simple HTML/CSS projects use visual + Lighthouse validation
- [ ] SPA projects use component + E2E tests
- [ ] API projects use pytest/httpx + database checks
- [ ] CLI projects use command output verification
- [ ] Fallback to manual test plan if no test infra

#### 5.4 Technical Specifications

**Module**: `auto-claude/validation_strategy.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict

@dataclass
class ValidationStep:
    name: str
    command: str
    expected_outcome: str
    type: str  # test, visual, api, security

class ValidationStrategyBuilder:
    """Builds validation strategy based on project type."""

    def build_strategy(
        self,
        project_dir: Path,
        spec_dir: Path,
        risk_level: str
    ) -> List[ValidationStep]:
        """Main entry point: build validation strategy."""
        pass

    def _detect_project_type(self, project_dir: Path) -> str:
        """Detect project type (html, spa, fullstack, api, cli)."""
        pass

    def _strategy_for_html_css(self, risk_level: str) -> List[ValidationStep]:
        """Visual + Lighthouse validation."""
        pass

    def _strategy_for_spa(self, risk_level: str) -> List[ValidationStep]:
        """Component + E2E tests."""
        pass

    def _strategy_for_fullstack(self, risk_level: str) -> List[ValidationStep]:
        """API + Frontend + Integration tests."""
        pass

    def _strategy_for_python_api(self, risk_level: str) -> List[ValidationStep]:
        """pytest + API tests + DB checks."""
        pass

    def _strategy_for_cli(self, risk_level: str) -> List[ValidationStep]:
        """Command output verification."""
        pass
```

---

### 6. High-Risk Validation

#### 6.1 User Story
**As a** development team,
**I want** high-risk changes to undergo additional validation,
**So that** we prevent security issues and data loss.

#### 6.2 Functional Requirements

**FR-6.1: High-Risk Triggers**

Automatic high-risk validation when:
- `complexity_assessment.json` → `validation_recommendations.risk_level` is "high" or "critical"
- `validation_recommendations.security_scan_required` is `true`
- `validation_recommendations.staging_deployment_required` is `true`

**FR-6.2: Security Scanning (Integrates Existing scan_secrets.py)**

The security scanner **integrates the existing `scan_secrets.py`** module plus additional SAST tools:

| Scan Type | Tool | Source |
|-----------|------|--------|
| **Secrets Detection** | `scan_secrets.py` | **EXISTING** - 50+ patterns for API keys, tokens, credentials |
| **Python SAST** | `bandit` | External tool |
| **Python Dependencies** | `safety` | External tool |
| **JS/TS Dependencies** | `npm audit` | Built-in npm |
| **Multi-language SAST** | `semgrep` | External tool |
| **Rust Dependencies** | `cargo audit` | External tool |
| **Go SAST** | `gosec` | External tool |

**FR-6.3: Secrets Scanning (Using Existing Infrastructure)**

The existing `scan_secrets.py` provides:
- 50+ service-specific patterns (OpenAI, AWS, GitHub, Stripe, Slack, etc.)
- Private key detection (RSA, OpenSSH, DSA, EC, PGP)
- Database connection strings with embedded credentials
- False positive filtering
- JSON output mode for programmatic use
- Custom ignore patterns via `.secretsignore`

**Integration:**
```python
from scan_secrets import scan_files, get_all_tracked_files

# Scan all tracked files
files = get_all_tracked_files()
matches = scan_files(files, project_dir)

# Or scan specific changed files
changed_files = get_changed_files_from_spec(spec_dir)
matches = scan_files(changed_files, project_dir)
```

**FR-6.4: Security Scan Execution**

```bash
# 1. Secrets scan (ALWAYS run for HIGH+ risk)
python auto-claude/scan_secrets.py --path . --json > secrets_scan.json

# 2. Python SAST (if Python project)
bandit -r src/ -f json -o bandit_results.json
safety check --json > safety_results.json

# 3. JavaScript/TypeScript (if JS/TS project)
npm audit --json > npm_audit_results.json

# 4. Multi-language SAST (optional, if semgrep available)
semgrep --config=auto src/ --json > semgrep_results.json
```

**FR-6.5: Security Scan Results Processing**

Parse scan results and:
- **Block if CRITICAL vulnerabilities found** (including ANY secrets detected)
- **Block if secrets detected** (secrets are always CRITICAL)
- **Warn if HIGH vulnerabilities found** (allow with manual review)
- **Log LOW/MEDIUM** for future reference

**Secrets are always blocking:**
```python
if secrets_scan_results["secrets_found"]:
    return BlockingResult(
        severity="CRITICAL",
        reason="Secrets detected in code",
        matches=secrets_scan_results["matches"]
    )
```

**FR-6.6: Staging Deployment**

For CRITICAL risk tasks:
1. **Deploy to staging environment** (if available)
2. **Run smoke tests** on staging
3. **Check: No errors in logs**
4. **Check: Services are healthy**
5. **Rollback if issues detected**

**FR-6.7: Manual Review Checkpoint**

For CRITICAL risk:
- QA Agent adds manual review flag to `qa_report.md`
- Human review required before merge
- Document: What to review, why it's critical

#### 6.3 Acceptance Criteria
- [ ] Secrets scan runs automatically for high-risk tasks (using existing scan_secrets.py)
- [ ] ANY detected secrets block QA approval
- [ ] SAST scans run based on detected project type
- [ ] CRITICAL vulnerabilities block QA approval
- [ ] Staging deployment works for projects with staging config
- [ ] Manual review checkpoint added for CRITICAL risk
- [ ] All scan results consolidated in `security_scan_results.json`

#### 6.4 Technical Specifications

**Module**: `auto-claude/security_scanner.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional
import subprocess
import json

# Import existing secrets scanner
from scan_secrets import scan_files, scan_content, SecretMatch

@dataclass
class SecurityVulnerability:
    severity: str  # critical, high, medium, low
    source: str  # secrets, bandit, npm_audit, semgrep, etc.
    title: str
    description: str
    file: Optional[str]
    line: Optional[int]
    cwe: Optional[str]

class SecurityScanner:
    """Runs security scans including existing secrets scanner."""

    def scan(self, project_dir: Path, spec_dir: Path, changed_files: List[str] = None) -> Dict:
        """Main entry point: run all applicable security scans."""
        results = {
            "secrets": self._run_secrets_scan(project_dir, changed_files),
            "sast": [],
            "dependencies": [],
            "blocking": False,
            "blocking_reasons": []
        }

        # Run SAST based on project type
        if self._is_python_project(project_dir):
            results["sast"].extend(self._run_bandit(project_dir))
            results["dependencies"].extend(self._run_safety(project_dir))

        if self._is_js_project(project_dir):
            results["dependencies"].extend(self._run_npm_audit(project_dir))

        # Determine if blocking
        results["blocking"] = self._should_block_qa(results)
        results["blocking_reasons"] = self._get_blocking_reasons(results)

        # Save results
        self._save_results(spec_dir, results)
        return results

    def _run_secrets_scan(self, project_dir: Path, changed_files: List[str] = None) -> Dict:
        """Run existing scan_secrets.py on changed files."""
        if changed_files:
            files_to_scan = changed_files
        else:
            # Scan all tracked files
            from scan_secrets import get_all_tracked_files
            files_to_scan = get_all_tracked_files()

        matches = scan_files(files_to_scan, project_dir)

        return {
            "secrets_found": len(matches) > 0,
            "count": len(matches),
            "matches": [
                {
                    "file": m.file_path,
                    "line": m.line_number,
                    "type": m.pattern_name,
                    "severity": "critical"  # Secrets are always critical
                }
                for m in matches
            ]
        }

    def _should_block_qa(self, results: Dict) -> bool:
        """Determine if vulnerabilities should block QA approval."""
        # Secrets ALWAYS block
        if results["secrets"]["secrets_found"]:
            return True

        # Critical SAST findings block
        for vuln in results["sast"]:
            if vuln.severity == "critical":
                return True

        # Critical dependency vulnerabilities block
        for vuln in results["dependencies"]:
            if vuln.severity == "critical":
                return True

        return False

    def _run_bandit(self, project_dir: Path) -> List[SecurityVulnerability]:
        """Run bandit (Python SAST)."""
        try:
            result = subprocess.run(
                ["bandit", "-r", str(project_dir), "-f", "json"],
                capture_output=True, text=True
            )
            return self._parse_bandit_results(result.stdout)
        except FileNotFoundError:
            return []  # bandit not installed

    def _run_npm_audit(self, project_dir: Path) -> List[SecurityVulnerability]:
        """Run npm audit (Node.js dependencies)."""
        try:
            result = subprocess.run(
                ["npm", "audit", "--json"],
                cwd=project_dir,
                capture_output=True, text=True
            )
            return self._parse_npm_audit_results(result.stdout)
        except FileNotFoundError:
            return []

    # ... additional methods
```

**Integration**: Call from `qa_loop.py` before running tests if `security_scan_required == True`.

---

### 7. QA Loop

#### 7.1 User Story
**As a** QA system,
**I want** to iteratively fix issues until approval,
**So that** quality is guaranteed before merge.

#### 7.2 Functional Requirements

**FR-7.1: QA Loop Flow**

```
┌─────────────────────────────────────┐
│  QA REVIEWER                        │
│  - Runs tests                       │
│  - Validates acceptance criteria    │
│  - Checks security (if high-risk)   │
└─────────────────────────────────────┘
                 ↓
          ┌──────────────┐
          │  APPROVED?   │
          └──────────────┘
            /          \
         YES            NO
          ↓              ↓
    ┌─────────┐   ┌──────────────────────┐
    │  DONE   │   │  QA FIXER            │
    │  MERGE  │   │  - Reads issues      │
    └─────────┘   │  - Applies fixes     │
                  │  - Commits           │
                  └──────────────────────┘
                            ↓
                    Back to QA REVIEWER
                            ↓
                  (Loop until approved
                   or MAX_ITERATIONS)
```

**FR-7.2: Handoff Protocol**

**QA Reviewer → QA Fixer**:
- Creates `QA_FIX_REQUEST.md` with specific issues
- Updates `implementation_plan.json` → `qa_signoff.status` = "rejected"
- Sets `qa_signoff.ready_for_qa_revalidation` = false

**QA Fixer → QA Reviewer**:
- Fixes all issues in `QA_FIX_REQUEST.md`
- Commits fixes with message: `fix: Address QA issues (qa-requested)`
- Updates `implementation_plan.json` → `qa_signoff.status` = "fixes_applied"
- Sets `qa_signoff.ready_for_qa_revalidation` = true

**FR-7.3: Maximum Iterations**

```python
MAX_QA_ITERATIONS = 5  # Default, configurable

# If exceeded:
# 1. Mark build as "needs_human_review"
# 2. Create escalation report
# 3. Notify user (if Linear integration enabled)
```

**FR-7.4: Iteration Tracking**

Store in `implementation_plan.json`:
```json
{
  "qa_signoff": {
    "status": "rejected",  // approved, rejected, fixes_applied
    "qa_session": 3,
    "fix_sessions": 2,
    "issues_found": [
      {
        "iteration": 1,
        "issue": "Test failure: test_user_email_validation",
        "fixed": true
      },
      {
        "iteration": 2,
        "issue": "Console error: TypeError in UserForm",
        "fixed": true
      },
      {
        "iteration": 3,
        "issue": "Missing migration for new column",
        "fixed": false  // Current iteration
      }
    ],
    "ready_for_qa_revalidation": false
  }
}
```

**FR-7.5: Preventing Infinite Loops**

- Track issue recurrence (same issue fails multiple times)
- If issue recurs 3+ times:
  - Escalate to human
  - Mark as "unfixable_by_agent"
  - Create detailed report with root cause analysis

#### 7.3 Acceptance Criteria
- [ ] QA loop iterates until approval or max iterations
- [ ] Clear handoff protocol between QA Reviewer and QA Fixer
- [ ] Iteration count tracked in `implementation_plan.json`
- [ ] Infinite loops prevented (max iterations + recurrence detection)
- [ ] Human escalation works when loop fails

#### 7.4 Technical Specifications

**Enhancement**: `auto-claude/qa_loop.py`

Add iteration tracking:

```python
async def run_qa_validation_loop(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    verbose: bool = False,
    max_iterations: int = MAX_QA_ITERATIONS,
) -> bool:
    """
    Run the full QA validation loop with iteration tracking.
    """
    iteration = 0
    issue_history = []  # Track issues across iterations

    while iteration < max_iterations:
        iteration += 1

        # Run QA Reviewer
        status, issues = await run_qa_reviewer_session(...)

        if status == "approved":
            return True

        # Check for recurring issues
        if _has_recurring_issues(issues, issue_history):
            await _escalate_to_human(spec_dir, issues)
            return False

        issue_history.extend(issues)

        # Run QA Fixer
        fix_status = await run_qa_fixer_session(...)

        if fix_status != "fixed":
            return False

    # Max iterations exceeded
    await _escalate_to_human(spec_dir, issue_history)
    return False

def _has_recurring_issues(
    current_issues: List[str],
    history: List[str]
) -> bool:
    """Check if same issues appear 3+ times."""
    for issue in current_issues:
        count = sum(1 for h in history if _similar(h, issue))
        if count >= 3:
            return True
    return False
```

---

### 8. No-Test Projects

#### 8.1 User Story
**As a** QA Agent,
**I want** to handle projects with no test infrastructure,
**So that** validation still occurs even without automated tests.

#### 8.2 Functional Requirements

**FR-8.1: Detection**

Detect "no-test project" when:
- `test_discovery.json` → `frameworks_detected` is empty
- No test directories found
- No test scripts in `package.json`/`pyproject.toml`

**FR-8.2: Minimal Test Infrastructure Creation**

QA Agent creates minimal test setup:

**For Python**:
```bash
# Create test directory
mkdir -p tests

# Create pytest.ini
cat > pytest.ini << EOF
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
EOF

# Install pytest (if not present)
pip install pytest

# Create sample test
cat > tests/test_example.py << EOF
def test_placeholder():
    """Placeholder test - QA Agent will create real tests."""
    assert True
EOF
```

**For JavaScript/TypeScript**:
```bash
# Install Vitest
npm install -D vitest

# Update package.json scripts
npm pkg set scripts.test="vitest"

# Create vitest.config.ts
cat > vitest.config.ts << EOF
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
EOF

# Create sample test
mkdir -p tests
cat > tests/example.test.ts << EOF
import { describe, it, expect } from 'vitest'

describe('placeholder', () => {
  it('should pass', () => {
    expect(true).toBe(true)
  })
})
EOF
```

**FR-8.3: Fallback Verification**

If test infrastructure creation fails or is inappropriate:

1. **Browser Verification** (for web projects):
   ```python
   # Start dev server
   subprocess.Popen(["npm", "run", "dev"])

   # Use Playwright to verify
   from playwright.sync_api import sync_playwright

   with sync_playwright() as p:
       browser = p.chromium.launch()
       page = browser.new_page()
       page.goto("http://localhost:3000")

       # Check: No console errors
       errors = page.evaluate("() => window.console.errors || []")
       assert len(errors) == 0

       # Check: Page renders
       assert page.title() != ""

       browser.close()
   ```

2. **API Verification** (for API projects):
   ```python
   import httpx

   # Start API server
   subprocess.Popen(["python", "main.py"])

   # Verify endpoints
   response = httpx.post("http://localhost:8000/api/users", json={
       "email": "test@example.com",
       "password": "test123"
   })
   assert response.status_code == 201
   ```

3. **Manual Test Plan** (fallback):
   ```markdown
   # MANUAL_TEST_PLAN.md

   ## Feature: User Registration

   ### Test Case 1: Valid Registration
   **Steps:**
   1. Navigate to http://localhost:3000/register
   2. Enter email: test@example.com
   3. Enter password: secure123
   4. Click "Register"

   **Expected:**
   - User is created
   - Redirect to /dashboard
   - No console errors

   ### Test Case 2: Invalid Email
   **Steps:**
   1. Navigate to http://localhost:3000/register
   2. Enter email: invalid-email
   3. Enter password: secure123
   4. Click "Register"

   **Expected:**
   - Error message: "Invalid email format"
   - No redirect
   ```

**FR-8.4: Documentation**

Create `QA_TESTING_APPROACH.md`:
```markdown
# QA Testing Approach

## Project Type
Simple HTML/CSS website

## Test Infrastructure
**Status**: No automated tests

## Verification Strategy
- Manual browser testing (Chrome, Firefox, Safari)
- Lighthouse audit (Performance, Accessibility, SEO)
- Visual regression (screenshots)

## Manual Test Plan
See MANUAL_TEST_PLAN.md

## Recommendations for Future
1. Add Playwright for E2E testing
2. Add Lighthouse CI to CI/CD pipeline
3. Add Percy or Chromatic for visual regression
```

#### 8.3 Acceptance Criteria
- [ ] QA Agent detects projects with no test infrastructure
- [ ] Creates minimal test setup (pytest, Vitest) when appropriate
- [ ] Falls back to browser/API verification when tests are inappropriate
- [ ] Creates manual test plan as last resort
- [ ] Documents testing approach in `QA_TESTING_APPROACH.md`

#### 8.4 Technical Specifications

**Enhancement**: `auto-claude/prompts/qa_reviewer.md`

Add section after test discovery:

```markdown
## PHASE 2.75: HANDLE NO-TEST PROJECTS

If test_discovery.json shows NO test frameworks:

### Option 1: Create Minimal Test Infrastructure

**For Python projects:**
1. Create tests/ directory
2. Create pytest.ini
3. Install pytest
4. Create sample test file

**For JavaScript/TypeScript:**
1. Install vitest
2. Update package.json scripts
3. Create vitest.config.ts
4. Create sample test file

### Option 2: Fallback Verification

**For web projects:**
- Start dev server
- Use Playwright for browser verification
- Check: No console errors
- Check: Page renders
- Take screenshots

**For API projects:**
- Start API server
- Use httpx for endpoint verification
- Check: Expected status codes
- Check: Response format

### Option 3: Manual Test Plan

If automated testing is not appropriate:
- Create MANUAL_TEST_PLAN.md
- Document test cases with steps and expected results
- Create QA_TESTING_APPROACH.md explaining why manual testing
```

---

### 9. Multi-Service Testing

#### 9.1 User Story
**As a** QA Agent working on monorepo or multi-service projects,
**I want** to automatically orchestrate service dependencies before testing,
**So that** integration tests can run against real service instances.

#### 9.2 Functional Requirements

**FR-9.1: Multi-Service Detection**

Detect multi-service projects when:
- `docker-compose.yml` or `docker-compose.yaml` exists
- Multiple `package.json` / `pyproject.toml` in subdirectories
- Monorepo tool configs exist: `nx.json`, `turbo.json`, `lerna.json`, `pnpm-workspace.yaml`
- `project_index.json` shows `project_type: "monorepo"`

**FR-9.2: Service Orchestration**

Before running integration/e2e tests:

```bash
# 1. Detect docker-compose file
if [ -f docker-compose.test.yml ]; then
    COMPOSE_FILE="docker-compose.test.yml"
elif [ -f docker-compose.yml ]; then
    COMPOSE_FILE="docker-compose.yml"
fi

# 2. Start services
docker-compose -f $COMPOSE_FILE up -d

# 3. Wait for health checks
docker-compose -f $COMPOSE_FILE ps --filter "health=healthy"

# 4. Run tests
npm run test:integration

# 5. Tear down
docker-compose -f $COMPOSE_FILE down
```

**FR-9.3: Service Health Checks**

Wait for services to be healthy before running tests:

```python
import time
import subprocess

def wait_for_services(compose_file: str, timeout: int = 120) -> bool:
    """Wait for all services to be healthy."""
    start = time.time()
    while time.time() - start < timeout:
        result = subprocess.run(
            ["docker-compose", "-f", compose_file, "ps", "--format", "json"],
            capture_output=True, text=True
        )
        services = json.loads(result.stdout)

        all_healthy = all(
            s.get("Health") == "healthy" or s.get("State") == "running"
            for s in services
        )

        if all_healthy:
            return True

        time.sleep(5)

    return False
```

**FR-9.4: External Service Mocking**

For services that can't be dockerized (third-party APIs):

| Service Type | Mocking Strategy |
|--------------|------------------|
| AWS S3 | `moto` (Python) or `localstack` (Docker) |
| External HTTP APIs | `httpretty`, `responses` (Python) or `msw` (JS) |
| Stripe | `stripe-mock` Docker image |
| Database | Use test containers or Docker Compose |

**FR-9.5: API Contract Validation**

For frontend-backend coordination:

```python
# Detect API schemas
schemas_found = []
if (project_dir / "openapi.yaml").exists():
    schemas_found.append("openapi")
if (project_dir / "schema.graphql").exists():
    schemas_found.append("graphql")

# Run contract validation
if "openapi" in schemas_found:
    # Compare current schema against main branch
    subprocess.run([
        "openapi-diff",
        "main:openapi.yaml",
        "HEAD:openapi.yaml",
        "--fail-on-breaking"
    ])
```

**FR-9.6: Output Format**

Store in `service_orchestration.json`:
```json
{
  "project_type": "monorepo",
  "services_detected": [
    {"name": "api", "path": "services/api", "port": 8000},
    {"name": "frontend", "path": "apps/web", "port": 3000},
    {"name": "postgres", "type": "docker", "port": 5432}
  ],
  "compose_file": "docker-compose.test.yml",
  "orchestration_used": true,
  "services_started": ["api", "frontend", "postgres"],
  "health_check_passed": true,
  "mock_services": ["stripe"],
  "api_contracts": {
    "type": "openapi",
    "breaking_changes": false
  }
}
```

#### 9.3 Acceptance Criteria
- [ ] Detect multi-service projects (docker-compose, monorepo tools)
- [ ] Start services via docker-compose before integration tests
- [ ] Wait for health checks before running tests
- [ ] Tear down services after tests complete
- [ ] Provide mocking guidance for external services
- [ ] API contract validation for breaking changes

#### 9.4 Technical Specifications

**Module**: `auto-claude/service_orchestrator.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional
import subprocess
import json
import time

@dataclass
class ServiceConfig:
    name: str
    path: Optional[str]
    port: Optional[int]
    type: str  # docker, local, mock
    health_endpoint: Optional[str]

class ServiceOrchestrator:
    """Orchestrates multi-service environments for testing."""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.compose_file = self._find_compose_file()

    def _find_compose_file(self) -> Optional[str]:
        """Find docker-compose file."""
        for name in ["docker-compose.test.yml", "docker-compose.test.yaml",
                     "docker-compose.yml", "docker-compose.yaml"]:
            if (self.project_dir / name).exists():
                return name
        return None

    def is_multi_service(self) -> bool:
        """Detect if project is multi-service."""
        if self.compose_file:
            return True
        # Check for monorepo tools
        monorepo_markers = ["nx.json", "turbo.json", "lerna.json", "pnpm-workspace.yaml"]
        return any((self.project_dir / m).exists() for m in monorepo_markers)

    def start_services(self, timeout: int = 120) -> bool:
        """Start all services and wait for health."""
        if not self.compose_file:
            return True  # No services to start

        # Start services
        subprocess.run(
            ["docker-compose", "-f", self.compose_file, "up", "-d"],
            cwd=self.project_dir, check=True
        )

        # Wait for health
        return self._wait_for_health(timeout)

    def stop_services(self) -> None:
        """Stop all services."""
        if self.compose_file:
            subprocess.run(
                ["docker-compose", "-f", self.compose_file, "down"],
                cwd=self.project_dir
            )

    def _wait_for_health(self, timeout: int) -> bool:
        """Wait for all services to be healthy."""
        # Implementation as shown above
        pass
```

**Integration**: Call from `qa_loop.py` before running integration/e2e tests.

---

### 10. CI/CD Integration

#### 10.1 User Story
**As a** developer with existing CI/CD pipelines,
**I want** Auto Claude to integrate with my existing CI configuration,
**So that** validation reuses existing test infrastructure.

#### 10.2 Functional Requirements

**FR-10.1: CI Configuration Detection**

Detect existing CI configuration:

| File Pattern | CI System |
|--------------|-----------|
| `.github/workflows/*.yml` | GitHub Actions |
| `.gitlab-ci.yml` | GitLab CI |
| `Jenkinsfile` | Jenkins |
| `azure-pipelines.yml` | Azure DevOps |
| `bitbucket-pipelines.yml` | Bitbucket |
| `.circleci/config.yml` | CircleCI |
| `.travis.yml` | Travis CI |

**FR-10.2: Test Command Extraction**

Extract test commands from CI config:

```yaml
# Example: .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test:ci  # <-- Extract this command
      - name: Run e2e
        run: npm run test:e2e  # <-- And this
```

Extracted to `ci_discovery.json`:
```json
{
  "ci_system": "github_actions",
  "config_file": ".github/workflows/test.yml",
  "test_commands": {
    "unit": "npm run test:ci",
    "e2e": "npm run test:e2e"
  },
  "has_coverage": true,
  "coverage_command": "npm run test:ci -- --coverage",
  "environment_variables": ["DATABASE_URL", "API_KEY"]
}
```

**FR-10.3: CI vs Local Execution Choice**

The QA Agent can choose:

| Option | When to Use |
|--------|-------------|
| **Run locally** | Fast feedback, no CI secrets needed |
| **Trigger CI** | Need CI secrets, matrix testing, production-like environment |
| **Hybrid** | Run unit tests locally, trigger CI for integration/e2e |

**FR-10.4: Incremental Test Detection**

Only run tests affected by changed files:

```python
def get_affected_tests(changed_files: List[str], project_dir: Path) -> List[str]:
    """Determine which tests to run based on changed files."""

    # Use built-in tools if available
    if (project_dir / "jest.config.js").exists():
        # Jest has built-in changed detection
        return ["npx jest --changedSince=main"]

    if (project_dir / "vitest.config.ts").exists():
        # Vitest with changed files
        return ["npx vitest --changed"]

    # Manual mapping for Python
    test_files = []
    for changed in changed_files:
        if changed.endswith(".py"):
            # Map src/module.py -> tests/test_module.py
            test_path = changed.replace("src/", "tests/test_")
            if Path(test_path).exists():
                test_files.append(test_path)

    if test_files:
        return [f"pytest {' '.join(test_files)}"]

    return ["pytest tests/"]  # Fallback to all tests
```

**FR-10.5: Test Caching**

Respect and utilize existing caches:

```yaml
# Detect cache configuration from CI
cache_detected:
  - type: npm
    path: ~/.npm
    key: npm-${{ hashFiles('package-lock.json') }}
  - type: pip
    path: ~/.cache/pip
    key: pip-${{ hashFiles('requirements.txt') }}
```

Before running tests locally:
```bash
# Restore cache if available
if [ -d ~/.npm ]; then
    echo "Using cached npm modules"
fi

# Or pull from CI cache service
gh cache restore npm-cache
```

**FR-10.6: Coverage Threshold Enforcement**

Extract coverage thresholds from project config:

```python
def get_coverage_threshold(project_dir: Path) -> Optional[int]:
    """Extract coverage threshold from project config."""

    # Check jest.config.js
    jest_config = project_dir / "jest.config.js"
    if jest_config.exists():
        # Parse coverageThreshold
        pass

    # Check pyproject.toml
    pyproject = project_dir / "pyproject.toml"
    if pyproject.exists():
        import tomli
        config = tomli.loads(pyproject.read_text())
        return config.get("tool", {}).get("coverage", {}).get("fail_under")

    # Check codecov.yml
    codecov = project_dir / "codecov.yml"
    if codecov.exists():
        # Parse target coverage
        pass

    return None
```

#### 10.3 Acceptance Criteria
- [ ] Detect existing CI configuration files
- [ ] Extract test commands from CI config
- [ ] Provide option to run locally vs trigger CI
- [ ] Support incremental test execution (changed files only)
- [ ] Respect coverage thresholds from project config
- [ ] Cache awareness for faster test execution

#### 10.4 Technical Specifications

**Module**: `auto-claude/ci_discovery.py`

```python
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Optional
import yaml
import re

@dataclass
class CIConfig:
    ci_system: str  # github_actions, gitlab, jenkins, etc.
    config_file: str
    test_commands: Dict[str, str]  # unit, integration, e2e -> command
    coverage_command: Optional[str]
    environment_variables: List[str]
    cache_config: Dict[str, any]

class CIDiscovery:
    """Discovers and parses existing CI configuration."""

    def discover(self, project_dir: Path) -> Optional[CIConfig]:
        """Main entry point: discover CI configuration."""

        # Check GitHub Actions
        gh_workflows = project_dir / ".github" / "workflows"
        if gh_workflows.exists():
            return self._parse_github_actions(gh_workflows)

        # Check GitLab CI
        gitlab_ci = project_dir / ".gitlab-ci.yml"
        if gitlab_ci.exists():
            return self._parse_gitlab_ci(gitlab_ci)

        # Check other CI systems...
        return None

    def _parse_github_actions(self, workflows_dir: Path) -> CIConfig:
        """Parse GitHub Actions workflow files."""
        test_commands = {}
        env_vars = set()

        for workflow_file in workflows_dir.glob("*.yml"):
            with open(workflow_file) as f:
                workflow = yaml.safe_load(f)

            for job_name, job in workflow.get("jobs", {}).items():
                for step in job.get("steps", []):
                    run_cmd = step.get("run", "")

                    # Detect test commands
                    if "test" in run_cmd.lower():
                        if "e2e" in run_cmd or "playwright" in run_cmd:
                            test_commands["e2e"] = run_cmd
                        elif "integration" in run_cmd:
                            test_commands["integration"] = run_cmd
                        else:
                            test_commands["unit"] = run_cmd

                    # Extract environment variables
                    for match in re.findall(r'\$\{\{\s*secrets\.(\w+)\s*\}\}', run_cmd):
                        env_vars.add(match)

        return CIConfig(
            ci_system="github_actions",
            config_file=str(workflows_dir),
            test_commands=test_commands,
            coverage_command=test_commands.get("unit", "") + " --coverage",
            environment_variables=list(env_vars),
            cache_config={}
        )

    def get_test_command(self, project_dir: Path, test_type: str = "unit") -> str:
        """Get the appropriate test command for a test type."""
        config = self.discover(project_dir)
        if config and test_type in config.test_commands:
            return config.test_commands[test_type]

        # Fallback to defaults
        defaults = {
            "unit": "npm test",
            "integration": "npm run test:integration",
            "e2e": "npm run test:e2e"
        }
        return defaults.get(test_type, "npm test")
```

**Integration**: Call from `test_discovery.py` to augment test command detection.

---

## Technical Specifications

### Database Schema (File-Based)

All data stored in JSON/Markdown files within spec directories:

**`risk_assessment.json`**:
```json
{
  "schema_version": "1.0",
  "overall_risk_level": "high",
  "risk_score": 68,
  "risk_factors": { ... },
  "verification_requirements": { ... }
}
```

**`test_discovery.json`**:
```json
{
  "schema_version": "1.0",
  "project_type": "nodejs_typescript",
  "frameworks_detected": [ ... ],
  "test_directories": [ ... ],
  "commands": { ... }
}
```

**`implementation_plan.json` (enhanced)**:
```json
{
  "workflow_type": "feature",
  "risk_assessment": { ... },
  "verification_strategy": {
    "test_creation_phase": "post_implementation",
    "test_types_required": ["unit", "integration"],
    "security_scanning_required": true,
    "staging_deployment_required": false,
    "acceptance_criteria": [ ... ]
  },
  "phases": [ ... ],
  "qa_signoff": {
    "status": "approved",
    "qa_session": 2,
    "fix_sessions": 1,
    "timestamp": "2025-12-13T10:30:00Z",
    "tests_passed": {
      "unit": "45/45",
      "integration": "12/12",
      "e2e": "5/5"
    }
  }
}
```

### API Specifications (Internal Python APIs)

**RiskClassifier API**:
```python
class RiskClassifier:
    def analyze_spec(self, spec_dir: Path) -> RiskAssessment:
        """
        Analyze spec and return risk assessment.

        Args:
            spec_dir: Path to spec directory

        Returns:
            RiskAssessment object with risk level and factors
        """
        pass
```

**TestDiscovery API**:
```python
class TestDiscovery:
    def discover(self, project_dir: Path) -> Dict:
        """
        Discover test frameworks and commands.

        Args:
            project_dir: Path to project root

        Returns:
            Dict with frameworks_detected, commands, directories
        """
        pass
```

**SecurityScanner API**:
```python
class SecurityScanner:
    def scan(self, project_dir: Path, spec_dir: Path) -> Dict:
        """
        Run security scans and return results.

        Args:
            project_dir: Project root
            spec_dir: Spec directory for storing results

        Returns:
            Dict with vulnerabilities and scan status
        """
        pass
```

### New Modules & Files

**New Python Modules**:
1. `auto-claude/risk_classifier.py` - Reads AI-generated complexity_assessment.json, provides programmatic access
2. `auto-claude/test_discovery.py` - Detects test frameworks and commands
3. `auto-claude/security_scanner.py` - **Integrates existing `scan_secrets.py`** + SAST tools
4. `auto-claude/validation_strategy.py` - Builds validation strategy based on project type
5. `auto-claude/test_creator.py` - Creates tests after implementation
6. `auto-claude/service_orchestrator.py` - **NEW** Multi-service/monorepo orchestration
7. `auto-claude/ci_discovery.py` - **NEW** Detects and parses CI configuration

**Leveraged Existing Modules** (no changes needed, just integration):
1. `auto-claude/scan_secrets.py` - **EXISTING** - Secrets detection (50+ patterns)
2. `auto-claude/prompts/complexity_assessor.md` - **EXISTING** - AI-driven complexity assessment

**Enhanced Existing Modules**:
1. `auto-claude/project_analyzer.py` - Add test framework detection
2. `auto-claude/security.py` - Add security tool validators
3. `auto-claude/qa_loop.py` - Add test creation, iteration tracking, service orchestration

**Enhanced Prompts**:
1. `auto-claude/prompts/complexity_assessor.md` - **Add `validation_recommendations` output**
2. `auto-claude/prompts/planner.md` - Read validation recommendations, define verification strategy
3. `auto-claude/prompts/qa_reviewer.md` - Add test creation, smart discovery, service orchestration
4. `auto-claude/prompts/qa_fixer.md` - Add iteration awareness

**New Configuration Files**:
1. `/Users/andremikalsen/Documents/Coding/autonomous-coding/auto-claude/config/validation_config.yaml`:
   ```yaml
   risk_classification:
     weights:
       files_changed: 0.20
       layers_affected: 0.25
       security_sensitivity: 0.30
       breaking_change: 0.15
       dependency: 0.10
     thresholds:
       low: 25
       medium: 50
       high: 75

   qa_loop:
     max_iterations: 5
     recurrence_threshold: 3

   security_scanning:
     enabled_tools:
       python: ["bandit", "safety", "semgrep"]
       javascript: ["npm audit", "semgrep"]
       typescript: ["npm audit", "semgrep"]

   test_creation:
     create_if_missing: true
     min_coverage: 80  # percentage
   ```

---

## Implementation Plan

### Timeline Overview

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 1-2 weeks | Complexity Assessor Enhancement (validation_recommendations) |
| Phase 2 | 1-2 weeks | Verification Strategy Builder |
| Phase 3 | 1-2 weeks | Smart Test Discovery + CI Integration |
| Phase 4 | 2-3 weeks | QA Test Creation |
| Phase 5 | 1-2 weeks | Security Scanning (integrate scan_secrets.py) |
| Phase 6 | 1-2 weeks | Multi-Service Orchestration |
| Phase 7 | 1-2 weeks | QA Loop Enhancements + No-Test Projects |
| **Total** | **8-13 weeks** | |

---

### Phase 1: Complexity Assessor Enhancement (Weeks 1-2)

**Objectives:**
- Extend existing AI complexity assessor with validation recommendations
- Create risk_classifier.py to read AI output programmatically
- Enable skip-validation for trivial tasks

**Tasks:**
1. Enhance `prompts/complexity_assessor.md` with PHASE 3.5: VALIDATION RECOMMENDATIONS
2. Create `risk_classifier.py` module (reads complexity_assessment.json)
3. Implement `ValidationRecommendations` dataclass
4. Implement `RiskClassifier.load_assessment()`
5. Implement `should_skip_validation()` for trivial task detection
6. Unit tests for risk classifier
7. Integration test: Complexity Assessor → risk_classifier.py

**Deliverables:**
- Enhanced `prompts/complexity_assessor.md`
- `auto-claude/risk_classifier.py`
- `tests/test_risk_classifier.py`

**Acceptance Criteria:**
- [ ] AI complexity assessor outputs `validation_recommendations` field
- [ ] AI correctly identifies trivial tasks (docs, typos) for skip-validation
- [ ] risk_classifier.py correctly parses complexity_assessment.json
- [ ] Planner can read validation recommendations

---

### Phase 2: Verification Strategy (Weeks 3-4)

**Objectives:**
- Enhance planner to define verification strategies
- Map risk levels to verification requirements
- Store verification strategy in implementation plan

**Tasks:**
1. Enhance `prompts/planner.md` with verification strategy section
2. Create `validation_strategy.py` module
3. Implement `ValidationStrategyBuilder.build_strategy()`
4. Implement project type adapters:
   - `_strategy_for_html_css()`
   - `_strategy_for_spa()`
   - `_strategy_for_fullstack()`
   - `_strategy_for_python_api()`
   - `_strategy_for_cli()`
5. Enhance `implementation_plan.json` schema with `verification_strategy` section
6. Unit tests for validation strategy builder
7. Integration test: Planner → Risk → Verification Strategy

**Deliverables:**
- Enhanced `prompts/planner.md`
- `auto-claude/validation_strategy.py`
- `tests/test_validation_strategy.py`
- Updated `implementation_plan.json` schema

**Acceptance Criteria:**
- [ ] Planner generates verification strategy for all risk levels
- [ ] Strategy adapts to project type
- [ ] Verification strategy stored in implementation plan

---

### Phase 3: Smart Test Discovery + CI Integration (Weeks 5-6)

**Objectives:**
- Detect test frameworks in projects
- Map frameworks to executable commands
- Detect and reuse existing CI configuration
- Support incremental test execution

**Tasks:**
1. Extend `project_analyzer.py` to detect test frameworks
2. Create `test_discovery.py` module
3. Implement framework detectors:
   - `_discover_js_frameworks()`
   - `_discover_python_frameworks()`
   - `_discover_rust_frameworks()`
   - `_discover_go_frameworks()`
4. Implement package manager detection (npm/yarn/pnpm/bun)
5. **Create `ci_discovery.py` module**
6. **Implement CI config parsers:**
   - `_parse_github_actions()`
   - `_parse_gitlab_ci()`
   - `_parse_jenkinsfile()`
7. **Implement incremental test detection (changed files → affected tests)**
8. Implement test command mapper (prioritize CI commands if found)
9. Create `test_discovery.json` and `ci_discovery.json` schemas
10. Unit tests for test discovery and CI discovery
11. Integration test: QA Agent → Test Discovery → CI Integration

**Deliverables:**
- Enhanced `auto-claude/project_analyzer.py`
- `auto-claude/test_discovery.py`
- `auto-claude/ci_discovery.py` **NEW**
- `tests/test_discovery.py`
- `tests/test_ci_discovery.py` **NEW**

**Acceptance Criteria:**
- [ ] Detects Jest, Vitest, pytest, Playwright, Cypress, Go test, Cargo test
- [ ] Detects GitHub Actions, GitLab CI, Jenkins, CircleCI configs
- [ ] Extracts test commands from CI configuration
- [ ] Supports incremental test execution (--changedSince, --changed)
- [ ] Correctly maps frameworks to commands
- [ ] Handles multiple test frameworks

---

### Phase 4: QA Test Creation (Weeks 6-8)

**Objectives:**
- QA Agent creates tests after implementation complete
- Tests follow project patterns
- Tests are organized by type

**Tasks:**
1. Create `test_creator.py` module
2. Implement `TestCreator.create_tests()`
3. Implement test generators:
   - `_generate_unit_tests()`
   - `_generate_integration_tests()`
   - `_generate_e2e_tests()`
   - `_generate_security_tests()`
4. Implement test pattern analyzer (reads existing tests)
5. Enhance `prompts/qa_reviewer.md` with test creation section
6. Implement test file organizer (unit/, integration/, e2e/)
7. Unit tests for test creator
8. Integration test: QA Agent → Test Creation → Test Execution

**Deliverables:**
- `auto-claude/test_creator.py`
- Enhanced `prompts/qa_reviewer.md`
- `tests/test_creator.py`
- Example test templates documented

**Acceptance Criteria:**
- [ ] QA Agent creates tests after all chunks complete
- [ ] Tests follow project conventions
- [ ] Tests are organized by type
- [ ] Tests execute successfully

---

### Phase 5: Security Scanning (Weeks 9-10)

**Objectives:**
- Create security_scanner.py that **integrates existing scan_secrets.py**
- Add SAST tools (bandit, npm audit, semgrep)
- Implement staging deployment (optional)
- Add manual review checkpoints

**Tasks:**
1. Create `security_scanner.py` module
2. **Integrate existing `scan_secrets.py`:**
   - Import `scan_files`, `get_all_tracked_files`, `SecretMatch`
   - Call as primary secrets detection
3. Implement additional security tool runners:
   - `_run_bandit()` (Python SAST)
   - `_run_npm_audit()` (JavaScript dependencies)
   - `_run_semgrep()` (Multi-language SAST, optional)
   - `_run_safety()` (Python dependencies)
4. Implement vulnerability parser (consolidate all results)
5. Implement blocking logic:
   - **Secrets detected → ALWAYS block**
   - CRITICAL vulnerabilities → block
   - HIGH vulnerabilities → warn
6. Enhance `security.py` to allow security tool commands
7. Create `security_scan_results.json` schema
8. Implement staging deployment (optional, project-specific)
9. Unit tests for security scanner
10. Integration test: High-Risk Task → Security Scan → QA

**Deliverables:**
- `auto-claude/security_scanner.py` (integrates scan_secrets.py)
- Enhanced `auto-claude/security.py`
- `tests/test_security_scanner.py`
- `security_scan_results.json` schema documented

**Acceptance Criteria:**
- [ ] Secrets scan runs using existing scan_secrets.py
- [ ] ANY detected secrets block QA approval
- [ ] SAST scans run based on detected project type
- [ ] Security results consolidated in single JSON
- [ ] Manual review checkpoint added for critical tasks

---

### Phase 6: Multi-Service Orchestration (Weeks 11-12)

**Objectives:**
- Detect and orchestrate multi-service/monorepo projects
- Start services via docker-compose before tests
- Add API contract validation

**Tasks:**
1. Create `service_orchestrator.py` module
2. Implement multi-service detection:
   - docker-compose.yml detection
   - Monorepo tool detection (nx, turbo, lerna, pnpm-workspace)
3. Implement service orchestration:
   - `start_services()` - docker-compose up -d
   - `_wait_for_health()` - Health check polling
   - `stop_services()` - docker-compose down
4. Implement API contract validation:
   - OpenAPI schema diff detection
   - GraphQL schema comparison
5. Integrate with `qa_loop.py` (start services before integration/e2e tests)
6. Create `service_orchestration.json` schema
7. Unit tests for service orchestrator
8. Integration test: Multi-service project → Orchestration → Tests

**Deliverables:**
- `auto-claude/service_orchestrator.py`
- `tests/test_service_orchestrator.py`
- `service_orchestration.json` schema documented

**Acceptance Criteria:**
- [ ] Detect docker-compose and monorepo configurations
- [ ] Start services before integration/e2e tests
- [ ] Wait for health checks before proceeding
- [ ] Tear down services after tests complete
- [ ] API contract validation for breaking changes

---

### Phase 7: QA Loop Enhancements & No-Test Projects (Weeks 13-14)

**Objectives:**
- Implement iteration tracking
- Prevent infinite loops
- Handle no-test projects

**Tasks:**
1. Enhance `qa_loop.py` with iteration tracking
2. Implement recurring issue detection
3. Implement human escalation
4. Implement no-test project detection
5. Implement minimal test infrastructure creation
6. Implement fallback verification (browser, API)
7. Implement manual test plan generation
8. Enhanced `prompts/qa_reviewer.md` with no-test handling
9. Unit tests for QA loop enhancements
10. Integration test: Full QA Loop with iterations

**Deliverables:**
- Enhanced `auto-claude/qa_loop.py`
- Enhanced `prompts/qa_reviewer.md`
- `tests/test_qa_loop.py`
- Documentation for no-test projects

**Acceptance Criteria:**
- [ ] QA loop tracks iterations
- [ ] Infinite loops prevented
- [ ] No-test projects handled gracefully
- [ ] Manual test plans created when needed

---

## Testing & Validation

### Unit Tests

**Test Coverage Targets:**
- `risk_classifier.py`: 90%+
- `test_discovery.py`: 85%+
- `ci_discovery.py`: 85%+
- `security_scanner.py`: 80%+
- `validation_strategy.py`: 85%+
- `test_creator.py`: 80%+
- `service_orchestrator.py`: 80%+

**Test Files:**
```
tests/
├── test_risk_classifier.py
├── test_ci_discovery.py
├── test_service_orchestrator.py
├── test_discovery.py
├── test_security_scanner.py
├── test_validation_strategy.py
├── test_creator.py
└── test_qa_loop_enhancements.py
```

### Integration Tests

**Test Scenarios:**
1. **End-to-End: Low-Risk Feature**
   - Planner → Risk (LOW) → Verification Strategy (unit tests only) → QA → Approval
2. **End-to-End: High-Risk Feature**
   - Planner → Risk (HIGH) → Verification Strategy (unit+integration+e2e+security) → QA → Security Scan → Approval
3. **QA Loop: Multiple Iterations**
   - QA finds issues → Fixer fixes → QA re-validates → Approval
4. **No-Test Project**
   - QA detects no tests → Creates minimal infrastructure → Runs tests → Approval

**Test Projects:**
Create sample projects for testing:
- `tests/fixtures/simple_html/` - HTML/CSS project
- `tests/fixtures/react_spa/` - React SPA
- `tests/fixtures/python_api/` - FastAPI project
- `tests/fixtures/no_tests/` - Project with no test infrastructure

### Manual Testing Checklist

**Before Release:**
- [ ] Test risk classification on 10+ real-world specs
- [ ] Verify test discovery on 5+ different project types
- [ ] Run security scanner on projects with known vulnerabilities
- [ ] Test QA loop with intentionally broken code
- [ ] Test no-test project handling on legacy code
- [ ] Test staging deployment (if available)
- [ ] Verify manual review checkpoints work

---

## Success Criteria

### Quantitative Metrics

1. **Test Coverage**: 90%+ of code changes have automated test coverage
2. **QA Loop Efficiency**: Average <3 iterations to QA approval
3. **Risk Detection Accuracy**: 95%+ accuracy in high-risk classification
4. **Zero Critical Escapes**: No critical security issues in production
5. **Autonomous Test Creation**: 80%+ of test infrastructure created autonomously

### Qualitative Metrics

1. **Developer Satisfaction**: Developers trust the validation system
2. **Reduced Manual QA**: 70%+ reduction in manual QA time
3. **Security Posture**: High-risk changes always scanned
4. **Documentation Quality**: Clear test plans for all projects

### Acceptance Criteria (Overall)

- [ ] All phases completed and tested
- [ ] Integration tests pass on all project types
- [ ] Security scanning works on high-risk tasks
- [ ] QA loop prevents infinite iterations
- [ ] No-test projects handled gracefully
- [ ] Documentation complete (README, config, schemas)
- [ ] Performance: Risk classification <5s, Test creation <30s

---

## Appendix

### A. Glossary

- **Risk Level**: Classification of task danger (low/medium/high/critical)
- **Verification Strategy**: Plan for how to validate implementation
- **Test Discovery**: Automatic detection of test frameworks
- **QA Loop**: Iterative fix-validate cycle
- **High-Risk Validation**: Additional security/staging checks

### B. Configuration Reference

**`auto-claude/config/validation_config.yaml`**:
See "New Configuration Files" section above.

### C. File Naming Conventions

- **Complexity Assessment**: `complexity_assessment.json` (includes validation_recommendations)
- **Test Discovery**: `test_discovery.json`
- **CI Discovery**: `ci_discovery.json`
- **Service Orchestration**: `service_orchestration.json`
- **Security Results**: `security_scan_results.json`
- **QA Report**: `qa_report.md`
- **Fix Request**: `QA_FIX_REQUEST.md`
- **Test Plan**: `MANUAL_TEST_PLAN.md`
- **Testing Approach**: `QA_TESTING_APPROACH.md`

### D. Example Workflows

**Example 1: Simple HTML/CSS Change (Low Risk)**
```
User: "Change button color to blue"
↓
Planner: Risk=LOW, Strategy=visual+lighthouse
↓
Coder: Changes CSS
↓
QA: Lighthouse audit, screenshot comparison
↓
Approved
```

**Example 2: Auth System Change (High Risk)**
```
User: "Add OAuth2 authentication"
↓
Planner: Risk=HIGH, Strategy=unit+integration+e2e+security
↓
Coder: Implements OAuth2
↓
QA:
  - Discovers pytest
  - Creates auth tests
  - Runs security scan (bandit, semgrep)
  - Finds 1 issue (hardcoded secret)
↓
Fixer: Moves secret to .env
↓
QA: Re-validates, all pass
↓
Approved
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-13 | Atlas | Initial PRD creation |
| 1.1 | 2025-12-14 | Claude | **Major revision based on gap analysis:** |
| | | | - Section 1: Refactored to integrate with existing AI complexity_assessor.md (not rigid rules) |
| | | | - Section 6: Updated to integrate existing scan_secrets.py for secrets detection |
| | | | - Section 9: Added Multi-Service Testing (docker-compose orchestration, monorepo support) |
| | | | - Section 10: Added CI/CD Integration (GitHub Actions, GitLab CI, incremental testing) |
| | | | - Implementation Plan: Added Phase 6 (Multi-Service) and Phase 7, revised timeline to 8-13 weeks |
| | | | - New modules: service_orchestrator.py, ci_discovery.py |
| | | | - Leverages existing: scan_secrets.py, complexity_assessor.md |

---

## Sign-Off

**Architect**: Atlas (Principal Software Architect)
**Date**: 2025-12-13

**Reviewer**: Claude (Gap Analysis & Revision)
**Date**: 2025-12-14

**Status**: Ready for Implementation

This PRD defines a comprehensive, production-ready Intelligent Validation System for Auto Claude. All requirements are implementable, testable, and align with the existing codebase architecture. Key design principles:

1. **AI-driven flexibility** - Uses existing complexity_assessor.md for intelligent risk classification instead of rigid rules
2. **Leverages existing code** - Integrates scan_secrets.py for secrets detection instead of adding new tools
3. **Developer experience** - Supports skip-validation for trivial tasks, incremental testing for fast feedback
4. **Enterprise-ready** - Multi-service orchestration, CI/CD integration, security scanning
