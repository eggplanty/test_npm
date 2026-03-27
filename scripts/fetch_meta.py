#!/usr/bin/env python3
# Copyright (c) 2026 Lark Technologies Pte. Ltd.
# SPDX-License-Identifier: MIT
"""Fetch meta_data.json from remote API for build-time embedding.

Falls back to merging from_meta/*.json if the remote fetch fails.

Usage:
    python3 scripts/fetch_meta.py              # fetch from feishu (default)
    python3 scripts/fetch_meta.py --brand lark  # fetch from larksuite
"""

import argparse
import glob
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(SCRIPT_DIR, "..")
OUT_PATH = os.path.join(ROOT, "internal", "registry", "meta_data.json")
META_DIR = os.path.join(ROOT, "internal", "registry", "from_meta")

API_HOSTS = {
    "feishu": "https://open.feishu.cn/api/tools/open/api_definition",
    "lark": "https://open.larksuite.com/api/tools/open/api_definition",
}

TIMEOUT = 10  # seconds


def get_version():
    """Get version from git tags, matching Makefile logic."""
    try:
        return subprocess.check_output(
            ["git", "describe", "--tags", "--always", "--dirty"],
            stderr=subprocess.DEVNULL,
            text=True,
            cwd=ROOT,
        ).strip()
    except Exception:
        return "dev"


def fetch_remote(brand):
    """Fetch MergedRegistry from remote API."""
    base = API_HOSTS.get(brand, API_HOSTS["feishu"])
    version = get_version()
    url = f"{base}?protocol=meta&client_version={urllib.request.quote(version)}"

    print(f"fetch-meta: GET {url}", file=sys.stderr)
    req = urllib.request.Request(url)
    resp = urllib.request.urlopen(req, timeout=TIMEOUT)
    body = resp.read()

    envelope = json.loads(body)
    if envelope.get("msg") != "succeeded":
        raise RuntimeError(f"unexpected response msg: {envelope.get('msg')!r}")

    data = envelope.get("data", {})
    if not data.get("services"):
        raise RuntimeError("remote returned empty services")

    return data


def merge_local():
    """Fallback: merge from_meta/*.json (same as merge_from_meta.py)."""
    files = sorted(glob.glob(os.path.join(META_DIR, "*.json")))
    if not files:
        print("fetch-meta: error: no from_meta/*.json files for fallback", file=sys.stderr)
        sys.exit(1)

    services = []
    for f in files:
        with open(f) as fp:
            services.append(json.load(fp))

    return {"version": "1.0.0", "services": services}


def main():
    parser = argparse.ArgumentParser(description="Fetch meta_data.json for build-time embedding")
    parser.add_argument("--brand", default="feishu", choices=["feishu", "lark"],
                        help="API brand (default: feishu)")
    args = parser.parse_args()

    try:
        data = fetch_remote(args.brand)
        count = len(data.get("services", []))
        print(f"fetch-meta: OK, {count} services from remote API", file=sys.stderr)
    except Exception as e:
        print(f"fetch-meta: remote failed ({e}), falling back to from_meta/*.json", file=sys.stderr)
        data = merge_local()
        count = len(data.get("services", []))
        print(f"fetch-meta: OK, {count} services from local fallback", file=sys.stderr)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
        fp.write("\n")


if __name__ == "__main__":
    main()
