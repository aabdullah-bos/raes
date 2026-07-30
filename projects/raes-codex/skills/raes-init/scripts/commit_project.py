#!/usr/bin/env python3
"""Rollback-backed create-or-fail installation of a validated RAES candidate."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

from preflight import _state_token, digest


def commit(manifest_path: str | Path, fail_after: int | None = None) -> dict[str, Any]:
    manifest_file = Path(manifest_path).resolve()
    manifest = json.loads(manifest_file.read_text())
    stage = Path(manifest["staging_root"]).resolve()
    root = Path(manifest["project_root"]).resolve()
    created: list[Path] = []
    rollback_errors: list[str] = []
    cleanup_error: str | None = None
    if manifest.get("validation", {}).get("status") != "valid":
        return {"status": "blocked", "code": "CANDIDATE_NOT_VALIDATED", "created": []}
    if _state_token(root, manifest["destinations"], manifest["sources"]) != manifest["state_token"]:
        return {"status": "blocked", "code": "STALE_PREFLIGHT_STATE", "created": []}
    for category in ("prd", "srs", "architecture"):
        item = manifest["sources"].get(category)
        if item and digest(Path(item["path"])) != item["sha256"]:
            return {"status": "blocked", "code": "STALE_SOURCE", "path": item["path"], "created": []}
    for category in ("handoffs", "contracts"):
        for item in manifest["sources"][category]:
            if digest(Path(item["path"])) != item["sha256"]:
                return {"status": "blocked", "code": "STALE_SUPPORTING_INPUT", "path": item["path"], "created": []}
    try:
        for index, relative in enumerate(manifest["destinations"], 1):
            item = next((value for value in (manifest["sources"].get("prd"), manifest["sources"].get("srs"), manifest["sources"].get("architecture"))
                         if value and value["destination"] == relative), None)
            if item and item["mode"] == "preserve":
                continue
            destination = root / relative
            if destination.exists() or destination.is_symlink():
                raise FileExistsError(relative)
            if not destination.parent.exists():
                destination.parent.mkdir(mode=0o755)
                created.append(destination.parent)
            source = stage / relative
            descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
            with os.fdopen(descriptor, "wb") as output:
                output.write(source.read_bytes())
            created.append(destination)
            if fail_after is not None and index >= fail_after:
                raise OSError("injected installation failure")
    except Exception as exc:
        for path in reversed(created):
            try:
                if path.is_dir():
                    path.rmdir()
                else:
                    path.unlink()
            except OSError as rollback:
                rollback_errors.append(f"{path}: {rollback}")
        result = {"status": "blocked", "code": "ROLLBACK_FAILED" if rollback_errors else "INSTALL_FAILED",
                  "message": str(exc), "created": [str(value) for value in created],
                  "rollback_complete": not rollback_errors, "rollback_errors": rollback_errors}
    else:
        result = {"status": "committed", "created": [str(value) for value in created if value.is_file()],
                  "rollback_complete": True}
    try:
        shutil.rmtree(stage)
    except OSError as exc:
        cleanup_error = f"{stage}: {exc}"
    result["cleanup_error"] = cleanup_error
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--fail-after", type=int, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    result = commit(args.manifest, args.fail_after)
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] == "committed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
