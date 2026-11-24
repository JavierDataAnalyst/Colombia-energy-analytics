"""Minimal client for XM's public API (https://servapibi.xm.com.co). No key required."""

import time

import requests

BASE_URL = "https://servapibi.xm.com.co"


class XMError(Exception):
    pass


def post(endpoint: str, body: dict, retries: int = 3, timeout: int = 180) -> dict:
    """POST with simple retries. Raises XMError on a bad status or an unexpected payload."""
    url = f"{BASE_URL}/{endpoint}"
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(url, json=body, timeout=timeout)
            if r.status_code == 200:
                data = r.json()
                if "Items" not in data:
                    raise XMError(f"Unexpected payload from {endpoint}: keys {list(data)}")
                return data
            last_error = f"HTTP {r.status_code}: {r.text[:200]}"
        except (requests.RequestException, ValueError) as exc:
            last_error = str(exc)
        time.sleep(5 * attempt)
    raise XMError(f"{endpoint} {body.get('MetricId')} failed after {retries} attempts: {last_error}")
