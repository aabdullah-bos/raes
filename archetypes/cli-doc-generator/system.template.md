# cli-doc-generator — system.template.md

## Purpose

This template defines default system rules for CLI tools that:
- take structured or semi-structured input (e.g., PRD)
- generate markdown documentation
- adapt templates into project-specific outputs

It is intended to seed `docs/system.md` for a project.
It should be adapted, not copied blindly.

---

## Product Invariants

- The tool generates human-editable markdown files.
- Output should remain legible and reviewable by an operator.
- The tool should not over-specify or fabricate missing product details.
- Generated documents should reflect input intent, not replace it.
- The system should prioritize clarity over completeness.

---

## Drift Guards

- Do not fabricate details not present in PRD or archetype.
- Prefer deterministic generation over heuristic guessing.
- Keep template content separate from generated output.
- Do not hardcode project-specific assumptions into templates.
- Implement the minimum logic required to support the current slice.
- One slice per session.
- Stop after completing a slice.
- Do not introduce abstraction layers before they are needed.

---

## Contracts

- Input shape (e.g., PRD file, flags, CLI arguments)
- Output structure (docs directory and required files)
- Archetype lookup mechanism
- Template rendering interface
- File generation behavior (overwrite, merge, or create)

---

## Unknowns

- How much structure should be inferred from the PRD
- Whether archetype selection is manual or automatic
- When the system should ask follow-up questions
- How much transformation should occur from template → output
- How to handle partial or ambiguous PRDs
- Future extensibility (plugins, additional commands)

---

## Anti-Patterns

- Do not silently invent system contracts
- Do not treat template defaults as project truth
- Do not mix generation logic with CLI interface code
- Do not introduce unnecessary configuration systems early
- Do not overbuild for extensibility before validating core workflow

---

## Definition of Done

A slice is complete only if:
1. The slice is explicitly defined
2. Failing tests were written first (where applicable)
3. Minimum implementation completed
4. Output files generated correctly
5. No unintended changes to unrelated templates or files
6. Decisions recorded if needed
7. Work stops after slice completion
