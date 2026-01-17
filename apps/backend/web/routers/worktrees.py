"""
Worktrees Router
================

API endpoints for managing Git worktrees for task isolation.
"""

import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Ensure parent directory is in path for imports
_PARENT_DIR = Path(__file__).parent.parent.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

from core.worktree import WorktreeManager, WorktreeInfo
from .projects import load_projects

router = APIRouter()
logger = logging.getLogger("auto-claude-api")


class WorktreeResponse(BaseModel):
    """Response model for a single worktree."""

    spec_name: str
    branch: str
    path: str
    base_branch: str
    is_active: bool = True
    commit_count: int = 0
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    last_commit_date: Optional[str] = None
    days_since_last_commit: Optional[int] = None


class WorktreeListResponse(BaseModel):
    """Response model for listing worktrees."""

    worktrees: list[WorktreeResponse]
    total: int


class WorktreeStatusResponse(BaseModel):
    """Response model for worktree status."""

    has_worktree: bool
    spec_name: Optional[str] = None
    branch: Optional[str] = None
    path: Optional[str] = None
    commit_count: int = 0
    files_changed: int = 0
    has_uncommitted_changes: bool = False


class WorktreeDiffResponse(BaseModel):
    """Response model for worktree diff."""

    files: list[dict]
    summary: dict


class MergeRequest(BaseModel):
    """Request model for merging a worktree."""

    delete_after: bool = Field(default=False, description="Delete worktree after merge")
    no_commit: bool = Field(default=False, description="Stage changes without committing")
    base_branch: Optional[str] = Field(default=None, description="Target branch for merge")


def get_project_path(project_id: str) -> Path:
    """Get project path from project ID."""
    projects = load_projects()
    for p in projects:
        if p.get("id") == project_id:
            return Path(p.get("path", ""))
    raise HTTPException(status_code=404, detail="Project not found")


def worktree_info_to_response(info: WorktreeInfo) -> WorktreeResponse:
    """Convert WorktreeInfo to API response."""
    return WorktreeResponse(
        spec_name=info.spec_name,
        branch=info.branch,
        path=str(info.path),
        base_branch=info.base_branch,
        is_active=info.is_active,
        commit_count=info.commit_count,
        files_changed=info.files_changed,
        additions=info.additions,
        deletions=info.deletions,
        last_commit_date=info.last_commit_date.isoformat() if info.last_commit_date else None,
        days_since_last_commit=info.days_since_last_commit,
    )


@router.get("/projects/{project_id}/worktrees")
async def list_worktrees(project_id: str) -> dict:
    """List all worktrees for a project."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": True, "data": {"worktrees": [], "total": 0}}
    
    try:
        manager = WorktreeManager(project_path)
        worktrees = manager.list_all_worktrees()
        
        response = [worktree_info_to_response(w) for w in worktrees]
        
        return {
            "success": True,
            "data": {
                "worktrees": [r.model_dump() for r in response],
                "total": len(response)
            }
        }
    except Exception as e:
        logger.error(f"Error listing worktrees: {e}")
        return {"success": False, "error": str(e)}


@router.get("/projects/{project_id}/worktrees/{spec_name}")
async def get_worktree_status(project_id: str, spec_name: str) -> dict:
    """Get status of a specific worktree."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": True, "data": {"has_worktree": False}}
    
    try:
        manager = WorktreeManager(project_path)
        info = manager.get_worktree_info(spec_name)
        
        if not info:
            return {"success": True, "data": {"has_worktree": False}}
        
        has_uncommitted = manager.has_uncommitted_changes(spec_name)
        
        return {
            "success": True,
            "data": {
                "has_worktree": True,
                "spec_name": info.spec_name,
                "branch": info.branch,
                "path": str(info.path),
                "commit_count": info.commit_count,
                "files_changed": info.files_changed,
                "has_uncommitted_changes": has_uncommitted,
            }
        }
    except Exception as e:
        logger.error(f"Error getting worktree status: {e}")
        return {"success": False, "error": str(e)}


@router.get("/projects/{project_id}/worktrees/{spec_name}/diff")
async def get_worktree_diff(project_id: str, spec_name: str) -> dict:
    """Get diff of changes in a worktree."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": True, "data": {"files": [], "summary": {}}}
    
    try:
        manager = WorktreeManager(project_path)
        
        # Get changed files
        files = manager.get_changed_files(spec_name)
        summary = manager.get_change_summary(spec_name)
        
        file_list = [{"status": status, "path": path} for status, path in files]
        
        return {
            "success": True,
            "data": {
                "files": file_list,
                "summary": summary
            }
        }
    except Exception as e:
        logger.error(f"Error getting worktree diff: {e}")
        return {"success": False, "error": str(e)}


@router.post("/projects/{project_id}/worktrees/{spec_name}/merge")
async def merge_worktree(project_id: str, spec_name: str, request: MergeRequest) -> dict:
    """Merge a worktree back to the base branch."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": False, "error": "Project path not found"}
    
    try:
        manager = WorktreeManager(project_path)
        
        # Check if worktree exists
        info = manager.get_worktree_info(spec_name)
        if not info:
            return {"success": False, "error": f"No worktree found for spec: {spec_name}"}
        
        # Perform merge
        success = manager.merge_worktree(
            spec_name,
            delete_after=request.delete_after,
            no_commit=request.no_commit,
            base_branch=request.base_branch,
        )
        
        if success:
            return {
                "success": True,
                "data": {
                    "message": f"Successfully merged {info.branch}",
                    "deleted": request.delete_after
                }
            }
        else:
            return {
                "success": False,
                "error": "Merge failed - possible conflict"
            }
    except Exception as e:
        logger.error(f"Error merging worktree: {e}")
        return {"success": False, "error": str(e)}


@router.get("/projects/{project_id}/worktrees/{spec_name}/merge-preview")
async def merge_worktree_preview(
    project_id: str,
    spec_name: str,
    base_branch: Optional[str] = None,
) -> dict:
    """Preview what merging a worktree would do."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": True, "data": {"preview": None}}
    
    try:
        manager = WorktreeManager(project_path)
        
        info = manager.get_worktree_info(spec_name)
        if not info:
            return {"success": True, "data": {"preview": None}}
        
        preview_base = base_branch or info.base_branch

        files = manager.get_changed_files(spec_name, base_branch=preview_base)
        summary = manager.get_change_summary(spec_name, base_branch=preview_base)

        return {
            "success": True,
            "data": {
                "preview": {
                    "branch": info.branch,
                    "base_branch": preview_base,
                    "files": [{"status": s, "path": p} for s, p in files],
                    "summary": summary,
                    "commit_count": info.commit_count,
                }
            }
        }
    except Exception as e:
        logger.error(f"Error getting merge preview: {e}")
        return {"success": False, "error": str(e)}


@router.delete("/projects/{project_id}/worktrees/{spec_name}")
async def discard_worktree(project_id: str, spec_name: str, delete_branch: bool = True) -> dict:
    """Discard a worktree and optionally its branch."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": False, "error": "Project path not found"}
    
    try:
        manager = WorktreeManager(project_path)
        
        # Check if worktree exists
        info = manager.get_worktree_info(spec_name)
        if not info:
            return {"success": False, "error": f"No worktree found for spec: {spec_name}"}
        
        # Remove worktree
        manager.remove_worktree(spec_name, delete_branch=delete_branch)
        
        return {
            "success": True,
            "data": {
                "message": f"Discarded worktree for {spec_name}",
                "branch_deleted": delete_branch
            }
        }
    except Exception as e:
        logger.error(f"Error discarding worktree: {e}")
        return {"success": False, "error": str(e)}


@router.get("/projects/{project_id}/worktrees/{spec_name}/tools")
async def detect_worktree_tools(project_id: str, spec_name: str) -> dict:
    """Detect available tools/commands for a worktree."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": True, "data": {"commands": []}}
    
    try:
        manager = WorktreeManager(project_path)
        commands = manager.get_test_commands(spec_name)
        
        return {
            "success": True,
            "data": {
                "commands": commands
            }
        }
    except Exception as e:
        logger.error(f"Error detecting tools: {e}")
        return {"success": False, "error": str(e)}


@router.post("/projects/{project_id}/worktrees/cleanup")
async def cleanup_worktrees(project_id: str, days_threshold: int = 30) -> dict:
    """Cleanup old/stale worktrees."""
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        return {"success": False, "error": "Project path not found"}
    
    try:
        manager = WorktreeManager(project_path)
        
        # Get old worktrees before cleanup
        old_worktrees = manager.get_old_worktrees(days_threshold=days_threshold)
        
        # Cleanup stale worktrees
        manager.cleanup_stale_worktrees()
        
        return {
            "success": True,
            "data": {
                "message": "Cleanup completed",
                "old_worktrees": old_worktrees
            }
        }
    except Exception as e:
        logger.error(f"Error cleaning up worktrees: {e}")
        return {"success": False, "error": str(e)}
