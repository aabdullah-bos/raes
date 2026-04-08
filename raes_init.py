from __future__ import annotations

from pathlib import Path
import argparse
import sys


SUPPORTED_ARCHETYPE = "cli-doc-generator"
REQUIRED_DOC_NAMES = (
    "PRD.md",
    "system.md",
    "pipeline.md",
    "decisions.md",
    "prd-ux-review.md",
)


class GenerationError(RuntimeError):
    pass


def generate_docs(prd_path: Path, target_project_path: Path, archetype: str) -> list[Path]:
    if archetype != SUPPORTED_ARCHETYPE:
        raise GenerationError(f"unsupported archetype: {archetype}")

    source_prd = Path(prd_path)
    project_root = Path(target_project_path)
    docs_dir = project_root / "docs"
    output_paths = [docs_dir / name for name in REQUIRED_DOC_NAMES]

    existing_outputs = [path for path in output_paths if path.exists()]
    if existing_outputs:
        raise GenerationError(f"target docs already exist: {existing_outputs[0]}")

    try:
        prd_text = source_prd.read_text(encoding="utf-8")
    except OSError as exc:
        raise GenerationError(f"unable to read PRD: {source_prd}") from exc

    docs_dir.mkdir(parents=True, exist_ok=True)

    project_name = project_root.name or "project"
    prd_title = _extract_prd_title(prd_text, fallback=project_name)
    prd_bullets = _extract_bullets(prd_text)

    generated_content = {
        "PRD.md": prd_text,
        "system.md": _render_system_doc(project_name, prd_title, prd_bullets),
        "pipeline.md": _render_pipeline_doc(project_name, prd_title, prd_bullets),
        "decisions.md": _render_decisions_doc(project_name),
        "prd-ux-review.md": _render_review_doc(project_name, prd_title, prd_bullets),
    }

    for path in output_paths:
        path.write_text(generated_content[path.name], encoding="utf-8")

    return output_paths


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="raes-init",
        description="Generate a RAES docs set from one PRD markdown file.",
    )
    parser.add_argument("prd_path")
    parser.add_argument("target_project_path")
    parser.add_argument("archetype")
    args = parser.parse_args(argv)

    try:
        generate_docs(
            prd_path=Path(args.prd_path),
            target_project_path=Path(args.target_project_path),
            archetype=args.archetype,
        )
    except GenerationError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 0


def _extract_prd_title(prd_text: str, fallback: str) -> str:
    for line in prd_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def _extract_bullets(prd_text: str) -> list[str]:
    bullets: list[str] = []
    for line in prd_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            bullets.append(stripped[2:].strip())
        if len(bullets) == 3:
            break
    return bullets


def _render_system_doc(project_name: str, prd_title: str, prd_bullets: list[str]) -> str:
    invariants = _render_bullets(
        prd_bullets,
        fallback_items=[
            "The generated docs should preserve the source PRD intent.",
            "Output must remain readable and editable markdown.",
        ],
    )
    return (
        f"# {project_name} — system.md\n\n"
        "## Purpose\n\n"
        f"This document defines the V1 execution rules for `{project_name}`.\n\n"
        f"The project is initialized from the PRD `{prd_title}` using the `{SUPPORTED_ARCHETYPE}` archetype.\n\n"
        "## Product Invariants\n\n"
        f"{invariants}\n\n"
        "## Drift Guards\n\n"
        "- Do not fabricate requirements that are not present in the PRD.\n"
        "- Do not widen the V1 happy path beyond one PRD file, one target path, and one archetype.\n"
        "- Do not overwrite existing generated docs.\n\n"
        "## Known Contracts\n\n"
        "- Input mode: one readable PRD markdown file path.\n"
        "- Target location: `<target>/docs/`.\n"
        f"- Supported archetype: `{SUPPORTED_ARCHETYPE}`.\n"
        "- Generated files: `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`.\n\n"
        "## Unknowns\n\n"
        "- How much PRD normalization should be applied beyond copying `PRD.md`.\n"
        "- How future archetypes should adapt the output set.\n"
        "- What validation is needed beyond the narrow happy path.\n\n"
        "## Anti-Patterns\n\n"
        "- Do not treat template defaults as project truth.\n"
        "- Do not hide ambiguous requirements.\n"
        "- Do not add code scaffolding or runtime assumptions in V1.\n\n"
        "## Definition of Done\n\n"
        "1. The narrow happy path generates the full docs set.\n"
        "2. Existing target docs cause generation to fail before writes.\n"
        "3. Generated markdown remains project-specific and editable.\n"
    )


def _render_pipeline_doc(project_name: str, prd_title: str, prd_bullets: list[str]) -> str:
    known_contracts = _render_bullets(
        prd_bullets,
        fallback_items=["The project should use the PRD as the source of truth for generated docs."],
    )
    return (
        f"# {project_name} — pipeline.md\n\n"
        "## Purpose\n\n"
        f"This pipeline defines the initial execution path for `{project_name}` based on the PRD `{prd_title}`.\n\n"
        "## Invariants\n\n"
        "### Product Invariants\n\n"
        "- Output must be readable markdown.\n"
        "- Output must stay editable by humans.\n"
        "- Unknowns remain visible instead of being fabricated.\n\n"
        "### Drift Guards\n\n"
        "- One slice per session.\n"
        "- Tests first.\n"
        "- Minimum implementation only.\n"
        "- No overwrite behavior in V1.\n\n"
        "## Known Contracts\n\n"
        f"{known_contracts}\n\n"
        "## Unknowns\n\n"
        "- How much validation should happen before generation.\n"
        "- How far PRD adaptation should go in later slices.\n\n"
        "## Slice Backlog\n\n"
        "### Milestone 1 — Narrow Happy Path\n\n"
        "- [ ] Slice 1: Generate the RAES docs set from one PRD file into `<target>/docs/`.\n\n"
        "### Milestone 2 — Validation\n\n"
        "- [ ] Slice 2: Add explicit error messages for invalid inputs and target conflicts.\n\n"
        "## Handoff Notes\n"
    )


def _render_decisions_doc(project_name: str) -> str:
    return (
        f"# {project_name} — decisions.md\n\n"
        "## Durable Decisions\n"
    )


def _render_review_doc(project_name: str, prd_title: str, prd_bullets: list[str]) -> str:
    feature_points = _render_bullets(
        prd_bullets,
        fallback_items=["The PRD should remain the source of truth for operator expectations."],
    )
    return (
        f"# {project_name} — prd-ux-review.md\n\n"
        "## Purpose\n\n"
        f"This review captures ambiguity and operator risk for `{project_name}` based on `{prd_title}`.\n\n"
        "## Observed Requirements\n\n"
        f"{feature_points}\n\n"
        "## UX Risks\n\n"
        "- Users may not know what happens when docs already exist at the target path.\n"
        "- The scope of supported input modes may be unclear if the CLI surface expands early.\n\n"
        "## Open Questions\n\n"
        "- Should future versions support inline PRD input?\n"
        "- What level of normalization is appropriate for copied PRD content?\n"
    )


def _render_bullets(items: list[str], fallback_items: list[str]) -> str:
    values = items or fallback_items
    return "\n".join(f"- {item}" for item in values)


if __name__ == "__main__":
    raise SystemExit(main())
