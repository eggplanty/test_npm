#!/usr/bin/env python3
"""Download config file before Go build."""

import urllib.request
import json
import os

URL = "https://open.feishu.cn/llms.txt"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "llms.txt")


def main():
    print(f"Downloading config from {URL} ...")
    req = urllib.request.Request(URL)
    with urllib.request.urlopen(req) as resp:
        data = resp.read()

    with open(OUTPUT, "wb") as f:
        f.write(data)

    print(f"Config saved to {OUTPUT}")


if __name__ == "__main__":
    main()
