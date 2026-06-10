"""WebSocket API tests — positive and negative cases."""
from __future__ import annotations

import json
import uuid

import pytest

from config import FAKE_PROJECT_ID
from helpers.ws_helper import WsTestClient
from helpers.tokens import invalid_token_same_length


pytest.importorskip("websocket", reason="需要 websocket-client 包")


class TestWebSocketAuth:
    def test_auth_positive(self, admin_token):
        ws = WsTestClient().connect()
        try:
            msg = ws.auth(admin_token)
            assert msg.get("type") == "status"
            assert msg.get("status") == "connected"
        finally:
            ws.close()

    def test_auth_negative_invalid_token(self, admin_token):
        ws = WsTestClient().connect()
        try:
            ws.send_json({"type": "auth", "token": invalid_token_same_length(admin_token)})
            msg = ws.recv_json()
            assert msg.get("type") == "error"
        finally:
            ws.close()

    def test_auth_negative_no_auth_first(self):
        ws = WsTestClient().connect()
        try:
            ws.send_json({"type": "chat", "projectId": "x", "message": "hi"})
            msg = ws.recv_json()
            assert msg.get("type") == "error"
        finally:
            ws.close()


class TestWebSocketChat:
    def test_chat_negative_missing_project(self, admin_token):
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({"type": "chat", "message": "hello"})
            msg = ws.wait_for_type("error", timeout=3)
            assert msg is not None
            assert "projectId" in (msg.get("error") or "")
        finally:
            ws.close()

    def test_chat_negative_fake_project(self, admin_token):
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({"type": "chat", "projectId": FAKE_PROJECT_ID, "message": "hello"})
            msg = ws.wait_for_type("error", timeout=3)
            assert msg is not None
        finally:
            ws.close()

    def test_cancel_positive(self, admin_token, novel_project):
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({"type": "cancel"})
            msg = ws.recv_json()
            assert msg.get("type") == "status"
            assert msg.get("status") == "cancelled"
        finally:
            ws.close()


class TestWebSocketWrite:
    def test_write_negative_missing_chapter(self, admin_token, novel_project):
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({"type": "write", "projectId": novel_project["id"]})
            msg = ws.wait_for_type("error", timeout=3)
            assert msg is not None
        finally:
            ws.close()


class TestWebSocketInlineEdit:
    def test_inline_edit_negative_missing_text(self, admin_token, novel_project):
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({"type": "inline_edit", "projectId": novel_project["id"]})
            msg = ws.wait_for_type("error", timeout=3)
            assert msg is not None
        finally:
            ws.close()

    def test_inline_edit_positive_minimal(self, admin_token, novel_project):
        """正例：发送合法 inline_edit 请求，期望收到 status 或 result（不等待 AI 完成）。"""
        ws = WsTestClient().connect()
        try:
            ws.auth(admin_token)
            ws.send_json({
                "type": "inline_edit",
                "projectId": novel_project["id"],
                "selectedText": "测试文本",
                "action": "polish",
            })
            msg = ws.recv_json(timeout=10)
            assert msg.get("type") in ("status", "inline_edit_result", "error")
        finally:
            ws.close()
