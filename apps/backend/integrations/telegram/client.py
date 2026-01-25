"""
Telegram Bot API Client
=======================

Simple HTTP client for Telegram Bot API.
"""

import asyncio
import json
from typing import Optional, Any

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
    from urllib.parse import urlencode

from .config import TelegramConfig


class TelegramClient:
    """Telegram Bot API client using requests (with urllib fallback)."""

    BASE_URL = "https://api.telegram.org/bot"

    def __init__(self, config: TelegramConfig):
        self.config = config
        self.api_url = f"{self.BASE_URL}{config.bot_token}"

    def _make_request(
        self,
        method: str,
        params: Optional[dict] = None,
        timeout: int = 30,
    ) -> Optional[dict]:
        """
        Make a request to the Telegram Bot API.

        Args:
            method: API method name (e.g., 'sendMessage', 'getUpdates')
            params: Parameters to send
            timeout: Request timeout in seconds

        Returns:
            Response JSON as dict, or None if failed
        """
        url = f"{self.api_url}/{method}"

        if HAS_REQUESTS:
            return self._make_request_with_requests(url, params, timeout)
        else:
            return self._make_request_with_urllib(url, params, timeout)

    def _make_request_with_requests(
        self,
        url: str,
        params: Optional[dict] = None,
        timeout: int = 30,
    ) -> Optional[dict]:
        """Make request using requests library."""
        try:
            if params:
                response = requests.post(url, data=params, timeout=timeout)
            else:
                response = requests.get(url, timeout=timeout)

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"Telegram API error: {e}")
            return None

    def _make_request_with_urllib(
        self,
        url: str,
        params: Optional[dict] = None,
        timeout: int = 30,
    ) -> Optional[dict]:
        """Make request using urllib (fallback)."""
        try:
            if params:
                data = urlencode(params).encode("utf-8")
                req = Request(url, data=data, method="POST")
            else:
                req = Request(url, method="GET")

            req.add_header("Content-Type", "application/x-www-form-urlencoded")

            with urlopen(req, timeout=timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
                return result

        except HTTPError as e:
            print(f"Telegram API HTTP error: {e.code} - {e.reason}")
            return None

        except URLError as e:
            print(f"Telegram API URL error: {e.reason}")
            return None

        except Exception as e:
            print(f"Telegram API error: {e}")
            return None

    def send_message(
        self,
        text: str,
        chat_id: Optional[str] = None,
        parse_mode: Optional[str] = None,
        disable_notification: Optional[bool] = None,
        reply_to_message_id: Optional[int] = None,
    ) -> Optional[dict]:
        """
        Send a text message.

        Args:
            text: Message text (supports HTML/Markdown based on parse_mode)
            chat_id: Target chat ID (defaults to config chat_id)
            parse_mode: 'HTML' or 'Markdown' (defaults to config)
            disable_notification: Send silently (defaults to config)
            reply_to_message_id: Message to reply to

        Returns:
            Sent message object, or None if failed
        """
        params = {
            "chat_id": chat_id or self.config.chat_id,
            "text": text,
            "parse_mode": parse_mode or self.config.parse_mode,
        }

        if disable_notification is None:
            disable_notification = self.config.disable_notification

        if disable_notification:
            params["disable_notification"] = "true"

        if reply_to_message_id:
            params["reply_to_message_id"] = str(reply_to_message_id)

        result = self._make_request("sendMessage", params)

        if result and result.get("ok"):
            return result.get("result")

        return None

    def get_me(self) -> Optional[dict]:
        """Get bot information."""
        result = self._make_request("getMe")
        if result and result.get("ok"):
            return result.get("result")
        return None

    def get_updates(
        self,
        offset: Optional[int] = None,
        limit: int = 100,
        timeout: int = 30,
    ) -> list[dict]:
        """
        Get incoming updates (messages, commands, etc.).

        Args:
            offset: Identifier of the first update to return
            limit: Maximum number of updates (1-100)
            timeout: Long polling timeout

        Returns:
            List of update objects
        """
        params = {
            "limit": str(limit),
            "timeout": str(timeout),
        }

        if offset is not None:
            params["offset"] = str(offset)

        result = self._make_request("getUpdates", params, timeout=timeout + 5)

        if result and result.get("ok"):
            return result.get("result", [])

        return []

    def set_webhook(
        self,
        url: str,
        secret_token: Optional[str] = None,
    ) -> bool:
        """
        Set webhook URL for receiving updates.

        Args:
            url: HTTPS URL for webhook
            secret_token: Secret token for webhook verification

        Returns:
            True if successful
        """
        params = {"url": url}

        if secret_token:
            params["secret_token"] = secret_token

        result = self._make_request("setWebhook", params)
        return bool(result and result.get("ok"))

    def delete_webhook(self) -> bool:
        """Remove webhook and switch to getUpdates mode."""
        result = self._make_request("deleteWebhook")
        return bool(result and result.get("ok"))


class AsyncTelegramClient(TelegramClient):
    """Async wrapper for TelegramClient."""

    async def send_message_async(
        self,
        text: str,
        chat_id: Optional[str] = None,
        **kwargs,
    ) -> Optional[dict]:
        """Async version of send_message."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.send_message(text, chat_id, **kwargs),
        )

    async def get_updates_async(
        self,
        offset: Optional[int] = None,
        **kwargs,
    ) -> list[dict]:
        """Async version of get_updates."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.get_updates(offset, **kwargs),
        )
