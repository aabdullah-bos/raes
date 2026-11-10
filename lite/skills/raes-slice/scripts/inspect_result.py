#!/usr/bin/env python3
"""Capture and compare Stage 1 RAES repository state and validation evidence."""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from preflight import PreflightFailure, make_error, parse_pipeline, sha256_bytes, sha256_text


SCHEMA_VERSION = 1


class InspectionFailure(Exception):
    def __init__(self, errors: list[dict[str, Any]]):
        super().__init__(errors[0]["message"] if errors else "inspection failed")
        self.errors = errors


def _git(project_root: Path, *args: str, allow_failure: bool = False) -> subprocess.CompletedProcess[bytes]:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=project_root,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError as error:
        if allow_failure:
            return subprocess.CompletedProcess(["git", *args], 127, b"", str(error).encode())
        raise InspectionFailure(
            [
                make_error(
                    "GIT_COMMAND_FAILED",
                    f"Git command could not run: git {' '.join(args)}: {error}",
                    path=str(project_root),
                    fix="Restore access to Git when operating inside a Git working tree.",
                )
            ]
        ) from error
    if completed.returncode != 0 and not allow_failure:
        message = completed.stderr.decode("utf-8", errors="replace").strip()
        raise InspectionFailure(
            [
                make_error(
                    "GIT_COMMAND_FAILED",
                    f"Git command failed: git {' '.join(args)}: {message}",
                    path=str(project_root),
                    fix="Restore readable Git metadata or resolve the reported working-tree error.",
                )
            ]
        )
    return completed


def _parse_porcelain_v2_z(raw: bytes) -> list[dict[str, str]]:
    records = raw.decode("utf-8", errors="surrogateescape").split("\0")
    result: list[dict[str, str]] = []
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record:
            continue
        prefix = record[0]
        if prefix == "1":
            fields = record.split(" ", 8)
            if len(fields) == 9:
                result.append({"status": fields[1], "path": fields[8]})
        elif prefix == "2":
            fields = record.split(" ", 9)
            original = records[index] if index < len(records) else ""
            index += 1
            if len(fields) == 10:
                result.append({"status": fields[1], "path": fields[9], "original_path": original})
        elif prefix == "?":
            result.append({"status": "??", "path": record[2:]})
        elif prefix == "!":
            continue
    return sorted(result, key=lambda entry: (entry["path"], entry["status"]))


def _file_snapshot(project_root: Path) -> dict[str, dict[str, Any]]:
    files: dict[str, dict[str, Any]] = {}
    for path in sorted(project_root.rglob("*")):
        relative = path.relative_to(project_root)
        if ".git" in relative.parts:
            continue
        if path.is_symlink():
            target = os.readlink(path)
            files[relative.as_posix()] = {
                "kind": "symlink",
                "sha256": sha256_text(target),
                "mode": path.lstat().st_mode & 0o777,
            }
        elif path.is_file():
            files[relative.as_posix()] = {
                "kind": "file",
                "sha256": sha256_bytes(path.read_bytes()),
                "mode": path.stat().st_mode & 0o777,
            }
    return files


def _tracked_files(project_root: Path) -> list[str]:
    completed = _git(project_root, "ls-files", "-z", "--", ".")
    return sorted(
        item
        for item in completed.stdout.decode("utf-8", errors="surrogateescape").split("\0")
        if item
    )


def _repository_state(project_root: Path) -> dict[str, Any]:
    root = project_root.expanduser().resolve()
    git_root_result = _git(root, "rev-parse", "--show-toplevel", allow_failure=True)
    if git_root_result.returncode == 0:
        git_root = Path(git_root_result.stdout.decode().strip()).resolve()
        try:
            root.relative_to(git_root)
        except ValueError as error:
            raise InspectionFailure(
                [
                    make_error(
                        "PROJECT_OUTSIDE_GIT_ROOT",
                        "The selected project is outside the resolved Git working tree.",
                        path=str(root),
                    )
                ]
            ) from error

        head_result = _git(root, "rev-parse", "HEAD", allow_failure=True)
        git_head = head_result.stdout.decode().strip() if head_result.returncode == 0 else None
        status_result = _git(root, "status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ".")
        version_control = "git"
        git_root_value: str | None = str(git_root)
        tracked_files = _tracked_files(root)
        git_status = _parse_porcelain_v2_z(status_result.stdout)
    else:
        version_control = "none"
        git_root_value = None
        git_head = None
        tracked_files = []
        git_status = []

    state_without_fingerprint = {
        "version_control": version_control,
        "git_root": git_root_value,
        "git_head": git_head,
        "files": _file_snapshot(root),
        "tracked_files": tracked_files,
        "git_status": git_status,
    }
    fingerprint = sha256_text(json.dumps(state_without_fingerprint, sort_keys=True, separators=(",", ":")))
    return {**state_without_fingerprint, "fingerprint": fingerprint}


def capture_baseline(project_root: str | os.PathLike[str]) -> dict[str, Any]:
    root = Path(project_root).expanduser().resolve()
    try:
        repository = _repository_state(root)
    except InspectionFailure as failure:
        return {
            "schema_version": SCHEMA_VERSION,
            "status": "blocked",
            "project_root": str(root),
            "errors": failure.errors,
        }
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "baseline",
        "project_root": str(root),
        "repository": repository,
    }


def _classify_changes(
    baseline: dict[str, Any],
    final: dict[str, Any],
) -> dict[str, Any]:
    before_files: dict[str, dict[str, Any]] = baseline["files"]
    after_files: dict[str, dict[str, Any]] = final["files"]
    removed = set(before_files) - set(after_files)
    created = set(after_files) - set(before_files)
    modified = sorted(
        path
        for path in set(before_files) & set(after_files)
        if before_files[path] != after_files[path]
    )

    renamed: list[dict[str, str]] = []
    unmatched_created = set(created)
    unmatched_removed = set(removed)
    for old_path in sorted(removed):
        old_signature = (before_files[old_path]["kind"], before_files[old_path]["sha256"])
        match = next(
            (
                new_path
                for new_path in sorted(unmatched_created)
                if (after_files[new_path]["kind"], after_files[new_path]["sha256"]) == old_signature
            ),
            None,
        )
        if match is not None:
            renamed.append({"from": old_path, "to": match})
            unmatched_removed.remove(old_path)
            unmatched_created.remove(match)

    if final["version_control"] == "git":
        tracked_after = set(final["tracked_files"])
        added = sorted(path for path in unmatched_created if path in tracked_after)
        untracked = sorted(path for path in unmatched_created if path not in tracked_after)
    else:
        added = sorted(unmatched_created)
        untracked = []
    return {
        "modified": modified,
        "added": added,
        "deleted": sorted(unmatched_removed),
        "renamed": renamed,
        "untracked": untracked,
    }


def _changed_paths(changes: dict[str, Any]) -> set[str]:
    paths = set(changes["modified"]) | set(changes["added"]) | set(changes["deleted"]) | set(changes["untracked"])
    for rename in changes["renamed"]:
        paths.add(rename["from"])
        paths.add(rename["to"])
    return paths


def _matches_allowed(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def _normalize_validation(validation: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not isinstance(validation, list) or not validation:
        return [], [
            make_error(
                "VALIDATION_EVIDENCE_MISSING",
                "At least one required validation or explicit structural review check must be reported.",
                fix="Run every required check and provide command, source, exit code, result, and summarized output.",
            )
        ]

    normalized: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, raw in enumerate(validation):
        if not isinstance(raw, dict):
            errors.append(make_error("INVALID_VALIDATION_EVIDENCE", f"Validation entry {index + 1} is not an object."))
            continue
        command = raw.get("command")
        source = raw.get("source")
        exit_code = raw.get("exit_code")
        result = raw.get("result")
        output = raw.get("output", "")
        if not isinstance(command, str) or not command.strip() or not isinstance(source, str) or not source.strip():
            errors.append(
                make_error(
                    "INVALID_VALIDATION_EVIDENCE",
                    f"Validation entry {index + 1} requires non-empty command and source fields.",
                )
            )
            continue
        if exit_code is not None and (not isinstance(exit_code, int) or isinstance(exit_code, bool)):
            errors.append(make_error("INVALID_VALIDATION_EVIDENCE", f"Validation entry {index + 1} has an invalid exit code."))
            continue
        normalized_entry = {
            "command": command.strip(),
            "source": source.strip(),
            "exit_code": exit_code,
            "result": str(result or "").strip().lower(),
            "output": str(output)[-4000:],
        }
        normalized.append(normalized_entry)
        if exit_code is None or normalized_entry["result"] == "unavailable":
            errors.append(
                make_error(
                    "VALIDATION_UNAVAILABLE",
                    f"Required validation command is unavailable: {command}.",
                )
            )
        elif exit_code != 0 or normalized_entry["result"] not in {"passed", "success", "succeeded"}:
            errors.append(
                make_error(
                    "VALIDATION_FAILED",
                    f"Required validation did not pass: {command} (exit {exit_code}).",
                )
            )
    return normalized, errors


def _blocked_result(
    project_root: Path,
    slice_id: str | None,
    errors: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "blocked",
        "project_root": str(project_root),
        "slice_id": slice_id,
        "errors": errors,
    }


def inspect_result(
    project_root: str | os.PathLike[str],
    baseline: dict[str, Any],
    preflight: dict[str, Any],
    validation: Any,
    *,
    allowed_paths: list[str] | None = None,
    scope_decision: str = "unreviewed",
) -> dict[str, Any]:
    root = Path(project_root).expanduser().resolve()
    allowed = list(allowed_paths or [])
    slice_id = preflight.get("slice", {}).get("id") if isinstance(preflight, dict) else None
    if isinstance(preflight, dict):
        declared = preflight.get("slice", {}).get("fields", {}).get("allowed_paths", [])
        allowed.extend(pattern for pattern in declared if pattern not in allowed)

    if baseline.get("status") != "baseline" or baseline.get("project_root") != str(root):
        return _blocked_result(
            root,
            slice_id,
            [make_error("INVALID_BASELINE", "Baseline evidence is missing, blocked, or belongs to another project.")],
        )
    if preflight.get("status") != "ready" or preflight.get("project_root") != str(root):
        return _blocked_result(
            root,
            slice_id,
            [make_error("INVALID_PREFLIGHT_EVIDENCE", "Preflight evidence is missing, blocked, or belongs to another project.")],
        )
    if scope_decision not in {"unreviewed", "in_scope", "out_of_scope"}:
        return _blocked_result(
            root,
            slice_id,
            [make_error("INVALID_SCOPE_DECISION", "Scope decision must be unreviewed, in_scope, or out_of_scope.")],
        )

    try:
        final_repository = _repository_state(root)
    except InspectionFailure as failure:
        return _blocked_result(root, slice_id, failure.errors)

    changes = _classify_changes(baseline["repository"], final_repository)
    changed_paths = _changed_paths(changes)
    normalized_validation, validation_errors = _normalize_validation(validation)
    blocking_errors: list[dict[str, Any]] = []

    baseline_repository = baseline["repository"]
    if (
        baseline_repository.get("version_control") != final_repository.get("version_control")
        or baseline_repository.get("git_root") != final_repository.get("git_root")
    ):
        blocking_errors.append(
            make_error(
                "VERSION_CONTROL_CHANGED_DURING_SLICE",
                "Version-control context changed after the baseline was captured.",
                fix="Restore the baseline context and rerun validation and inspection.",
            )
        )

    pipeline_relative = preflight["pipeline"]["path"]
    pipeline_path = root / pipeline_relative
    pipeline_unchanged = False
    slice_unchanged = False
    current_pipeline_sha256: str | None = None
    try:
        current_pipeline = pipeline_path.read_text(encoding="utf-8")
        current_pipeline_sha256 = sha256_text(current_pipeline)
        pipeline_unchanged = current_pipeline_sha256 == preflight["pipeline"]["sha256"]
        parsed = parse_pipeline(current_pipeline, pipeline_relative)
        matching = [item for item in parsed.slices if item.id == slice_id]
        if len(matching) == 1:
            selected = matching[0]
            slice_unchanged = (
                not selected.checked
                and selected.identity_sha256 == preflight["slice"]["identity_sha256"]
            )
        if not slice_unchanged:
            blocking_errors.append(
                make_error(
                    "SELECTED_SLICE_CHANGED",
                    "The selected slice declaration, checkbox, type, label, or body changed before acceptance.",
                    path=pipeline_relative,
                )
            )
    except (OSError, UnicodeError) as error:
        blocking_errors.append(
            make_error("PIPELINE_NOT_READABLE_AFTER_SLICE", f"Pipeline could not be reread: {error}", path=pipeline_relative)
        )
    except PreflightFailure as failure:
        blocking_errors.extend(failure.errors)

    if not pipeline_unchanged:
        blocking_errors.append(
            make_error(
                "PIPELINE_CHANGED_BEFORE_ACCEPTANCE",
                "The pipeline changed before explicit acceptance.",
                path=pipeline_relative,
            )
        )

    if preflight["slice"]["type"] == "review":
        decisions_path = preflight["artifacts"].get("durable_decisions")
        review_permitted = [*allowed, *([decisions_path] if decisions_path else [])]
        for path in sorted(changed_paths):
            if path == pipeline_relative or _matches_allowed(path, review_permitted):
                continue
            blocking_errors.append(
                make_error(
                    "REVIEW_SLICE_CHANGED_UNPERMITTED_PATH",
                    "A review slice may change only the decision log and the paths in its allowed_paths line.",
                    path=path,
                    fix="Revert the change, or move anything the slice created outside the repository.",
                )
            )

    artifact_paths = set(preflight["artifacts"].values())
    raes_artifact_changes = sorted(changed_paths & artifact_paths)
    unexplained = sorted(path for path in changed_paths if not _matches_allowed(path, allowed))
    warnings: list[dict[str, Any]] = []
    for path in unexplained:
        warnings.append(
            {
                "code": "UNEXPLAINED_CHANGE",
                "message": "Changed path is not covered by the supplied expected-path patterns and requires semantic review.",
                "path": path,
            }
        )
    for path in raes_artifact_changes:
        if path != pipeline_relative:
            warnings.append(
                {
                    "code": "RAES_ARTIFACT_CHANGED",
                    "message": "An authoritative RAES artifact changed and requires role/scope review.",
                    "path": path,
                }
            )

    errors = [*blocking_errors, *validation_errors]
    if scope_decision == "out_of_scope":
        errors.append(
            make_error(
                "SCOPE_REVIEW_FAILED",
                "The scope review determined that repository changes do not remain within the selected slice scope.",
            )
        )

    if blocking_errors or scope_decision == "out_of_scope":
        status = "blocked"
    elif validation_errors:
        status = "implemented_but_not_validated"
    elif scope_decision == "in_scope":
        status = "validated"
    else:
        status = "ready_for_review"

    return {
        "schema_version": SCHEMA_VERSION,
        "status": status,
        "project_root": str(root),
        "slice_id": preflight["slice"]["id"],
        "slice_type": preflight["slice"]["type"],
        "slice_label": preflight["slice"]["label"],
        "slice_identity_sha256": preflight["slice"]["identity_sha256"],
        "changes": changes,
        "pre_existing_conditions": baseline["repository"]["git_status"],
        "validation": normalized_validation,
        "validation_complete": not validation_errors,
        "pipeline_path": pipeline_relative,
        "pipeline_sha256": current_pipeline_sha256,
        "validated_pipeline_sha256": preflight["pipeline"]["sha256"],
        "pipeline_unchanged": pipeline_unchanged,
        "slice_unchanged": slice_unchanged,
        "raes_artifact_changes": raes_artifact_changes,
        "scope_review": {
            "requires_human_judgment": True,
            "deterministically_proven": False,
            "decision": scope_decision,
            "allowed_path_patterns": allowed,
            "warnings": warnings,
        },
        "baseline_fingerprint": baseline["repository"]["fingerprint"],
        "repository_fingerprint": final_repository["fingerprint"],
        "version_control": final_repository["version_control"],
        "git_head": final_repository["git_head"],
        "blocking_errors": blocking_errors,
        "errors": errors,
    }


def _load_json(path: str) -> Any:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise InspectionFailure(
            [make_error("INVALID_JSON_INPUT", f"Could not read JSON evidence from {path}: {error}", path=path)]
        ) from error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Capture or inspect Stage 1 RAES repository state.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    baseline = subparsers.add_parser("baseline", help="Capture session-bound repository baseline JSON.")
    baseline.add_argument("--project-root", default=".")

    inspect = subparsers.add_parser("inspect", help="Compare final state with baseline and validation evidence.")
    inspect.add_argument("--project-root", default=".")
    inspect.add_argument("--baseline-json", required=True)
    inspect.add_argument("--preflight-json", required=True)
    inspect.add_argument("--validation-json", required=True)
    inspect.add_argument("--allowed-path", action="append", default=[])
    inspect.add_argument(
        "--scope-decision",
        choices=("unreviewed", "in_scope", "out_of_scope"),
        default="unreviewed",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "baseline":
        result = capture_baseline(args.project_root)
    else:
        try:
            result = inspect_result(
                args.project_root,
                _load_json(args.baseline_json),
                _load_json(args.preflight_json),
                _load_json(args.validation_json),
                allowed_paths=args.allowed_path,
                scope_decision=args.scope_decision,
            )
        except InspectionFailure as failure:
            result = {"schema_version": SCHEMA_VERSION, "status": "blocked", "errors": failure.errors}

    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] in {"baseline", "ready_for_review", "validated"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
