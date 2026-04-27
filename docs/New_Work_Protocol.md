# Plan: Emergent Work Protocol for RAES (Lightweight)

## Context

During development, work surfaces that wasn't in the PRD or pipeline — discovered mid-slice, needing to be specified and placed somewhere without derailing current work. Today there is no formal path for this, so developers make ad-hoc decisions. The goal is to add just enough structure to solve the friction without creating a documentation burden.

Design principle: stay lightweight where there is little complexity, add complexity where necessary.

---

## What Changes (Two Files Only)

### 1. `docs/RAES_template.md` — Add Parking Lot section to the pipeline template

Add a `## Parking Lot` section after the slice backlog milestones and before Handoff Notes. This is where emergent work lands without disrupting the active backlog.

Entry format (lightweight — just enough to act on later):

```markdown
## Parking Lot

Items discovered during active slices. Operator promotes or dismisses at the next REVIEW step.

| Issue | Discovered During | Blocking | Classification | Notes |
|-------|------------------|----------|----------------|-------|
| <title> | <slice name> | Yes/No | Inline Fix / New Slice / New Milestone / Sub-Project | <1-line description> |
```

- **Inline Fix**: <5 lines, no interface touched → do it in the current slice, note in handoff
- **New Slice**: more lines or touches a contract, but fits current milestone → promote to milestone backlog
- **New Milestone**: out of current milestone scope, 3–8 slices → stub a new milestone
- **Sub-Project**: 5+ slices, own constraints/unknowns → create a subdirectory with its own `pipeline.md`, link from here

If **Blocking = Yes**: stop the current slice and resolve at REVIEW before proceeding.

### 2. `docs/raes-reference.md` — Add "Emergent Work" section

Add one section after Section 8 (UX Concern Scoping), before Section 9 (Open Questions). This is the authoritative definition of the pattern.

Content (brief):
- Distinguish **SURFACE** (new scope discovered) from **FLAG** (guidance missing/conflicting). FLAG can pause a slice; SURFACE never pauses unless Blocking.
- Reference the Parking Lot as the landing place.
- State the four classifications and the rule: classify, capture, continue (unless blocking).
- Note the sub-project convention: its own subdirectory with a `pipeline.md`, linked from the parent Parking Lot.

---

## Files Modified

| File | Change |
|------|--------|
| `docs/RAES_template.md` | Add `## Parking Lot` section with table format and classification rules |
| `docs/raes-reference.md` | Add "Emergent Work" section (SURFACE vs FLAG, four classifications, sub-project convention) |

No new files. No archetype template changes. No canonical prompt extension.

---

## Verification

Walk the deployment infrastructure example through the new protocol:
1. Agent discovers infra incompatibility mid-slice → classifies as Sub-Project (5+ slices, own constraints)
2. Adds a row to the Parking Lot table with Blocking = Yes
3. Stops current slice, raises at REVIEW
4. Operator creates `/sub-projects/deploy-infra/pipeline.md`, links it from the Parking Lot row
5. Parent pipeline gains an integration verification slice after sub-project completes

Confirm the three other cases also resolve cleanly: Inline Fix (no Parking Lot entry needed), New Slice, New Milestone.