#!/usr/bin/env python3
"""Deterministic Stage 1 RAES project and pipeline preflight."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import stat
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REQUIRED_SOURCES = (
    "build_intent",
    "system_constraints",
    "next_slice",
    "durable_decisions",
    "execution_guidance",
    "validation",
)
LITE_SOURCES = {
    "agents": "AGENTS.md",
    "next_slice": "docs/pipeline.md",
    "durable_decisions": "docs/decisions.md",
}
SLICE_FIELDS = ("scope", "out_of_scope", "question", "experiment", "allowed_paths")
SLICE_FIELD_PATTERN = re.compile(r"^\s+-\s+(" + "|".join(SLICE_FIELDS) + r"):\s*(.*?)\s*$")
SUPPORTED_CONTRACT_VERSION = "1.0"
KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")
SLICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SLICE_DECLARATION_PATTERN = re.compile(r"^- \[([ xX])\]\s+([^|]*)\|([^|]*)\|(.*)$")
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


@dataclass(frozen=True)
class PipelineSlice:
    id: str
    type: str
    label: str
    checked: bool
    declaration: str
    body_markdown: str
    line: int

    @property
    def identity_sha256(self) -> str:
        payload = {
            "id": self.id,
            "type": self.type,
            "label": self.label,
            "declaration": self.declaration,
            "body_markdown": self.body_markdown,
        }
        return sha256_text(json.dumps(payload, sort_keys=True, separators=(",", ":")))


@dataclass(frozen=True)
class ParsedPipeline:
    slices: tuple[PipelineSlice, ...]
    first_unchecked: PipelineSlice | None


class PreflightFailure(Exception):
    def __init__(self, errors: list[dict[str, Any]]):
        super().__init__(errors[0]["message"] if errors else "preflight failed")
        self.errors = errors


def make_error(
    code: str,
    message: str,
    *,
    path: str | None = None,
    line: int | None = None,
    fix: str | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if path is not None:
        error["path"] = path
    if line is not None:
        error["line"] = line
    if fix is not None:
        error["fix"] = fix
    return error


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_text(content: str) -> str:
    return sha256_bytes(content.encode("utf-8"))


def read_regular_file(path: Path, display_path: str, role: str) -> tuple[str | None, dict[str, Any] | None]:
    if not path.exists():
        return None, make_error(
            "MISSING_ARTIFACT",
            f"Required artifact for {role} does not exist.",
            path=display_path,
            fix="Create the required artifact or correct its configured path.",
        )
    if not path.is_file():
        return None, make_error(
            "ARTIFACT_NOT_REGULAR_FILE",
            f"Required artifact for {role} is not a regular file.",
            path=display_path,
            fix="Point the source role to a regular readable file.",
        )
    mode = path.stat().st_mode
    if mode & (stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH) == 0 or not os.access(path, os.R_OK):
        return None, make_error(
            "ARTIFACT_NOT_READABLE",
            f"Required artifact for {role} is not readable.",
            path=display_path,
            fix="Restore read permission or point the source role to a readable file.",
        )
    try:
        return path.read_text(encoding="utf-8"), None
    except (OSError, UnicodeError) as error:
        return None, make_error(
            "ARTIFACT_NOT_READABLE",
            f"Required artifact for {role} could not be read as UTF-8: {error}",
            path=display_path,
            fix="Provide a readable UTF-8 text artifact.",
        )


def _parse_scalar(raw: str, line_number: int) -> Any:
    value = raw.strip()
    if value.startswith(("'", '"')):
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError) as error:
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", f"Invalid quoted value: {error}", path="raes.config.yaml", line=line_number)]
            ) from error
        if not isinstance(parsed, str):
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", "Only string scalar values are supported.", path="raes.config.yaml", line=line_number)]
            )
        return parsed
    if " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    if not value or value.startswith(("[", "{", "&", "*", "!", "|", ">")):
        raise PreflightFailure(
            [
                make_error(
                    "MALFORMED_CONFIG",
                    "Unsupported or empty scalar value in the Stage 1 config subset.",
                    path="raes.config.yaml",
                    line=line_number,
                )
            ]
        )
    if re.fullmatch(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)", value):
        return float(value)
    return value


def parse_config(text: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-2, root)]

    for line_number, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", "Tabs are not supported for indentation.", path="raes.config.yaml", line=line_number)]
            )
        indent = len(raw) - len(raw.lstrip(" "))
        if indent % 2 != 0:
            raise PreflightFailure(
                [
                    make_error(
                        "MALFORMED_CONFIG",
                        "Indentation must use two-space levels.",
                        path="raes.config.yaml",
                        line=line_number,
                    )
                ]
            )
        content = raw.strip()
        if ":" not in content:
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", "Expected a 'key: value' mapping entry.", path="raes.config.yaml", line=line_number)]
            )
        key, raw_value = content.split(":", 1)
        key = key.strip()
        if not KEY_PATTERN.fullmatch(key):
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", f"Unsupported mapping key: {key!r}.", path="raes.config.yaml", line=line_number)]
            )

        while stack and indent <= stack[-1][0]:
            stack.pop()
        if not stack or indent != stack[-1][0] + 2:
            raise PreflightFailure(
                [
                    make_error(
                        "MALFORMED_CONFIG",
                        "Unexpected indentation in configuration mapping.",
                        path="raes.config.yaml",
                        line=line_number,
                    )
                ]
            )
        parent = stack[-1][1]
        if key in parent:
            raise PreflightFailure(
                [make_error("MALFORMED_CONFIG", f"Duplicate configuration key: {key}.", path="raes.config.yaml", line=line_number)]
            )
        if raw_value.strip() == "":
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            parent[key] = _parse_scalar(raw_value, line_number)

    return root


def _mapping(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PreflightFailure(
            [
                make_error(
                    "INVALID_CONFIG_SCHEMA",
                    f"Required configuration field '{field}' must be a mapping.",
                    path="raes.config.yaml",
                )
            ]
        )
    return value


def _string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise PreflightFailure(
            [
                make_error(
                    "INVALID_CONFIG_SCHEMA",
                    f"Required configuration field '{field}' must be a non-empty string.",
                    path="raes.config.yaml",
                )
            ]
        )
    return value.strip()


def extract_source_paths(config: dict[str, Any]) -> dict[str, str]:
    project = _mapping(config.get("project"), "project")
    _string(project.get("name"), "project.name")
    sources = _mapping(config.get("sources"), "sources")

    paths: dict[str, str] = {}
    for role in ("build_intent", "system_constraints", "durable_decisions", "execution_guidance", "validation"):
        paths[role] = _string(sources.get(role), f"sources.{role}")

    next_slice = _mapping(sources.get("next_slice"), "sources.next_slice")
    paths["next_slice"] = _string(next_slice.get("path"), "sources.next_slice.path")
    selection_rule = next_slice.get("selection_rule")
    if selection_rule is not None and _string(selection_rule, "sources.next_slice.selection_rule") != "first_unchecked_slice":
        raise PreflightFailure(
            [
                make_error(
                    "UNSUPPORTED_SELECTION_RULE",
                    "Stage 1 supports only 'first_unchecked_slice'.",
                    path="raes.config.yaml",
                )
            ]
        )
    return paths


def extract_contract_version(config: dict[str, Any]) -> str:
    raes = _mapping(config.get("raes"), "raes")
    version = raes.get("contract_version")
    if not isinstance(version, str) or not version.strip():
        raise PreflightFailure([make_error(
            "MISSING_OR_MALFORMED_CONTRACT_VERSION",
            f"RAES contract version must be the string {SUPPORTED_CONTRACT_VERSION!r}.",
            path="raes.config.yaml",
        )])
    version = version.strip()
    if version != SUPPORTED_CONTRACT_VERSION:
        problem = make_error(
            "UNSUPPORTED_CONTRACT_VERSION",
            f"Declared RAES contract version {version!r} is unsupported; this executor supports {SUPPORTED_CONTRACT_VERSION!r}.",
            path="raes.config.yaml",
        )
        problem["declared_contract_version"] = version
        problem["supported_contract_version"] = SUPPORTED_CONTRACT_VERSION
        raise PreflightFailure([problem])
    return version


def resolve_artifacts(
    project_root: Path,
    configured_paths: dict[str, str],
    roles: tuple[str, ...] = REQUIRED_SOURCES,
) -> tuple[dict[str, str], dict[str, Path], dict[str, str]]:
    display_paths: dict[str, str] = {}
    resolved_paths: dict[str, Path] = {}
    contents: dict[str, str] = {}
    errors: list[dict[str, Any]] = []

    for role in roles:
        configured = configured_paths[role]
        candidate = Path(configured)
        resolved = (candidate if candidate.is_absolute() else project_root / candidate).resolve()
        try:
            relative = resolved.relative_to(project_root)
        except ValueError:
            errors.append(
                make_error(
                    "ARTIFACT_PATH_ESCAPES_PROJECT",
                    f"Required artifact path for {role} escapes the supported project root.",
                    path=configured,
                    fix="Use a path that resolves inside the explicitly selected project root.",
                )
            )
            continue

        display = relative.as_posix()
        content, error = read_regular_file(resolved, display, role)
        if error is not None:
            errors.append(error)
            continue
        display_paths[role] = display
        resolved_paths[role] = resolved
        contents[role] = content if content is not None else ""

    if errors:
        raise PreflightFailure(errors)
    return display_paths, resolved_paths, contents


def parse_pipeline(content: str, path: str = "docs/pipeline.md") -> ParsedPipeline:
    lines = content.splitlines()
    backlog_lines = [index for index, line in enumerate(lines) if line == "## Slice Backlog"]
    if not backlog_lines:
        raise PreflightFailure(
            [
                make_error(
                    "MISSING_SLICE_BACKLOG",
                    "The pipeline must contain exactly one zero-indented '## Slice Backlog' heading.",
                    path=path,
                )
            ]
        )
    if len(backlog_lines) != 1:
        raise PreflightFailure(
            [
                make_error(
                    "AMBIGUOUS_SLICE_BACKLOG",
                    "The pipeline contains more than one '## Slice Backlog' heading.",
                    path=path,
                    line=backlog_lines[1] + 1,
                )
            ]
        )

    slices: list[PipelineSlice] = []
    ids: dict[str, int] = {}
    current: dict[str, Any] | None = None

    def finish_current() -> None:
        nonlocal current
        if current is None:
            return
        slices.append(
            PipelineSlice(
                id=current["id"],
                type=current["type"],
                label=current["label"],
                checked=current["checked"],
                declaration=current["declaration"],
                body_markdown="\n".join(current["body_lines"]),
                line=current["line"],
            )
        )
        current = None

    for index in range(backlog_lines[0] + 1, len(lines)):
        raw = lines[index]
        line_number = index + 1

        if raw == "## Handoff Notes":
            finish_current()
            break

        heading = HEADING_PATTERN.fullmatch(raw)
        if heading:
            code = "UNSUPPORTED_MILESTONE_HEADING" if len(heading.group(1)) >= 3 else "UNSUPPORTED_BACKLOG_HEADING"
            message = (
                "Milestone headings inside ## Slice Backlog are not supported in Stage 1."
                if code == "UNSUPPORTED_MILESTONE_HEADING"
                else "Only the '## Handoff Notes' heading may terminate the Stage 1 backlog."
            )
            raise PreflightFailure([make_error(code, message, path=path, line=line_number)])

        if raw.startswith("- ["):
            match = SLICE_DECLARATION_PATTERN.fullmatch(raw)
            if match is None:
                raise PreflightFailure(
                    [
                        make_error(
                            "MALFORMED_SLICE_DECLARATION",
                            "Top-level slices must use '- [ ] <stable-id> | <execution|review> | <label>'.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )

            marker, raw_id, raw_type, raw_label = match.groups()
            if marker == "X":
                raise PreflightFailure(
                    [
                        make_error(
                            "UNSUPPORTED_CHECKBOX_MARKER",
                            "Uppercase '[X]' is not supported; use lowercase '[x]' for accepted slices.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )
            slice_id = raw_id.strip()
            slice_type = raw_type.strip()
            label = raw_label.strip()
            if not slice_id:
                raise PreflightFailure(
                    [make_error("MISSING_SLICE_ID", "A stable slice ID is required.", path=path, line=line_number)]
                )
            if not SLICE_ID_PATTERN.fullmatch(slice_id):
                raise PreflightFailure(
                    [
                        make_error(
                            "INVALID_SLICE_ID",
                            "Slice IDs may contain letters, digits, '.', '_', and '-' and must start with a letter or digit.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )
            if slice_type not in {"execution", "review"}:
                raise PreflightFailure(
                    [
                        make_error(
                            "UNSUPPORTED_SLICE_TYPE",
                            "Slice type must be exactly 'execution' or 'review'.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )
            if not label:
                raise PreflightFailure(
                    [make_error("MISSING_SLICE_LABEL", "A non-empty slice label is required.", path=path, line=line_number)]
                )
            if slice_id in ids:
                raise PreflightFailure(
                    [
                        make_error(
                            "DUPLICATE_SLICE_ID",
                            f"Slice ID '{slice_id}' duplicates the declaration on line {ids[slice_id]}.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )

            finish_current()
            ids[slice_id] = line_number
            current = {
                "id": slice_id,
                "type": slice_type,
                "label": label,
                "checked": marker == "x",
                "declaration": raw,
                "body_lines": [],
                "line": line_number,
            }
            continue

        if raw == "":
            if current is not None:
                current["body_lines"].append(raw)
            continue

        if raw[0].isspace():
            if current is None:
                raise PreflightFailure(
                    [
                        make_error(
                            "ORPHAN_SLICE_BODY",
                            "Indented backlog content must follow a top-level slice declaration.",
                            path=path,
                            line=line_number,
                        )
                    ]
                )
            current["body_lines"].append(raw)
            continue

        code = "MALFORMED_SLICE_DECLARATION" if raw.startswith("- ") else "UNSUPPORTED_BACKLOG_CONTENT"
        message = (
            "Zero-indented backlog bullets must use the Stage 1 slice declaration grammar."
            if code == "MALFORMED_SLICE_DECLARATION"
            else "Zero-indented content inside ## Slice Backlog is unsupported in Stage 1."
        )
        raise PreflightFailure([make_error(code, message, path=path, line=line_number)])

    else:
        finish_current()

    if not slices:
        raise PreflightFailure(
            [
                make_error(
                    "NO_SLICES",
                    "The Stage 1 backlog contains no top-level slice declarations.",
                    path=path,
                )
            ]
        )

    first_unchecked = next((item for item in slices if not item.checked), None)
    return ParsedPipeline(tuple(slices), first_unchecked)


def _normalize_allowed_path(raw: str) -> str:
    return raw.strip().strip("`").strip()


def parse_slice_fields(item: PipelineSlice, path: str = "docs/pipeline.md") -> dict[str, Any]:
    """Read the optional scope, out_of_scope, question, experiment and allowed_paths body lines."""
    fields: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []
    for offset, raw in enumerate(item.body_markdown.splitlines(), start=1):
        match = SLICE_FIELD_PATTERN.fullmatch(raw)
        if match is None:
            continue
        name, value = match.group(1), match.group(2)
        line_number = item.line + offset
        if name in fields:
            errors.append(
                make_error(
                    "DUPLICATE_SLICE_FIELD",
                    f"Slice '{item.id}' declares '{name}:' more than once.",
                    path=path,
                    line=line_number,
                )
            )
            continue
        if name != "allowed_paths":
            fields[name] = value
            continue
        patterns = [_normalize_allowed_path(part) for part in value.split(",")]
        if not value.strip() or any(not pattern for pattern in patterns):
            errors.append(
                make_error(
                    "INVALID_ALLOWED_PATHS",
                    "allowed_paths must be a comma-separated list of non-empty path globs.",
                    path=path,
                    line=line_number,
                )
            )
            continue
        unsafe = [pattern for pattern in patterns if pattern.startswith("/") or ".." in Path(pattern).parts]
        if unsafe:
            errors.append(
                make_error(
                    "ALLOWED_PATH_ESCAPES_PROJECT",
                    "allowed_paths globs must be relative to the project root and must not contain '..'.",
                    path=path,
                    line=line_number,
                )
            )
            continue
        fields[name] = patterns
    if errors:
        raise PreflightFailure(errors)
    return fields


def _blocked(errors: list[dict[str, Any]], project_root: Path | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "status": "blocked",
        "errors": errors,
        "supported_contract_version": SUPPORTED_CONTRACT_VERSION,
    }
    if project_root is not None:
        result["project_root"] = str(project_root)
    return result


def preflight_project(project_root: str | os.PathLike[str]) -> dict[str, Any]:
    root = Path(project_root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        return _blocked(
            [
                make_error(
                    "INVALID_PROJECT_ROOT",
                    "The explicitly selected project root is not a directory.",
                    path=str(root),
                    fix="Open or supply exactly one existing RAES project root.",
                )
            ],
            root,
        )

    config_path = root / "raes.config.yaml"
    layout = "config"
    contract_version: str | None = None
    if not config_path.exists():
        if not (root / LITE_SOURCES["agents"]).exists():
            return _blocked(
                [
                    make_error(
                        "MISSING_CONFIG",
                        "raes.config.yaml (full layout) or AGENTS.md (lite layout) is required at the selected project root.",
                        path="raes.config.yaml",
                        fix="Select a RAES project with a root config file, or a lite project with AGENTS.md, docs/pipeline.md and docs/decisions.md.",
                    )
                ],
                root,
            )
        layout = "lite"
        try:
            artifacts, resolved_artifacts, contents = resolve_artifacts(root, dict(LITE_SOURCES), tuple(LITE_SOURCES))
            parsed = parse_pipeline(contents["next_slice"], artifacts["next_slice"])
        except PreflightFailure as failure:
            return _blocked(failure.errors, root)
    else:
        config_text, config_error = read_regular_file(config_path, "raes.config.yaml", "config")
        if config_error is not None:
            config_error["code"] = "CONFIG_NOT_READABLE"
            return _blocked([config_error], root)

        try:
            config = parse_config(config_text or "")
            contract_version = extract_contract_version(config)
            configured_paths = extract_source_paths(config)
            artifacts, resolved_artifacts, contents = resolve_artifacts(root, configured_paths)
            parsed = parse_pipeline(contents["next_slice"], artifacts["next_slice"])
        except PreflightFailure as failure:
            return _blocked(failure.errors, root)

    selected = parsed.first_unchecked
    if selected is None:
        return _blocked(
            [
                make_error(
                    "NO_UNCHECKED_SLICE",
                    "The supported backlog contains no unchecked slice.",
                    path=artifacts["next_slice"],
                )
            ],
            root,
        )

    try:
        fields = parse_slice_fields(selected, artifacts["next_slice"])
    except PreflightFailure as failure:
        return _blocked(failure.errors, root)

    pipeline_content = contents["next_slice"]
    return {
        "status": "ready",
        "layout": layout,
        "project_root": str(root),
        "config_path": str(config_path) if layout == "config" else None,
        "contract_version": contract_version,
        "supported_contract_version": SUPPORTED_CONTRACT_VERSION,
        "artifacts": artifacts,
        "artifact_paths": {role: str(path) for role, path in resolved_artifacts.items()},
        "pipeline": {
            "path": artifacts["next_slice"],
            "sha256": sha256_text(pipeline_content),
            "slice_count": len(parsed.slices),
            "accepted_count": sum(1 for item in parsed.slices if item.checked),
            "pending_count": sum(1 for item in parsed.slices if not item.checked),
        },
        "slice": {
            "id": selected.id,
            "type": selected.type,
            "label": selected.label,
            "checked": selected.checked,
            "declaration": selected.declaration,
            "body_markdown": selected.body_markdown,
            "line": selected.line,
            "identity_sha256": selected.identity_sha256,
            "fields": fields,
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate one Stage 1 RAES project and select its first unchecked slice.")
    parser.add_argument("--project-root", default=".", help="Explicit RAES project root (default: current directory).")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    result = preflight_project(args.project_root)
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] == "ready" else 2


if __name__ == "__main__":
    raise SystemExit(main())
