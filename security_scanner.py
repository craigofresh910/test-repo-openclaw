#!/usr/bin/env python3
"""Code Security Scanner (stdlib-only)."""

import argparse
import json
import os
import re
from typing import Dict, List, Optional, Tuple

SKIP_DIRS = {"node_modules", "venv", ".git", "__pycache__"}

TARGET_EXTS = {
    ".py",
    ".js",
    ".ts",
    ".sh",
    ".bash",
    ".zsh",
    ".rb",
    ".go",
    ".rs",
    ".swift",
}

TARGET_FILENAMES = {
    "package.json",
    "requirements.txt",
    "makefile",
}

CONFIG_EXTS = {".env", ".ini", ".conf", ".cfg", ".yaml", ".yml", ".toml", ".json"}


def is_binary(data: bytes) -> bool:
    if not data:
        return False
    if b"\x00" in data:
        return True
    # Heuristic: large fraction of non-text bytes
    text_chars = bytearray({7, 8, 9, 10, 12, 13, 27} | set(range(0x20, 0x100)))
    nontext = data.translate(None, text_chars)
    return float(len(nontext)) / float(len(data)) > 0.30


def should_scan_file(path: str) -> bool:
    name = os.path.basename(path)
    lower = name.lower()
    _, ext = os.path.splitext(lower)

    if lower in TARGET_FILENAMES:
        return True
    if ext in TARGET_EXTS:
        return True
    if ext in CONFIG_EXTS:
        return True
    return False


Pattern = Dict[str, str]

PATTERNS: List[Tuple[str, Pattern]] = [
    # Critical: key/secret exfiltration
    (
        "api_key_exfiltration",
        {
            "severity": "critical",
            "description": "Reads API key/secret and sends it to a remote endpoint",
            "regex": r"(?i)(api[_-]?key|secret|token|password).*(curl|wget|requests\.|fetch\(|axios\.|http\.)",
        },
    ),
    (
        "env_secret_exfiltration",
        {
            "severity": "critical",
            "description": "Reads env secret and sends over network",
            "regex": r"(?i)(os\.environ\[|process\.env\.|ENV\[|getenv\()\s*[^\n]*?(curl|wget|requests\.|fetch\(|axios\.)",
        },
    ),
    (
        "reverse_shell",
        {
            "severity": "critical",
            "description": "Reverse shell or suspicious shell execution",
            "regex": r"(?i)(/bin/(bash|sh)\s+-i|nc\s+.*-e\s+/bin/(bash|sh)|bash\s+-i\s+>&\s*/dev/tcp)",
        },
    ),
    # High: destructive operations
    (
        "rm_rf_root_or_home",
        {
            "severity": "high",
            "description": "Potentially destructive delete (root/home)",
            "regex": r"(?i)\brm\s+-rf\s+(/$|/\*|~|/home|/Users)",
        },
    ),
    (
        "dangerous_chmod",
        {
            "severity": "high",
            "description": "Overly permissive chmod",
            "regex": r"(?i)\bchmod\s+777\b",
        },
    ),
    (
        "system_modification",
        {
            "severity": "high",
            "description": "System modification or persistence",
            "regex": r"(?i)\b(sudo\s+|launchctl\s+load|systemctl\s+enable|crontab\s+-e|/etc/rc\.local)\b",
        },
    ),
    # Medium: suspicious network/file behavior
    (
        "network_call",
        {
            "severity": "medium",
            "description": "Network call detected (review intent)",
            "regex": r"(?i)\b(curl|wget|requests\.|fetch\(|axios\.|http\.client|net/http)\b",
        },
    ),
    (
        "file_write",
        {
            "severity": "medium",
            "description": "Writes to filesystem",
            "regex": r"(?i)\b(open\([^\)]*['\"]w|writeFile\(|fs\.writeFile|os\.write|FileOutputStream)\b",
        },
    ),
    # Low: obfuscation / eval
    (
        "eval_or_exec",
        {
            "severity": "low",
            "description": "Dynamic code execution",
            "regex": r"(?i)\b(eval\(|exec\(|new\s+Function\(|loadstring\()",
        },
    ),
    (
        "base64_decode",
        {
            "severity": "low",
            "description": "Base64 decoding (possible obfuscation)",
            "regex": r"(?i)\b(base64\.|atob\(|b64decode\()",
        },
    ),
]


def compile_patterns() -> List[Tuple[str, Pattern, re.Pattern]]:
    compiled = []
    for name, meta in PATTERNS:
        compiled.append((name, meta, re.compile(meta["regex"])))
    return compiled


def scan_file(path: str, compiled: List[Tuple[str, Pattern, re.Pattern]]) -> List[Dict[str, str]]:
    findings = []
    try:
        with open(path, "rb") as f:
            data = f.read()
        if is_binary(data):
            return findings
        text = data.decode("utf-8", errors="replace")
    except OSError:
        return findings

    lines = text.splitlines()

    for i, line in enumerate(lines, start=1):
        for name, meta, regex in compiled:
            if regex.search(line):
                findings.append(
                    {
                        "file": path,
                        "line": i,
                        "pattern": name,
                        "severity": meta["severity"],
                        "description": meta["description"],
                        "code_snippet": line.strip()[:400],
                    }
                )
    return findings


def scan_directory(root: str) -> Dict[str, object]:
    compiled = compile_patterns()
    findings: List[Dict[str, str]] = []
    scanned_files = 0

    for current_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file_name in files:
            path = os.path.join(current_root, file_name)
            if not should_scan_file(path):
                continue

            scanned_files += 1
            findings.extend(scan_file(path, compiled))

    status = "flagged" if findings else "clean"
    return {
        "status": status,
        "scanned_files": scanned_files,
        "findings": findings,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Code security scanner")
    parser.add_argument("path", help="Path to directory to scan")
    parser.add_argument("--output", help="Write report to file (JSON)")
    args = parser.parse_args()

    report = scan_directory(args.path)
    output = json.dumps(report, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        print(output)


if __name__ == "__main__":
    main()
