#!/usr/bin/env python3
"""Validate a complete staged Stage 1 RAES candidate without target mutation."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

HEADINGS = {
    "docs/system.md": ["## Purpose", "## Product Invariants", "## Drift Guards", "## Known Contracts", "## Unknowns", "## Anti-Patterns", "## Definition of Done"],
    "docs/pipeline.md": ["## Slice Backlog", "## Handoff Notes"],
    "docs/decisions.md": ["## Durable Decisions"],
    "docs/prd-ux-review.md": ["## UX Gaps", "## Open Questions", "## Findings"],
    "docs/execution-guidance.md": ["## Workflow Rules", "## Anti-Patterns", "## Definition of Done", "## Sequencing Guidance"],
    "docs/validation.md": ["## Testing Approach", "## Validation Commands", "## Known Constraints"],
}
BASE = {"docs/prd.md", *HEADINGS, "raes.config.yaml"}
DECL = re.compile(r"^- \[ \] (S-\d{4}) \| (execution|review) \| (\S.*)$")
PLACEHOLDER = re.compile(r"<(?:test|lint|build|validation)?[-_ ]?command>|TODO_COMMAND|your-command-here", re.I)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def failure(code: str, message: str, path: str | None = None) -> dict[str, Any]:
    item: dict[str, Any] = {"code": code, "message": message}
    if path:
        item["path"] = path
    return item


def _headings(text: str) -> list[str]:
    found: list[str] = []
    fenced = False
    for line in text.splitlines():
        if line.startswith("```") or line.startswith("~~~"):
            fenced = not fenced
        elif not fenced and re.fullmatch(r"## [^\n]+", line):
            found.append(line)
    return found


def _validate_pipeline(text: str, errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lines = text.splitlines()
    start, end = lines.index("## Slice Backlog") + 1, lines.index("## Handoff Notes")
    slices: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line_no, line in enumerate(lines[start:end], start + 1):
        if line.startswith("#"):
            errors.append(failure("UNSUPPORTED_BACKLOG_HEADING", "Headings and milestones are forbidden inside the backlog.", "docs/pipeline.md"))
        if line.startswith("- ["):
            if line.startswith("  "):
                errors.append(failure("NESTED_SLICE_DECLARATION", "Selectable declarations must be top-level.", "docs/pipeline.md"))
                continue
            match = DECL.fullmatch(line)
            if not match:
                errors.append(failure("MALFORMED_SLICE_DECLARATION", "Slice declaration does not match the flat Stage 1 grammar.", "docs/pipeline.md"))
                continue
            current = {"id": match.group(1), "type": match.group(2), "label": match.group(3), "body": [], "line": line_no}
            slices.append(current)
        elif current is not None:
            current["body"].append(line)
    expected = [f"S-{index:04d}" for index in range(1, len(slices) + 1)]
    ids = [item["id"] for item in slices]
    if ids != expected:
        errors.append(failure("NON_SEQUENTIAL_SLICE_IDS", "Slice IDs must be unique and sequential beginning at S-0001.", "docs/pipeline.md"))
    for item in slices:
        body = "\n".join(item["body"])
        labels = re.findall(r"^  (Description:|Acceptance criteria:|Validation:|Required output:|Constraints:)\s*$", body, re.M)
        if any(labels.count(label) > 1 for label in set(labels)):
            errors.append(failure("DUPLICATE_SLICE_BODY_LABEL", f"{item['id']} repeats a slice-body label.", "docs/pipeline.md"))
        for label in ("Description:", "Acceptance criteria:"):
            if labels.count(label) != 1:
                errors.append(failure("INCOMPLETE_SLICE_BODY", f"{item['id']} lacks exactly one {label}", "docs/pipeline.md"))
        if not re.search(r"^  Description:\s*\n(?:\s*\n)*  \S", body, re.M):
            errors.append(failure("EMPTY_DESCRIPTION", f"{item['id']} has no description content.", "docs/pipeline.md"))
        if not re.search(r"^  Acceptance criteria:\s*\n(?:\s*\n)*  - \S", body, re.M):
            errors.append(failure("MISSING_ACCEPTANCE_CRITERIA", f"{item['id']} lacks acceptance-criteria bullets.", "docs/pipeline.md"))
        if "Validation:" in labels and not re.search(r"^  Validation:\s*\n(?:\s*\n)*  (?:- )?\S", body, re.M):
            errors.append(failure("EMPTY_EXECUTION_VALIDATION", f"{item['id']} has empty Validation guidance.", "docs/pipeline.md"))
        if item["type"] == "review":
            if labels.count("Required output:") != 1 or not re.search(r"^  Required output:\s*\n(?:\s*\n)*  - \S", body, re.M):
                errors.append(failure("MISSING_REVIEW_OUTPUTS", f"{item['id']} lacks required review-output bullets.", "docs/pipeline.md"))
    return slices


def validate_manifest(manifest_path: str | Path) -> dict[str, Any]:
    path = Path(manifest_path).resolve()
    try:
        manifest = json.loads(path.read_text())
    except Exception as exc:
        return {"status": "blocked", "errors": [failure("INVALID_MANIFEST", str(exc))]}
    stage = Path(manifest["staging_root"]).resolve()
    errors: list[dict[str, Any]] = []
    if path.parent != stage:
        errors.append(failure("MANIFEST_OUTSIDE_STAGING", "Manifest must be in the staging root."))
    expected = set(manifest["destinations"])
    if not BASE.issubset(expected) or expected - (BASE | {"docs/srs.md", "docs/architecture.md"}):
        errors.append(failure("INVALID_CANDIDATE_SET", "Candidate must contain exactly the applicable eight, nine, or ten paths."))
    for relative in sorted(expected):
        candidate = (stage / relative).resolve()
        try:
            candidate.relative_to(stage)
        except ValueError:
            errors.append(failure("CANDIDATE_PATH_ESCAPES_STAGING", "Candidate path escapes staging.", relative))
            continue
        if not candidate.is_file():
            errors.append(failure("MISSING_CANDIDATE", "Required candidate file is absent.", relative))
    for relative, required in HEADINGS.items():
        candidate = stage / relative
        if candidate.is_file() and _headings(candidate.read_text()) != required:
            errors.append(failure("INVALID_ARTIFACT_HEADINGS", "Required level-two headings must appear exactly once and in order.", relative))
    config = stage / "raes.config.yaml"
    expected_config = (
        'raes:\n  contract_version: "1.0"\nproject:\n  name: ' + json.dumps(Path(manifest["project_root"]).name) +
        "\nsources:\n  build_intent: docs/prd.md\n  system_constraints: docs/system.md\n"
        "  next_slice:\n    path: docs/pipeline.md\n    selection_rule: first_unchecked_slice\n"
        "  durable_decisions: docs/decisions.md\n  execution_guidance: docs/execution-guidance.md\n"
        "  validation: docs/validation.md\n"
    )
    if config.is_file() and config.read_text() != expected_config:
        errors.append(failure("INVALID_CONFIG_SCHEMA", "Config must exactly match the Stage 1 versioned six-source schema.", "raes.config.yaml"))
    for role in ("prd", "srs", "architecture"):
        source = manifest["sources"].get(role)
        if source and sha(stage / source["destination"]) != source["sha256"]:
            errors.append(failure("SOURCE_NOT_PRESERVED", "Primary source was not preserved byte-for-byte.", source["destination"]))
    pipeline = stage / "docs/pipeline.md"
    slices = _validate_pipeline(pipeline.read_text(), errors) if pipeline.is_file() and "## Slice Backlog" in pipeline.read_text() and "## Handoff Notes" in pipeline.read_text() else []
    for relative in ("docs/pipeline.md", "docs/validation.md"):
        candidate = stage / relative
        if candidate.is_file() and PLACEHOLDER.search(candidate.read_text()):
            errors.append(failure("PLACEHOLDER_COMMAND", "Placeholder commands are forbidden.", relative))
    hashes = {relative: sha(stage / relative) for relative in sorted(expected) if (stage / relative).is_file()}
    result = {"status": "valid" if not errors else "blocked", "errors": errors, "candidate_hashes": hashes, "slices": slices}
    manifest["candidate_hashes"] = hashes
    manifest["validation"] = {"status": result["status"], "errors": errors}
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    result = validate_manifest(parser.parse_args(argv).manifest)
    json.dump(result, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0 if result["status"] == "valid" else 2


if __name__ == "__main__":
    raise SystemExit(main())
