#!/usr/bin/env python3
"""Atomically accept exactly one validated Stage 1 RAES slice."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable

from inspect_result import SCHEMA_VERSION, InspectionFailure, _repository_state
from preflight import PreflightFailure, make_error, parse_pipeline, sha256_text


ReplaceFunction = Callable[[str | os.PathLike[str], str | os.PathLike[str]], None]


def _blocked(
    project_root: Path,
    slice_id: str,
    errors: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "blocked",
        "project_root": str(project_root),
        "slice_id": slice_id,
        "errors": errors,
    }


def accept_slice(
    project_root: str | os.PathLike[str],
    evidence: dict[str, Any],
    slice_id: str,
    *,
    replace_fn: ReplaceFunction = os.replace,
) -> dict[str, Any]:
    root = Path(project_root).expanduser().resolve()
    if evidence.get("status") != "validated":
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "EVIDENCE_NOT_VALIDATED",
                    "Acceptance requires session-bound evidence with status 'validated'.",
                    fix="Complete validation and semantic scope review before requesting acceptance.",
                )
            ],
        )
    if evidence.get("project_root") != str(root):
        return _blocked(
            root,
            slice_id,
            [make_error("EVIDENCE_PROJECT_MISMATCH", "Validation evidence belongs to a different project root.")],
        )
    if evidence.get("slice_id") != slice_id:
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "EVIDENCE_SLICE_MISMATCH",
                    "The explicitly accepted slice does not match the validated slice.",
                )
            ],
        )
    if not evidence.get("validation_complete") or evidence.get("blocking_errors"):
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "EVIDENCE_NOT_VALIDATED",
                    "Validation evidence is incomplete or contains blocking errors.",
                )
            ],
        )
    scope_review = evidence.get("scope_review")
    if not isinstance(scope_review, dict) or scope_review.get("decision") != "in_scope":
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "SCOPE_NOT_CONFIRMED",
                    "Acceptance requires an explicit scope review decision of 'in_scope'.",
                )
            ],
        )

    pipeline_relative = evidence.get("pipeline_path")
    if not isinstance(pipeline_relative, str) or not pipeline_relative:
        return _blocked(root, slice_id, [make_error("INVALID_ACCEPTANCE_EVIDENCE", "Pipeline path is missing from evidence.")])
    pipeline_path = (root / pipeline_relative).resolve()
    try:
        pipeline_path.relative_to(root)
    except ValueError:
        return _blocked(
            root,
            slice_id,
            [make_error("PIPELINE_PATH_ESCAPES_PROJECT", "Validated pipeline path escapes the project root.", path=pipeline_relative)],
        )

    try:
        current_bytes = pipeline_path.read_bytes()
        current_text = current_bytes.decode("utf-8")
    except (OSError, UnicodeError) as error:
        return _blocked(
            root,
            slice_id,
            [make_error("PIPELINE_NOT_READABLE", f"Pipeline could not be reread as UTF-8: {error}", path=pipeline_relative)],
        )

    try:
        parsed = parse_pipeline(current_text, pipeline_relative)
    except PreflightFailure as failure:
        return _blocked(root, slice_id, failure.errors)

    matching = [item for item in parsed.slices if item.id == slice_id]
    if not matching:
        return _blocked(
            root,
            slice_id,
            [make_error("TARGET_SLICE_NOT_FOUND", "The validated slice ID no longer exists.", path=pipeline_relative)],
        )
    target = matching[0]
    if target.checked:
        return _blocked(
            root,
            slice_id,
            [make_error("TARGET_ALREADY_ACCEPTED", "The target slice is already accepted.", path=pipeline_relative, line=target.line)],
        )
    if parsed.first_unchecked is None or parsed.first_unchecked.id != slice_id:
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "TARGET_NOT_FIRST_UNCHECKED",
                    "The validated slice is no longer the first unchecked slice.",
                    path=pipeline_relative,
                    line=target.line,
                )
            ],
        )
    if target.identity_sha256 != evidence.get("slice_identity_sha256"):
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "VALIDATED_SLICE_CHANGED",
                    "The target slice type, label, declaration, or body changed after validation.",
                    path=pipeline_relative,
                    line=target.line,
                )
            ],
        )

    current_pipeline_sha256 = sha256_text(current_text)
    if (
        current_pipeline_sha256 != evidence.get("pipeline_sha256")
        or current_pipeline_sha256 != evidence.get("validated_pipeline_sha256")
    ):
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "VALIDATION_STATE_STALE",
                    "Pipeline state changed after validation. Revalidation is required.",
                    path=pipeline_relative,
                )
            ],
        )

    try:
        repository = _repository_state(root)
    except InspectionFailure as failure:
        return _blocked(root, slice_id, failure.errors)
    if repository["fingerprint"] != evidence.get("repository_fingerprint"):
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "VALIDATION_STATE_STALE",
                    "Repository state changed after validation. Revalidation is required.",
                )
            ],
        )

    # Narrow the final race window by rereading the pipeline after the repository snapshot.
    try:
        if pipeline_path.read_bytes() != current_bytes:
            return _blocked(
                root,
                slice_id,
                [
                    make_error(
                        "VALIDATION_STATE_STALE",
                        "Pipeline state changed during acceptance verification. Revalidation is required.",
                        path=pipeline_relative,
                    )
                ],
            )
    except OSError as error:
        return _blocked(
            root,
            slice_id,
            [make_error("PIPELINE_NOT_READABLE", f"Pipeline could not be reread: {error}", path=pipeline_relative)],
        )

    lines = current_text.splitlines(keepends=True)
    line_index = target.line - 1
    if line_index >= len(lines):
        return _blocked(
            root,
            slice_id,
            [make_error("TARGET_DECLARATION_STALE", "The validated declaration line no longer exists.", path=pipeline_relative)],
        )
    original_line = lines[line_index]
    newline = ""
    declaration = original_line
    if original_line.endswith("\r\n"):
        declaration, newline = original_line[:-2], "\r\n"
    elif original_line.endswith("\n"):
        declaration, newline = original_line[:-1], "\n"
    if declaration != target.declaration or not declaration.startswith("- [ ] "):
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "TARGET_DECLARATION_STALE",
                    "The exact target declaration no longer matches validated state.",
                    path=pipeline_relative,
                    line=target.line,
                )
            ],
        )
    lines[line_index] = declaration.replace("- [ ] ", "- [x] ", 1) + newline
    updated_text = "".join(lines)

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            prefix=".raes-accept-",
            dir=pipeline_path.parent,
            delete=False,
        ) as temporary:
            temp_path = Path(temporary.name)
            temporary.write(updated_text)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.chmod(temp_path, pipeline_path.stat().st_mode & 0o777)
        replace_fn(temp_path, pipeline_path)
        temp_path = None
        try:
            directory_fd = os.open(pipeline_path.parent, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        except OSError:
            # The atomic rename has already succeeded; directory fsync is not
            # supported consistently across all Stage 1 development systems.
            pass
    except OSError as error:
        if temp_path is not None:
            try:
                temp_path.unlink()
            except FileNotFoundError:
                pass
        return _blocked(
            root,
            slice_id,
            [
                make_error(
                    "ATOMIC_WRITE_FAILED",
                    f"Atomic pipeline update failed: {error}",
                    path=pipeline_relative,
                    fix="Resolve the filesystem error and revalidate before accepting.",
                )
            ],
        )
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink()
            except FileNotFoundError:
                pass

    return {
        "schema_version": SCHEMA_VERSION,
        "status": "accepted",
        "project_root": str(root),
        "slice_id": slice_id,
        "pipeline_path": pipeline_relative,
        "pipeline_sha256": sha256_text(updated_text),
    }


def _load_evidence(path: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read validation evidence from {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError("Validation evidence must be a JSON object.")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Atomically accept one explicitly approved Stage 1 RAES slice.")
    parser.add_argument("--project-root", default=".")
    parser.add_argument("--evidence-json", required=True)
    parser.add_argument("--slice-id", required=True, help="Exact slice ID explicitly accepted by the user.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        evidence = _load_evidence(args.evidence_json)
        result = accept_slice(args.project_root, evidence, args.slice_id)
    except ValueError as error:
        result = {
            "schema_version": SCHEMA_VERSION,
            "status": "blocked",
            "slice_id": args.slice_id,
            "errors": [make_error("INVALID_ACCEPTANCE_EVIDENCE", str(error), path=args.evidence_json)],
        }
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] == "accepted" else 2


if __name__ == "__main__":
    raise SystemExit(main())
