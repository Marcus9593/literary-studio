"""HTTP client wrapper for Literary Studio API tests."""
from __future__ import annotations

import json
from typing import Any, Mapping, Optional
from urllib.parse import quote, urlencode

import requests

from config import API_PREFIX, BASE_URL, REQUEST_TIMEOUT


class ApiClient:
    """Thin requests wrapper with auth header support."""

    def __init__(self, token: Optional[str] = None, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.session = requests.Session()

    def with_token(self, token: Optional[str]) -> "ApiClient":
        clone = ApiClient(token=token, base_url=self.base_url)
        return clone

    def _headers(self, extra: Optional[Mapping[str, str]] = None) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if extra:
            headers.update(extra)
        return headers

    def url(self, path: str, query: Optional[dict[str, Any]] = None) -> str:
        if not path.startswith("/"):
            path = f"{API_PREFIX}/{path}"
        elif not path.startswith(API_PREFIX):
            path = f"{API_PREFIX}{path}" if path.startswith("/") else f"{API_PREFIX}/{path}"
        # Encode non-ASCII path segments (e.g. workspace category 正文)
        parts = path.split("/")
        path = "/".join(quote(p, safe="") if p and not p.isascii() else p for p in parts)
        full = f"{self.base_url}{path}"
        if query:
            clean = {k: v for k, v in query.items() if v is not None}
            if clean:
                full = f"{full}?{urlencode(clean)}"
        return full

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any = None,
        data: Any = None,
        files: Any = None,
        query: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
        timeout: float = REQUEST_TIMEOUT,
        raw: bool = False,
    ) -> requests.Response:
        url = self.url(path, query)
        hdrs = self._headers(headers)
        if json_body is not None and "Content-Type" not in hdrs:
            hdrs["Content-Type"] = "application/json"
        resp = self.session.request(
            method.upper(),
            url,
            json=json_body,
            data=data,
            files=files,
            headers=hdrs,
            timeout=timeout,
        )
        if raw:
            return resp
        return resp

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs) -> requests.Response:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs) -> requests.Response:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs) -> requests.Response:
        return self.request("DELETE", path, **kwargs)

    def login(self, username: str, password: str) -> dict[str, Any]:
        resp = self.post("/auth/login", json_body={"username": username, "password": password})
        resp.raise_for_status()
        payload = resp.json()
        self.token = payload["token"]
        return payload

    def json_or_text(self, resp: requests.Response) -> Any:
        ct = resp.headers.get("Content-Type", "")
        if "json" in ct:
            try:
                return resp.json()
            except json.JSONDecodeError:
                return resp.text
        return resp.text
