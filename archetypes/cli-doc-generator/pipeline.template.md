# cli-doc-generator — pipeline.template.md

## Purpose

This template defines the execution structure for CLI-based document generators.

---

## Invariants

### Product Invariants

- Output must be valid, readable markdown
- Generated docs must be editable by humans
- Generation should reflect input, not invent missing details

### Drift Guards

- One slice per session
- Minimal implementation only
- No fabrication of unknowns
- Templates remain source of truth
- Stop after slice completion

---

## Known Contract Areas

- CLI input arguments / flags
- PRD input file handling
- Output directory structure
- Template loading and rendering
- File write behavior

---

## Unknowns

- PRD parsing depth
- Template adaptation logic
- User interaction model (prompting vs flags)
- Handling incomplete inputs

---

## Suggested Milestones

### Milestone 1 — Basic CLI Setup
- [ ] Initialize CLI entry point
- [ ] Accept input PRD path
- [ ] Define output directory structure

### Milestone 2 — Template Loading
- [ ] Load archetype templates
- [ ] Validate template existence
- [ ] Prepare template variables

### Milestone 3 — Basic Generation
- [ ] Generate docs directory
- [ ] Output PRD.md, system.md, pipeline.md, decisions.md
- [ ] Ensure files are editable and correctly formatted

### Milestone 4 — PRD Integration
- [ ] Parse PRD minimally
- [ ] Inject key sections into generated docs
- [ ] Preserve unknowns explicitly

### Milestone 5 — Refinement
- [ ] Improve structure consistency
- [ ] Add validation and error handling
- [ ] Review drift and unknown handling

---

## Session Workflow

1. Read project docs
2. Identify next slice
3. Write failing test (if applicable)
4. Implement minimal solution
5. Run tests / validate output
6. Record decisions
7. Mark slice complete
8. Stop

---

## Testing Rules

- Validate file creation and structure
- Validate template rendering correctness
- Avoid brittle string matching where possible
- Ensure deterministic outputs

---

## Definition of Done

A slice is complete only when:
1. Expected files are generated or modified correctly
2. Output matches intended structure
3. No unrelated files are changed
4. Slice is marked complete
5. Work stops after slice

---

## Handoff Notes

Append execution notes here during actual project use.
