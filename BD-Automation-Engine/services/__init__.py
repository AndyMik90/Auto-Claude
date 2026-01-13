"""
BD Automation Engine - Services Package
Provides infrastructure services for the BD automation pipeline.

Services:
- database: PostgreSQL persistence layer
- scheduler: Automated 24-hour pipeline execution
- notion_sync: Notion database synchronization
- bullhorn_integration: Bullhorn CRM contact enrichment
"""

from .database import (
    DatabaseConfig,
    DatabaseManager,
    FileBasedStorage,
    get_storage,
)

from .scheduler import (
    SchedulerConfig,
    SchedulerService,
    ScheduledRun,
)

from .notion_sync import (
    NotionConfig,
    NotionSyncService,
)

from .bullhorn_integration import (
    BullhornConfig,
    BullhornClient,
    get_bullhorn_client,
)

__all__ = [
    # Database
    'DatabaseConfig',
    'DatabaseManager',
    'FileBasedStorage',
    'get_storage',

    # Scheduler
    'SchedulerConfig',
    'SchedulerService',
    'ScheduledRun',

    # Notion
    'NotionConfig',
    'NotionSyncService',

    # Bullhorn
    'BullhornConfig',
    'BullhornClient',
    'get_bullhorn_client',
]
