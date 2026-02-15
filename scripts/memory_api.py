#!/usr/bin/env python3
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import urllib.request

BASE_URL = os.environ.get("MEMORY_API_URL", "https://ducksurfer.com/api/memory")
API_KEY = os.environ.get("MEMORY_API_KEY", "")

WORKSPACE = Path("/Users/craigofresh/.openclaw/workspace")
MEMORY_FILES = [WORKSPACE / "MEMORY.md"] + sorted((WORKSPACE / "memory").glob("*.md"))


def api_request(path: str, method: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if not API_KEY:
        raise SystemExit("MEMORY_API_KEY missing")
    url = f"{BASE_URL}{path}"
    data = None
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}


def cmd_add(args: argparse.Namespace) -> None:
    payload: Dict[str, Any] = {
        "type": args.type,
        "content": args.content,
        "tags": args.tags,
    }
    if args.metadata_json:
        payload["metadata"] = json.loads(args.metadata_json)
    result = api_request("/add", "POST", payload)
    print(json.dumps(result, indent=2))


def cmd_search(args: argparse.Namespace) -> None:
    payload = {"query": args.query, "limit": args.limit}
    result = api_request("/search", "POST", payload)
    print(json.dumps(result, indent=2))


def cmd_recent(args: argparse.Namespace) -> None:
    url = f"{BASE_URL}/recent?limit={args.limit}"
    req = urllib.request.Request(url, headers={"x-api-key": API_KEY}, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        result = json.loads(body) if body else {}
    print(json.dumps(result, indent=2))


def cmd_backfill(_: argparse.Namespace) -> None:
    added = 0
    for file_path in MEMORY_FILES:
        if not file_path.exists():
            continue
        content = file_path.read_text(encoding="utf-8").strip()
        if not content:
            continue
        payload = {
            "type": "file",
            "content": content,
            "tags": ["memory"],
            "metadata": {"path": str(file_path)},
        }
        api_request("/add", "POST", payload)
        added += 1
        print(f"Added {file_path}")
    print(f"Backfill complete. Files added: {added}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Memory API client")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--type", default="note")
    p_add.add_argument("--content", required=True)
    p_add.add_argument("--tags", nargs="*")
    p_add.add_argument("--metadata-json")
    p_add.set_defaults(func=cmd_add)

    p_search = sub.add_parser("search")
    p_search.add_argument("--query", required=True)
    p_search.add_argument("--limit", type=int, default=20)
    p_search.set_defaults(func=cmd_search)

    p_recent = sub.add_parser("recent")
    p_recent.add_argument("--limit", type=int, default=20)
    p_recent.set_defaults(func=cmd_recent)

    p_backfill = sub.add_parser("backfill")
    p_backfill.set_defaults(func=cmd_backfill)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
