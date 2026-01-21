"""
Human Input Manager
===================

Manages human input requests during agent execution. Allows agents to pause
and request input/decisions from users through a file-based protocol.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger(__name__)

# Type aliases
QuestionType = Literal["choice", "multi_choice", "text", "confirm"]
InputStatus = Literal["pending", "answered", "timeout", "skipped"]


class HumanInputOption:
    """Represents a selectable option for choice questions."""

    def __init__(
        self,
        id: str,
        label: str,
        description: str | None = None,
        recommended: bool = False,
    ):
        self.id = id
        self.label = label
        self.description = description
        self.recommended = recommended

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "label": self.label,
        }
        if self.description:
            result["description"] = self.description
        if self.recommended:
            result["recommended"] = True
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "HumanInputOption":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            label=data["label"],
            description=data.get("description"),
            recommended=data.get("recommended", False),
        )


class HumanInputRequest:
    """Represents a request for human input."""

    def __init__(
        self,
        id: str,
        type: QuestionType,
        title: str,
        description: str,
        context: str | None = None,
        options: list[HumanInputOption] | None = None,
        placeholder: str | None = None,
        max_length: int | None = None,
        timeout_seconds: int | None = 300,
        phase: str | None = None,
        subtask_id: str | None = None,
    ):
        self.id = id
        self.type = type
        self.title = title
        self.description = description
        self.context = context
        self.options = options or []
        self.placeholder = placeholder
        self.max_length = max_length
        self.timeout_seconds = timeout_seconds
        self.phase = phase
        self.subtask_id = subtask_id
        self.status: InputStatus = "pending"
        self.created_at = datetime.now().isoformat()
        self.answer: Any = None
        self.answered_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "created_at": self.created_at,
            "status": self.status,
            "type": self.type,
            "question": {
                "title": self.title,
                "description": self.description,
            },
            "answer": self.answer,
            "answered_at": self.answered_at,
            "timeout_seconds": self.timeout_seconds,
        }

        if self.context:
            result["question"]["context"] = self.context

        if self.phase:
            result["phase"] = self.phase

        if self.subtask_id:
            result["subtask_id"] = self.subtask_id

        if self.options:
            result["options"] = [opt.to_dict() for opt in self.options]

        if self.placeholder:
            result["placeholder"] = self.placeholder

        if self.max_length:
            result["max_length"] = self.max_length

        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "HumanInputRequest":
        """Create from dictionary."""
        question = data.get("question", {})
        options = [
            HumanInputOption.from_dict(opt) for opt in data.get("options", [])
        ]

        request = cls(
            id=data["id"],
            type=data["type"],
            title=question.get("title", ""),
            description=question.get("description", ""),
            context=question.get("context"),
            options=options,
            placeholder=data.get("placeholder"),
            max_length=data.get("max_length"),
            timeout_seconds=data.get("timeout_seconds"),
            phase=data.get("phase"),
            subtask_id=data.get("subtask_id"),
        )
        request.status = data.get("status", "pending")
        request.created_at = data.get("created_at", datetime.now().isoformat())
        request.answer = data.get("answer")
        request.answered_at = data.get("answered_at")
        return request


class HumanInputManager:
    """Manages human input requests during agent execution."""

    INPUT_FILE = "human_input.json"
    POLL_INTERVAL = 1.0  # seconds between polls

    def __init__(self, spec_dir: Path):
        """
        Initialize the human input manager.

        Args:
            spec_dir: Path to the spec directory where human_input.json will be stored
        """
        self.spec_dir = Path(spec_dir)
        self.input_file = self.spec_dir / self.INPUT_FILE

    def request_choice(
        self,
        title: str,
        description: str,
        options: list[dict[str, Any]],
        context: str | None = None,
        timeout: int = 300,
        phase: str | None = None,
        subtask_id: str | None = None,
    ) -> str | None:
        """
        Request user to choose from options.

        Args:
            title: Short question title
            description: Detailed question description
            options: List of option dicts with keys: id, label, description, recommended
            context: Additional context about why asking
            timeout: Seconds to wait before timeout (default 300)
            phase: Current build phase
            subtask_id: Current subtask ID

        Returns:
            Selected option ID, or None if timeout/skipped
        """
        option_objects = [
            HumanInputOption(
                id=opt.get("id", str(i)),
                label=opt["label"],
                description=opt.get("description"),
                recommended=opt.get("recommended", False),
            )
            for i, opt in enumerate(options)
        ]

        request = HumanInputRequest(
            id=self._generate_id(),
            type="choice",
            title=title,
            description=description,
            context=context,
            options=option_objects,
            timeout_seconds=timeout,
            phase=phase,
            subtask_id=subtask_id,
        )

        self._write_request(request)
        logger.info(f"Human input requested: {title}")

        answer = self._wait_for_answer(timeout)

        if answer is not None:
            logger.info(f"Human input received: {answer}")
        else:
            logger.warning(f"Human input timed out or skipped for: {title}")

        return answer

    def request_multi_choice(
        self,
        title: str,
        description: str,
        options: list[dict[str, Any]],
        context: str | None = None,
        timeout: int = 300,
        phase: str | None = None,
        subtask_id: str | None = None,
    ) -> list[str] | None:
        """
        Request user to select multiple options.

        Args:
            title: Short question title
            description: Detailed question description
            options: List of option dicts with keys: id, label, description
            context: Additional context about why asking
            timeout: Seconds to wait before timeout (default 300)
            phase: Current build phase
            subtask_id: Current subtask ID

        Returns:
            List of selected option IDs, or None if timeout/skipped
        """
        option_objects = [
            HumanInputOption(
                id=opt.get("id", str(i)),
                label=opt["label"],
                description=opt.get("description"),
                recommended=opt.get("recommended", False),
            )
            for i, opt in enumerate(options)
        ]

        request = HumanInputRequest(
            id=self._generate_id(),
            type="multi_choice",
            title=title,
            description=description,
            context=context,
            options=option_objects,
            timeout_seconds=timeout,
            phase=phase,
            subtask_id=subtask_id,
        )

        self._write_request(request)
        logger.info(f"Human multi-choice input requested: {title}")

        answer = self._wait_for_answer(timeout)
        return answer

    def request_text(
        self,
        title: str,
        description: str,
        placeholder: str | None = None,
        max_length: int | None = None,
        context: str | None = None,
        timeout: int = 300,
        phase: str | None = None,
        subtask_id: str | None = None,
    ) -> str | None:
        """
        Request free text input from user.

        Args:
            title: Short question title
            description: Detailed question description
            placeholder: Placeholder text for input field
            max_length: Maximum allowed input length
            context: Additional context about why asking
            timeout: Seconds to wait before timeout (default 300)
            phase: Current build phase
            subtask_id: Current subtask ID

        Returns:
            User's text input, or None if timeout/skipped
        """
        request = HumanInputRequest(
            id=self._generate_id(),
            type="text",
            title=title,
            description=description,
            context=context,
            placeholder=placeholder,
            max_length=max_length,
            timeout_seconds=timeout,
            phase=phase,
            subtask_id=subtask_id,
        )

        self._write_request(request)
        logger.info(f"Human text input requested: {title}")

        answer = self._wait_for_answer(timeout)
        return answer

    def request_confirm(
        self,
        title: str,
        description: str,
        context: str | None = None,
        timeout: int = 300,
        phase: str | None = None,
        subtask_id: str | None = None,
    ) -> bool | None:
        """
        Request yes/no confirmation from user.

        Args:
            title: Short question title
            description: Detailed question description
            context: Additional context about why asking
            timeout: Seconds to wait before timeout (default 300)
            phase: Current build phase
            subtask_id: Current subtask ID

        Returns:
            True for yes, False for no, None if timeout/skipped
        """
        request = HumanInputRequest(
            id=self._generate_id(),
            type="confirm",
            title=title,
            description=description,
            context=context,
            timeout_seconds=timeout,
            phase=phase,
            subtask_id=subtask_id,
        )

        self._write_request(request)
        logger.info(f"Human confirmation requested: {title}")

        answer = self._wait_for_answer(timeout)
        return answer

    def get_pending_request(self) -> HumanInputRequest | None:
        """
        Get the current pending request, if any.

        Returns:
            HumanInputRequest if there's a pending request, None otherwise
        """
        data = self._read_request()
        if data and data.get("status") == "pending":
            return HumanInputRequest.from_dict(data)
        return None

    def clear_request(self) -> None:
        """Clear the current request file."""
        if self.input_file.exists():
            self.input_file.unlink()
            logger.debug("Human input request cleared")

    def _wait_for_answer(self, timeout: int) -> Any:
        """
        Poll for answer with timeout.

        Args:
            timeout: Maximum seconds to wait

        Returns:
            The answer value, or None if timeout/skipped
        """
        start = time.time()
        while time.time() - start < timeout:
            data = self._read_request()
            if data:
                status = data.get("status")
                if status == "answered":
                    return data.get("answer")
                elif status == "skipped":
                    return None
                elif status == "timeout":
                    return None
            time.sleep(self.POLL_INTERVAL)

        # Timeout reached - mark as such
        self._update_status("timeout")
        return None

    def _write_request(self, request: HumanInputRequest) -> None:
        """Write request to file."""
        self.spec_dir.mkdir(parents=True, exist_ok=True)
        with open(self.input_file, "w") as f:
            json.dump(request.to_dict(), f, indent=2)

    def _read_request(self) -> dict[str, Any] | None:
        """Read request from file."""
        if not self.input_file.exists():
            return None
        try:
            with open(self.input_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Error reading human input file: {e}")
            return None

    def _update_status(self, status: InputStatus) -> None:
        """Update the status of the current request."""
        data = self._read_request()
        if data:
            data["status"] = status
            with open(self.input_file, "w") as f:
                json.dump(data, f, indent=2)

    def _generate_id(self) -> str:
        """Generate a unique request ID."""
        timestamp = datetime.now().strftime("%H%M%S")
        short_uuid = uuid.uuid4().hex[:6]
        return f"input-{timestamp}-{short_uuid}"
