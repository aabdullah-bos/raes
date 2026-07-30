#!/usr/bin/env python3
"""Read-only deterministic preflight for Stage 1 RAES initialization."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import sys
from pathlib import Path
from typing import Any

GENERATED = (
    "docs/system.md", "docs/pipeline.md", "docs/decisions.md",
    "docs/prd-ux-review.md", "docs/execution-guidance.md",
    "docs/validation.md", "raes.config.yaml",
)
PRIMARY = {"prd": "docs/prd.md", "srs": "docs/srs.md", "architecture": "docs/architecture.md"}


def error(code: str, message: str, path: str | None = None) -> dict[str, str]:
    value = {"code": code, "message": message}
    if path is not None:
        value["path"] = path
    return value


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(131072), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_file(raw: str, role: str, markdown: bool) -> tuple[Path | None, dict[str, str] | None]:
    path = Path(raw).expanduser().resolve(strict=False)
    try:
        info = path.stat()
    except OSError:
        return None, error("INPUT_MISSING", f"{role} input does not exist.", str(path))
    if not stat.S_ISREG(info.st_mode):
        return None, error("INPUT_NOT_REGULAR_FILE", f"{role} input is not a regular file.", str(path))
    if info.st_mode & 0o444 == 0 or not os.access(path, os.R_OK):
        return None, error("INPUT_NOT_READABLE", f"{role} input is not readable.", str(path))
    if markdown and path.suffix.lower() not in {".md", ".markdown"}:
        return None, error("INVALID_INPUT_FORMAT", f"{role} must be a Markdown file.", str(path))
    try:
        path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return None, error("INPUT_NOT_READABLE", f"{role} must be readable UTF-8 text.", str(path))
    return path, None


def _inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _destination_safe(root: Path, relative: str) -> dict[str, str] | None:
    lexical = root / relative
    if not _inside(lexical.absolute(), root):
        return error("DESTINATION_ESCAPES_PROJECT", "Destination escapes the project root.", relative)
    cursor = root
    for part in Path(relative).parts[:-1]:
        cursor = cursor / part
        if cursor.is_symlink():
            resolved = cursor.resolve(strict=False)
            if not _inside(resolved, root):
                return error("DESTINATION_ANCESTOR_ESCAPES_PROJECT", "A destination ancestor symlink escapes the project root.", str(cursor))
    return None


def _state_token(root: Path, destinations: list[str], sources: dict[str, Any]) -> str:
    state: dict[str, Any] = {"root": str(root), "destinations": {}}
    for relative in destinations:
        path = root / relative
        state["destinations"][relative] = {"exists": path.exists() or path.is_symlink(), "symlink": path.is_symlink()}
    for category in ("prd", "srs", "architecture"):
        item = sources.get(category)
        if item and item["mode"] == "preserve":
            state[f"source:{category}"] = item["sha256"]
    for category in ("handoffs", "contracts"):
        for item in sources[category]:
            state[f"{category}:{item['path']}"] = item["sha256"]
    return hashlib.sha256(json.dumps(state, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def preflight(project_root: str, prd: str | None, srs: str | None = None,
              architecture: str | None = None, handoffs: list[str] | None = None,
              contracts: list[str] | None = None) -> dict[str, Any]:
    root = Path(project_root).expanduser().resolve(strict=False)
    errors: list[dict[str, str]] = []
    if not root.exists() or not root.is_dir():
        return {"status": "blocked", "errors": [error("INVALID_PROJECT_ROOT", "Project root must be one existing directory.", str(root))], "mutated": False}
    if prd is None:
        return {"status": "blocked", "errors": [error("MISSING_PRD", "Exactly one explicit PRD is required.")], "project_root": str(root), "mutated": False}

    sources: dict[str, Any] = {"handoffs": [], "contracts": []}
    destinations = list(GENERATED)
    for role, raw in (("prd", prd), ("srs", srs), ("architecture", architecture)):
        if raw is None:
            sources[role] = None
            continue
        path, problem = validate_file(raw, role, True)
        if problem:
            errors.append(problem)
            continue
        assert path is not None
        canonical = root / PRIMARY[role]
        mode = "preserve" if path == canonical.resolve(strict=False) else "copy"
        sources[role] = {"path": str(path), "destination": PRIMARY[role], "mode": mode, "sha256": digest(path)}
        destinations.insert(0, PRIMARY[role])

    for category, values in (("handoffs", handoffs or []), ("contracts", contracts or [])):
        for raw in values:
            path, problem = validate_file(raw, category[:-1], False)
            if problem:
                errors.append(problem)
            else:
                assert path is not None
                sources[category].append({"path": str(path), "sha256": digest(path)})

    for relative in destinations:
        problem = _destination_safe(root, relative)
        if problem:
            errors.append(problem)
            continue
        path = root / relative
        permitted = any(item and item.get("destination") == relative and item.get("mode") == "preserve"
                        for item in (sources.get("prd"), sources.get("srs"), sources.get("architecture")))
        if (path.exists() or path.is_symlink()) and not permitted:
            errors.append(error("DESTINATION_CONFLICT", "An owned destination already exists.", relative))
    if errors:
        return {"status": "blocked", "project_root": str(root), "errors": errors, "mutated": False}
    token = _state_token(root, destinations, sources)
    return {"status": "ready", "project_root": str(root), "sources": sources,
            "destinations": destinations, "state_token": token, "mutated": False}


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser()
    value.add_argument("--project-root", default=".")
    value.add_argument("--prd")
    value.add_argument("--srs")
    value.add_argument("--architecture")
    value.add_argument("--handoff", action="append", default=[])
    value.add_argument("--contract", action="append", default=[])
    return value


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    result = preflight(args.project_root, args.prd, args.srs, args.architecture, args.handoff, args.contract)
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] == "ready" else 2


if __name__ == "__main__":
    raise SystemExit(main())
