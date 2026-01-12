# Git Provider Factory

**Provider-agnostic interface for GitHub, GitLab, Bitbucket, and more.**

## Overview

The provider factory enables Auto Claude to work with any git hosting platform through a unified interface. Write your code once, and it works with GitHub, GitLab, Bitbucket, or any future provider.

## Architecture

```
GitProvider (Protocol)
    │
    ├── GitHubProvider ✅
    │   └── Uses: gh CLI via GHClient
    │
    ├── GitLabProvider ✅
    │   └── Uses: GitLab API via GitLabClient
    │
    ├── BitbucketProvider 🔜
    │
    ├── GiteaProvider 🔜
    │
    └── AzureDevOpsProvider 🔜
```

## Quick Start

### Basic Usage

```python
from runners.providers import create_provider, ProviderConfig
from runners.github.providers.protocol import ProviderType

# GitHub
config = ProviderConfig(
    provider_type=ProviderType.GITHUB,
    github_repo="owner/repo",
    project_dir="/path/to/project"
)
provider = create_provider(config)

# GitLab
config = ProviderConfig(
    provider_type=ProviderType.GITLAB,
    gitlab_project="group/project",
    gitlab_token="glpat-xxx",
    gitlab_instance_url="https://gitlab.com"
)
provider = create_provider(config)

# Same interface for both!
pr = await provider.fetch_pr(123)
await provider.post_review(123, review_data)
await provider.merge_pr(123)
```

### Provider-Agnostic Code

The power of the factory is that consuming code doesn't care which provider:

```python
async def review_pr(provider_type: str, pr_number: int):
    """This function works with ANY provider!"""

    # Factory creates the right provider
    config = load_config_for(provider_type)
    provider = create_provider(config)

    # Same code for GitHub, GitLab, Bitbucket, etc.
    pr = await provider.fetch_pr(pr_number)
    diff = await provider.fetch_pr_diff(pr_number)

    # Analyze the PR
    findings = analyze_code(diff)

    # Post review (works for all providers!)
    review = ReviewData(
        pr_number=pr_number,
        event="comment",
        body="Automated review",
        findings=findings
    )
    await provider.post_review(pr_number, review)
```

## Supported Providers

| Provider | Status | Implementation | CLI/API |
|----------|--------|----------------|---------|
| GitHub | ✅ Implemented | `github_provider.py` | gh CLI |
| GitLab | ✅ Implemented | `gitlab_provider.py` | GitLab API |
| Bitbucket | 🔜 Planned | - | - |
| Gitea | 🔜 Planned | - | - |
| Azure DevOps | 🔜 Planned | - | - |

## Provider Operations

All providers implement these operations:

### Pull Request Operations
- `fetch_pr(number)` - Get PR/MR details with diff
- `fetch_prs(filters)` - List PRs with filters
- `fetch_pr_diff(number)` - Get unified diff
- `post_review(pr_number, review)` - Post review with findings
- `merge_pr(pr_number, method)` - Merge PR (merge/squash/rebase)
- `close_pr(pr_number, comment)` - Close without merging

### Issue Operations
- `fetch_issue(number)` - Get issue details
- `fetch_issues(filters)` - List issues
- `create_issue(title, body, ...)` - Create new issue
- `close_issue(number, comment)` - Close issue
- `add_comment(number, body)` - Add comment

### Label Operations
- `apply_labels(number, labels)` - Add labels
- `remove_labels(number, labels)` - Remove labels
- `create_label(label)` - Create label
- `list_labels()` - List all labels

### Repository Operations
- `get_repository_info()` - Get repo metadata
- `get_default_branch()` - Get default branch name
- `check_permissions(username)` - Check user permissions

### Low-level API
- `api_get(endpoint, params)` - Direct GET request
- `api_post(endpoint, data)` - Direct POST request

## Data Models

All providers use these provider-agnostic models:

### PRData
```python
@dataclass
class PRData:
    number: int
    title: str
    body: str
    author: str
    state: str  # open, closed, merged
    source_branch: str
    target_branch: str
    additions: int
    deletions: int
    changed_files: int
    files: list[dict]
    diff: str
    url: str
    created_at: datetime
    updated_at: datetime
    labels: list[str]
    reviewers: list[str]
    is_draft: bool
    mergeable: bool
    provider: ProviderType
    raw_data: dict  # Provider-specific data
```

### IssueData
```python
@dataclass
class IssueData:
    number: int
    title: str
    body: str
    author: str
    state: str
    labels: list[str]
    created_at: datetime
    updated_at: datetime
    url: str
    assignees: list[str]
    milestone: str | None
    provider: ProviderType
    raw_data: dict
```

### ReviewData
```python
@dataclass
class ReviewData:
    pr_number: int
    event: str  # approve, request_changes, comment
    body: str
    findings: list[ReviewFinding]
    inline_comments: list[dict]
```

### ReviewFinding
```python
@dataclass
class ReviewFinding:
    id: str
    severity: str  # critical, high, medium, low, info
    category: str  # security, bug, performance, style
    title: str
    description: str
    file: str | None
    line: int | None
    suggested_fix: str | None
    confidence: float
```

## Provider-Specific Details

### GitHub Provider
- **Authentication**: Uses `gh` CLI authentication
- **API**: GitHub REST API v3 via gh CLI
- **Rate Limiting**: Optional (enabled by default)
- **Terminology**: Pull Request (PR)

### GitLab Provider
- **Authentication**: Personal Access Token (required)
- **API**: GitLab REST API v4
- **Rate Limiting**: Not applicable
- **Terminology**: Merge Request (MR, but mapped to PR in protocol)
- **Instance**: Supports gitlab.com and self-hosted

## Configuration

### ProviderConfig

```python
@dataclass
class ProviderConfig:
    provider_type: ProviderType | str
    project_dir: Path | str | None = None

    # GitHub-specific
    github_repo: str | None = None
    github_token: str | None = None

    # GitLab-specific
    gitlab_project: str | None = None
    gitlab_token: str | None = None
    gitlab_instance_url: str = "https://gitlab.com"

    # Generic options
    enable_rate_limiting: bool = True
```

### From Environment Config

Convenience function to create provider from project env:

```python
from runners.providers import create_provider_from_env

env_config = {
    "githubRepo": "owner/repo",
    "githubToken": "ghp_xxx"
}

provider = create_provider_from_env(
    provider_type="github",
    project_dir=Path.cwd(),
    env_config=env_config
)
```

## Adding a New Provider

To add support for a new git hosting platform:

1. **Implement the Protocol**

   ```python
   # runners/newplatform/providers/newplatform_provider.py

   @dataclass
   class NewPlatformProvider:
       def provider_type(self) -> ProviderType:
           return ProviderType.NEWPLATFORM

       async def fetch_pr(self, number: int) -> PRData:
           # Implement using platform's API/CLI
           ...
   ```

2. **Add to Factory**

   ```python
   # runners/providers/factory.py

   def create_provider(config: ProviderConfig) -> GitProvider:
       if config.provider_type == ProviderType.NEWPLATFORM:
           return _create_newplatform_provider(config)
   ```

3. **Add to Protocol Enum**

   ```python
   # runners/github/providers/protocol.py

   class ProviderType(str, Enum):
       GITHUB = "github"
       GITLAB = "gitlab"
       NEWPLATFORM = "newplatform"  # Add here
   ```

## Testing

Run the examples:

```bash
cd apps/backend
python -m runners.providers.example
```

## Migration Guide

### From GitHub-specific Code

**Before:**
```python
from runners.github.gh_client import GHClient

client = GHClient(project_dir=project_dir, repo="owner/repo")
pr_data = client.pr_view(123)
# ... GitHub-specific code ...
```

**After:**
```python
from runners.providers import create_provider, ProviderConfig
from runners.github.providers.protocol import ProviderType

config = ProviderConfig(
    provider_type=ProviderType.GITHUB,
    github_repo="owner/repo",
    project_dir=project_dir
)
provider = create_provider(config)
pr = await provider.fetch_pr(123)
# ... Provider-agnostic code that works with ANY provider! ...
```

## Benefits

✅ **Write Once, Run Anywhere** - Same code works with any git host
✅ **Type Safe** - Full type hints and protocol checking
✅ **Extensible** - Easy to add new providers
✅ **Consistent** - Unified data models across platforms
✅ **Provider-Agnostic** - Business logic doesn't depend on specific provider
✅ **Future-Proof** - Easy to migrate between platforms

## See Also

- `protocol.py` - Protocol definition and data models
- `github_provider.py` - GitHub implementation
- `gitlab_provider.py` - GitLab implementation
- `example.py` - Usage examples
