from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from preflight import preflight  # noqa: E402
from validate_artifacts import validate_manifest  # noqa: E402


def artifacts(project: Path, stage: Path, prd: Path, *, review: bool = False) -> Path:
    result = preflight(str(project), str(prd))
    assert result["status"] == "ready", result
    stage.mkdir()
    (stage / "docs").mkdir()
    (stage / "docs/prd.md").write_bytes(prd.read_bytes())
    docs = {
        "system.md": ["Purpose", "Product Invariants", "Drift Guards", "Known Contracts", "Unknowns", "Anti-Patterns", "Definition of Done"],
        "decisions.md": ["Durable Decisions"],
        "prd-ux-review.md": ["UX Gaps", "Open Questions", "Findings"],
        "execution-guidance.md": ["Workflow Rules", "Anti-Patterns", "Definition of Done", "Sequencing Guidance"],
        "validation.md": ["Testing Approach", "Validation Commands", "Known Constraints"],
    }
    for name, headings in docs.items():
        (stage / "docs" / name).write_text("# Artifact\n\n" + "\n\n".join(f"## {h}\n\nNone established." for h in headings) + "\n")
    kind = "review" if review else "execution"
    special = "  Required output:\n\n  - Update docs/decisions.md and docs/system.md.\n" if review else "  Validation:\n\n  Establish and run validation defined in docs/validation.md.\n"
    (stage / "docs/pipeline.md").write_text(
        f"# Pipeline\n\n## Slice Backlog\n\n- [ ] S-0001 | {kind} | First work\n"
        "  Description:\n\n  Complete the first bounded unit of approved work.\n\n"
        "  Acceptance criteria:\n\n  - The approved behavior is demonstrated.\n\n" + special +
        "\n## Handoff Notes\n\nStart with S-0001.\n"
    )
    config = (
        'raes:\n  contract_version: "1.0"\nproject:\n  name: ' + json.dumps(project.name) +
        "\nsources:\n  build_intent: docs/prd.md\n  system_constraints: docs/system.md\n"
        "  next_slice:\n    path: docs/pipeline.md\n    selection_rule: first_unchecked_slice\n"
        "  durable_decisions: docs/decisions.md\n  execution_guidance: docs/execution-guidance.md\n"
        "  validation: docs/validation.md\n"
    )
    (stage / "raes.config.yaml").write_text(config)
    manifest = {**result, "manifest_version": 1, "invocation_id": "test", "staging_root": str(stage)}
    manifest_path = stage / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    return manifest_path
