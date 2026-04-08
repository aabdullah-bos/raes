# raes-init — prd-ux-review.md

## Purpose

This review captures ambiguity, UX risk, and open questions in the `raes-init` PRD before implementation.

The product is a CLI document generator, so the main UX is not visual UI. The critical experience is whether a user can predict what inputs are required, what will be generated, and what happens when the target path already contains docs.

---

## Feature Review

### 1. Input Collection

#### What the PRD says

- The system accepts project name, PRD, archetype selection, and optional notes.
- The PRD may be provided as text or file.

#### Ambiguities

- It is not clear whether project name is required if the target path already identifies the project.
- It is not clear whether inline PRD text and PRD file input are equally first-class in V1.
- It is not clear how optional notes influence output or whether they should be preserved in generated docs.

#### UX Risks

- Too many initial input modes increase setup complexity before the core workflow is proven.
- Users may not know which fields are truly required for the first successful run.
- If notes affect output invisibly, generation can feel opaque.

#### Proposed V1 Intent

- Narrow the first happy path to one readable PRD file path, one target project path, and one archetype.
- Treat additional input modes as future expansion.

#### Open Questions

- Should project name be derived from the target path in V1?
- Should optional notes appear anywhere in generated docs if later supported?

---

### 2. Archetype Selection

#### What the PRD says

- Multiple archetypes are listed as possible selections.

#### Ambiguities

- It is not clear whether multiple archetypes exist today or are planned for later.
- It is not clear whether archetype selection should be explicit or defaulted.

#### UX Risks

- Presenting multiple choices before their behavior is well defined can make the tool feel more capable than it is.
- Automatic selection could hide important assumptions from the user.

#### Proposed V1 Intent

- Support `cli-doc-generator` as the default and initial execution shape.
- Keep archetype handling explicit and narrow until the first path is stable.

#### Open Questions

- Should the CLI require the archetype flag even when only one archetype is supported?
- When more archetypes exist, how should users understand the differences between them?

---

### 3. Output Generation

#### What the PRD says

- The system generates a docs directory containing five markdown files.
- Files should be readable, editable, and not over-specified.

#### Ambiguities

- It is not defined whether `PRD.md` should be copied verbatim or lightly normalized.
- It is not defined what happens if some or all target docs already exist.
- It is not defined whether generation should be atomic.

#### UX Risks

- Silent overwrite would erode trust quickly.
- Partial generation on failure would leave the target in an unclear state.
- Excessive normalization could make the user feel the tool rewrote the product intent.

#### Proposed V1 Intent

- Use create-or-fail behavior for the generated docs set.
- Prefer no-write failure over partial overwrite.
- Keep PRD handling light and legible.

#### Open Questions

- Should future versions allow explicit overwrite confirmation?
- Should `PRD.md` preserve the exact original structure or normalize headings when needed?

---

### 4. `system.md` Generation

#### What the PRD says

- `system.md` should combine archetype defaults with PRD-derived constraints and must not fabricate unknowns.

#### Ambiguities

- It is not clear how much of the PRD should be lifted directly versus interpreted.
- It is not clear how strongly the generated system should constrain later implementation.

#### UX Risks

- If the document is too generic, it will not guide execution.
- If it is too specific, it may invent constraints the user did not approve.

#### Proposed V1 Intent

- Make contracts explicit only where the PRD or archetype supports them.
- Put uncertain areas in `Unknowns` rather than implying decisions.

#### Open Questions

- What minimum PRD quality is needed to produce a useful `system.md`?

---

### 5. `pipeline.md` Generation

#### What the PRD says

- The pipeline should be project-specific and organized into small, testable, sequential slices.

#### Ambiguities

- It is not clear how detailed each slice should be.
- It is not clear how many milestones are useful before implementation begins.

#### UX Risks

- A large backlog creates false precision.
- Non-sequential slices weaken RAES discipline and make implementation harder to review.

#### Proposed V1 Intent

- Keep the backlog short.
- Make the first slice prove one end-to-end happy path before refinement work.

#### Open Questions

- How much backlog detail is helpful before actual implementation reveals constraints?

---

### 6. `prd-ux-review.md` Generation

#### What the PRD says

- The tool should extract ambiguous interactions, UX risks, and open questions.

#### Ambiguities

- The PRD is product-focused but only lightly defines operator failure moments and expectations.
- It is not clear how exhaustive the review should be for a CLI tool.

#### UX Risks

- If the review is too shallow, it misses real ambiguity.
- If it is too broad, it becomes generic and less actionable.

#### Proposed V1 Intent

- Focus on operator understanding of inputs, output effects, failure behavior, and trust.

#### Open Questions

- Should future versions include a separate operator-journey review for CLI tools?
