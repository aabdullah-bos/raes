# RAES Reference Document

**Status:** Review Slice — produced 2026-04-20  
**Purpose:** Bridge between conceptual design and tooling. Makes RAES teachable to someone who has not been present in the design conversations.  
**Authoritative sources inspected:** `README.md`, `docs/RAES_template.md`, `docs/raes_collaborator_seed_prompt.md`, `projects/raes-init/docs/pipeline.md`, `projects/raes-init/docs/decisions.md`, `RAES Brownfield.pdf`, `Foundation Document.pdf`

---

## 1. What RAES Is

RAES (Reusable AI Execution System) is a methodology for controlling AI-assisted software development by making human judgment explicit, durable, and inspectable. It addresses a specific failure mode: AI systems that generate code quickly but drift from original intent as complexity and ambiguity accumulate. RAES introduces a structured execution loop, two distinct slice types with defined completion criteria, and a set of persistent artifacts that carry decisions and constraints across sessions — so that each unit of work remains bounded, testable, and aligned with what was actually intended.

> The full category definition and positioning statement are in `README.md` under "AI Execution Systems."

---

## 2. What RAES Is Not

### Not an agent framework

Agent frameworks (LangChain, AutoGPT, etc.) orchestrate tool calls and planning loops with the goal of autonomous task completion. RAES does the opposite: it constrains what work happens and when, requiring human approval at judgment-critical points. RAES can run on top of agent-capable platforms, but it is not itself an orchestration runtime.

### Not prompt engineering

Prompt engineering produces better inputs to a model. Those inputs are ephemeral — they do not persist across sessions and do not record what was decided. RAES produces durable artifacts that accumulate decisions, surface ambiguity, and constrain future execution. The distinction matters because RAES is a system, not a technique.

### Not spec-driven development

Spec-driven tools (GitHub Spec Kit, AWS Kiro) focus on correctness before execution: define what to build, then build it. RAES focuses on correctness *during* execution: enforce bounded slices, surface ambiguity as it arises, and record decisions as they are made. Specs define what should happen; RAES ensures it actually happens correctly, one slice at a time. RAES is compatible with spec-driven workflows — it can consume a spec as its PRD — but it operates at a different layer.

### Not workflow automation

Workflow automation assumes known, repeatable processes. RAES is designed for the opposite: ambiguous requirements, evolving constraints, and decisions that cannot be predicted upfront. It handles ambiguity as a runtime event rather than a setup failure.

---

## 3. Artifact Responsibilities

RAES uses a set of single-purpose artifacts. Keeping each one focused on a single job is what keeps the truth surface small and navigable. The full artifact list — each file's job, decision right, mutation rules, and permitted headings — is in Section 3a.

---

## 3a. Artifact File Boundaries

### Decision Rights Table

| File | Job | Decision Right | Mutated By |
|------|-----|----------------|------------|
| `prd.md` | Product intent | What are we building and why? | Human only (at init or PRD revision) |
| `system.md` | Execution constraints | What must remain true across ALL future slices? | Human promotes constraint; agent reads it |
| `decisions.md` | Rationale audit trail | Why was a specific choice made? | Agent appends; human reviews |
| `pipeline.md` | Slice backlog + handoff state | What gets executed and in what order? | Agent appends handoff notes; human approves slices |
| `execution-guidance.md` | Workflow rules, anti-patterns, milestone guidance | How do we execute? | Agent updates only if durable rule discovered mid-slice |
| `validation.md` | Testing approach and validation commands | How do we verify correctness? | Mostly static; agent may append commands |
| `prd-ux-review.md` | UX ambiguity surface (bootstrap only) | Are there UX gaps in the PRD before first slice? | Human reads once, transfers findings, then done |

---

### Permitted and Forbidden Headings

#### `prd.md`

**Job:** Product intent — what are we building and why.

**Permitted headings:**
- `## Goals` / `### Business Goals` / `### User Goals` / `### Non-Goals`
- `## User Stories`
- `## Functional Requirements`
- `## User Experience`
- `## Narrative`
- `## Success Metrics` / `### Tracking Plan`
- `## Technical Considerations`
- `## Milestones & Sequencing`
- `## TL;DR`

**Forbidden headings:**
- `## Invariants` — belongs in `system.md`
- `## Product Invariants` — belongs in `system.md`
- `## Drift Guards` — belongs in `system.md`
- `## Known Contracts` — belongs in `system.md`
- `## Unknowns` — belongs in `system.md`
- `## Anti-Patterns` — belongs in `execution-guidance.md`
- `## Definition of Done` — belongs in `execution-guidance.md`
- `## Durable Decisions` — belongs in `decisions.md`
- `## Slice Backlog` — belongs in `pipeline.md`
- `## Handoff Notes` — belongs in `pipeline.md`

---

#### `system.md`

**Job:** Execution constraints — what must remain true across all future slices.

**Permitted headings:**
- `## Purpose`
- `## Product Invariants`
- `## Drift Guards`
- `## Known Contracts`
- `## Unknowns`
- `## Anti-Patterns`
- `## Definition of Done`

**Forbidden headings:**
- `## Goals` / `## User Stories` / `## Functional Requirements` — belongs in `prd.md`
- `## Durable Decisions` — belongs in `decisions.md`
- `## Slice Backlog` / `## Handoff Notes` — belongs in `pipeline.md`
- `## Workflow Rules` / `## Milestone Guidance` — belongs in `execution-guidance.md`
- `## Testing Approach` / `## Validation Commands` — belongs in `validation.md`

**Promotion rule:** When an agent discovers a new constraint mid-slice, it must flag it. The human decides whether it is promoted to `system.md`. Promotion is explicit and recorded in `decisions.md` with date and rationale. Agents do not write to `system.md` directly.

---

#### `decisions.md`

**Job:** Rationale audit trail — why was a specific choice made.

**Permitted headings:**
- `## Durable Decisions`
- Decision table with columns: `Decision | Rationale | Date`

**Forbidden headings:**
- `## Invariants` / `## Product Invariants` — belongs in `system.md`
- `## Workflow Rules` / `## Anti-Patterns` — belongs in `execution-guidance.md`
- `## Slice Backlog` — belongs in `pipeline.md`
- `## Goals` / `## Functional Requirements` — belongs in `prd.md`

**Promotion rule:** When an Unknown in `system.md` is resolved, the resolution is recorded here as a new decision entry with date. The Unknown is then removed from `system.md`. Decisions are append-only; existing entries are never modified.

---

#### `pipeline.md`

**Job:** Slice backlog + handoff state — what gets executed and in what order.

**Permitted headings:**
- `## Slice Backlog`
- `## Handoff Notes` (one sub-section per completed slice, e.g. `### Slice N — YYYY-MM-DD`)

**Forbidden headings:**
- `## Purpose` — belongs in `prd.md`
- `## Invariants` / `## Product Invariants` — belongs in `system.md`
- `## Drift Guards` — belongs in `system.md`
- `## Known Contracts` — belongs in `system.md`
- `## Unknowns` — belongs in `system.md`
- `## Workflow Rules` / `## Anti-Patterns` — belongs in `execution-guidance.md`
- `## Durable Decisions` — belongs in `decisions.md`

**Mutation rule:** Agent appends handoff notes after each completed slice. Agent marks slices as checked. Human approves slice definitions before they are added to the backlog. No other content is written to this file.

---

#### `execution-guidance.md`

**Job:** Workflow rules, anti-patterns, milestone guidance — how do we execute.

**Permitted headings:**
- `## Workflow Rules`
- `## Anti-Patterns`
- `## Definition of Done`
- `## Milestone Guidance` / `### Milestone N: <name>`

**Forbidden headings:**
- `## Invariants` / `## Product Invariants` / `## Drift Guards` — belongs in `system.md`
- `## Known Contracts` / `## Unknowns` — belongs in `system.md`
- `## Durable Decisions` — belongs in `decisions.md`
- `## Slice Backlog` / `## Handoff Notes` — belongs in `pipeline.md`
- `## Goals` / `## Functional Requirements` — belongs in `prd.md`
- `## Validation Commands` / `## Testing Approach` — belongs in `validation.md`

**Mutation rule:** Agent may update this file only when a durable execution rule is discovered mid-slice that is not already captured. The update must be scoped to the relevant section. No other mid-slice writes are permitted. All other content is set at init and revised only by human.

---

#### `validation.md`

**Job:** Testing approach and validation commands — how do we verify correctness.

**Permitted headings:**
- `## Testing Approach`
- `## Validation Commands`
- `## Known Constraints`

**Forbidden headings:**
- `## Invariants` / `## Product Invariants` — belongs in `system.md`
- `## Workflow Rules` / `## Anti-Patterns` — belongs in `execution-guidance.md`
- `## Durable Decisions` — belongs in `decisions.md`
- `## Slice Backlog` — belongs in `pipeline.md`

**Mutation rule:** Mostly static. Agent may append new validation commands discovered during a slice. No other writes.

---

#### `prd-ux-review.md`

**Job:** UX ambiguity surface — bootstrap only.

**Permitted headings:**
- `## UX Gaps`
- `## Open Questions`
- `## Findings`

**Forbidden headings:** All operational headings — this file is read-once at project bootstrap. Any findings must be transferred to `prd.md` (if they affect product intent) or `system.md` (if they surface constraints) before the first execution slice begins. Once findings are transferred, this file is considered done and is not updated again.

**Mutation rule:** Human reads once, transfers findings to the correct artifact, marks file as done. Agent never writes to this file.

---

### Promotion and Cross-Reference Rules

1. **Unknown → Decision:** When an Unknown in `system.md` is resolved, record the resolution in `decisions.md` with date and rationale. Remove the Unknown from `system.md`.

2. **Decision → System Constraint:** When a decision in `decisions.md` rises to the level of a project-wide invariant, the human promotes it to `system.md` as a Product Invariant or Known Contract. The `decisions.md` entry is not removed — it remains as the rationale for why the constraint exists.

3. **Mid-slice discovery → Execution Guidance:** When an agent discovers a new durable execution rule during a slice, it flags it. The human decides whether it is added to `execution-guidance.md`. The addition is recorded in `decisions.md`.

4. **No agent promotion without flag:** Agents never move content between artifacts autonomously. Every cross-artifact promotion requires an explicit flag, human review, and a `decisions.md` entry.

---

## 4. The Two Slice Types

RAES supports two slice modes. Slice type determines execution rules. Forcing planning work through an execution loop produces bad outcomes — the agent either invents meaningless tests to satisfy the ritual or the slice becomes fuzzy and low-signal.

### Execution Slice

**Used for:** code changes, contract changes, UI changes, behavior changes — any work whose completion can be verified by a passing test.

**Loop:**
```
PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD
```

**Rules:**
- One slice only
- Write failing tests first
- Implement the minimum code required to make those tests pass
- Run relevant tests and typecheck
- Append handoff notes to the configured pipeline file
- Append durable decisions to the configured decisions file only when needed
- Stop immediately after completing the slice
- If required guidance is missing, conflicting, or ambiguous, flag it explicitly before proceeding

**Completion criteria:**
- Failing test written first
- Minimum code passes the tests
- Validation run (tests + typecheck)
- Pipeline handoff notes appended
- Decisions file updated if a new durable constraint was discovered

---

### Review Slice

**Used for:** PRD review, implementation assessment, gap analysis, milestone generation, migration mapping — any work whose completion is a new durable artifact, not a code change.

**Loop:**
```
PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD
```

**Rules:**
- Inspect authoritative artifacts before writing anything
- Compare current state to build intent
- Identify concrete gaps explicitly — do not paper over them
- Produce bounded, actionable next slices
- Update pipeline
- Record rationale for any conclusions that must persist
- No implementation unless explicitly required by the slice definition

**Completion criteria:**
- Authoritative artifacts inspected
- Gaps identified explicitly (not inferred)
- Next bounded slices proposed
- Pipeline updated with this slice marked complete and next slice recommended
- No implementation code written

---

## 5. Config Design Principle

> **RAES config should route execution to truth, not replace truth.**

`raes.config.yaml` is a thin source map. It answers five questions for the agent:

1. Where is build intent?
2. Where is execution guidance?
3. Where are durable decisions?
4. How do I find the next slice?
5. Where do I look for validation guidance?

**What belongs in config:** file paths to authoritative artifacts.

**What does NOT belong in config:** the content of those artifacts. When new constraints emerge during execution, they are recorded in the project's existing truth artifacts — `pipeline.md` for slice progression and workflow guidance, `decisions.md` for durable choices that future slices must respect, `system.md` when the project has a stable project-wide rules document. RAES picks those constraints up on the next pass. This keeps config thin and prevents it from becoming a second documentation system.

### Artifact Boundary Rule

Use this rule whenever a fact could plausibly fit in more than one artifact:

- `raes-reference.md` owns shared RAES definitions and cross-tool contracts.
- `prd.md` owns product-specific required behavior, scope, and non-goals for one tool.
- `system.md` owns active durable constraints for one project. If the agent must obey a rule directly across future slices, it belongs here.
- `decisions.md` owns rationale, tradeoffs, and adoption history for one project. It explains why a local choice was made; it does not become the shared RAES spec.
- `execution-guidance.md` owns slice execution workflow rules for one project. It tells the operator or agent how to execute remaining slices; it does not redefine product requirements or shared RAES doctrine.
- `pipeline.md` owns sequencing, backlog state, and slice-local handoff context. It is not the durable home for cross-project rules.

Constraint promotion follows this boundary:

1. Shared RAES rule or artifact definition: record it in `raes-reference.md`.
2. Tool-specific required behavior: reflect it in that tool's `prd.md`.
3. Tool-specific durable implementation constraint: promote it into that tool's `system.md`.
4. Rationale for the choice: record it in that tool's `decisions.md`.

### Config Location Contract

- The canonical location of `raes.config.yaml` is the RAES project root, not `docs/`.
- Canonical project layout is `<project>/raes.config.yaml` plus living loop docs under `<project>/docs/`.
- `raes-init` should generate this layout by default.
- `raes-execute` should read `./raes.config.yaml` from the current working directory by default and may support an explicit `--config <path>` override for monorepos.
- RAES tools must not rely on implicit upward search or repo-wide discovery to pick a project config.

Legacy repos may still contain `docs/raes.config.yaml` during migration. That layout is transitional only; it does not change the canonical contract above.

**Config schema:** defined and implemented in `projects/raes-init/src/generate-docs.ts`. Existing project-local examples may still show the pre-migration `docs/raes.config.yaml` layout until their update slices land.

---

## 6. The Toolchain

RAES has three tools. Each targets a different starting condition.

### `raes-init`

Initializes a greenfield project. Supports two modes:

- **Bare greenfield** (`raes-init <target-path> <archetype>`) — generates stub docs with section structure and no content.
- **PRD-seeded** (`raes-init --from-prd <prd-path> <target-path> <archetype>`) — generates docs adapted from an existing PRD file.

Both modes produce the same RAES project layout: `raes.config.yaml` in `<target>/` plus seven living docs in `<target>/docs/`: `prd.md`, `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, and `validation.md`. Write behavior is create-or-fail: no overwrite, no merge.

Current status: V1 implemented in TypeScript. Supports the `cli-doc-generator` archetype. Located at `projects/raes-init/`.

### `raes-discover`

Inspects an existing repository (brownfield), identifies candidate artifacts that can serve as authoritative sources, and produces a `raes.config.yaml` source map. The output tells `raes-execute` where truth lives in a repo that was not initialized with RAES.

Current status: not yet implemented. Design exists in RAES Brownfield PDF.

### `raes-execute --next-slice`

Runs the next slice using `raes.config.yaml` as the source map. Reads the configured pipeline to find the first unchecked slice, loads execution guidance and durable decisions from their configured locations, and executes one slice following the rules appropriate for its slice type.

Current status: implemented in TypeScript at `projects/raes-execute/`. V1 includes config validation and path checks, artifact-boundary preflight, execution/review loop routing, provider integration, dry-run mode, and operator-confirmed slice completion. The canonical prompt remains the behavioral contract that this tool executes.

---

## 7. The Canonical Prompt Structure

The prompt structure separates three concerns:

- **Config** tells the agent where truth lives
- **Prompt** tells the agent how to behave
- **Project docs** remain the source of truth

This structure is platform-agnostic — it does not assume a specific agent runtime.

### Default Prompt (canonical form)

A single prompt handles both slice types. The agent identifies the slice type from the pipeline and applies the appropriate rules.

```
Read `raes.config.yaml` first and use it to locate the authoritative
project artifacts for:
- build intent
- system constraints
- next slice
- execution guidance
- durable decisions
- validation guidance

Read the first unchecked slice in the configured backlog. Identify its type:
Execution Slice or Review Slice. Apply the rules for that type only.

---

EXECUTION SLICE — loop: PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD

Rules:
- execute one slice only
- use the configured next-slice source as the source of truth for what to do next
- use the configured system-constraints source as the source of truth for
  invariants, drift guards, and contracts that must hold across all slices
- use the configured execution-guidance source as the source of truth for
  constraints, anti-patterns, workflow rules, and definition of done
- if system-constraints and execution-guidance disagree on a constraint, flag
  the conflict explicitly before proceeding — do not silently resolve it
- use the configured durable-decisions source as the source of truth for
  decisions that must persist across slices
- do not redesign the milestone or restate the overall plan unless required
  for execution
- write failing tests first
- implement the minimum code required to make those tests pass
- run relevant tests and typecheck using the project's existing tooling and
  the configured validation guidance
- append handoff notes to the configured pipeline file; handoff notes capture
  operational state from this slice only: what was left incomplete, what was
  discovered mid-slice, and what the next operator needs to pick up — do not
  restate guidance or constraints already present in execution-guidance
- update the configured execution-guidance source only if this slice uncovered
  a durable rule that applies to all remaining slices; the threshold is whether
  the guidance would still be relevant five slices from now
- append durable implementation decisions to the configured decisions file
  only when needed

Expected output: Current slice | Sources used | Repo inspection | Plan |
Tests added/updated | Implementation changes | Commands run | Result |
Flags | Next recommended slice

---

REVIEW SLICE — loop: PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD

Rules:
- inspect authoritative artifacts before writing anything
- compare current state to build intent
- identify concrete gaps explicitly — do not paper over them
- do not duplicate what already exists — reference it
- no implementation code
- update pipeline with this slice marked complete and next slice recommended
- if the review produces durable guidance for future slices, add it to
  execution-guidance; if it is operational context for the immediate next
  slice only, add it to pipeline handoff notes

Expected output: Current slice | Artifacts inspected | Findings | Gaps (explicit) |
Output artifact(s) produced | Flags | Next recommended slice

---

In either case:
- if required guidance is missing, conflicting, or ambiguous, flag it explicitly
  before proceeding
- stop immediately after completing the slice
```

**Note on prompt evolution:** For `raes-execute`, the operative runtime prompt is `projects/raes-execute/src/prompts/execution-loop.md`. The canonical form above captures shared RAES behavior and expected flow; when wording diverges, the runtime prompt governs actual tool behavior. Prompt examples in `README.md` and `RAES_template.md` Section 6 should be treated as legacy references for historical context, not execution authority for config-routed projects. For projects without `raes.config.yaml`, inspect the repository for candidate artifacts and treat what you find as available truth.

---

## 8. The Human-in-the-Loop Position

RAES does not remove humans from the loop. It places humans on the critical path — at the moments where judgment is required — and delegates everything else to the system.

| Layer | Who owns it |
|---|---|
| Execution | AI |
| Slice scoping | Human |
| Ambiguity resolution | Human |
| Decision memory | System (durable artifacts) |
| Repetition | AI |

Without RAES, humans are involved everywhere but implicitly: writing prompts, debugging inconsistencies, reverse-engineering intent, fixing edge cases. With RAES, human involvement is fewer but more leveraged: clarifying intent (PLAN), approving slice boundaries (SLICE), resolving flagged ambiguity (FLAG/REVIEW).

The result is not less involvement. It is more leverage per decision.

This position is a deliberate design choice, not a limitation. Software development involves ambiguous requirements, evolving constraints, and competing tradeoffs — it is a judgment distribution problem, not an automation problem. RAES automates execution; it does not automate judgment.

---

## 9. UX Concern Scoping

UX concerns in RAES are not uniform — how they are handled depends on the archetype.

### The role of `prd-ux-review.md`

`prd-ux-review.md` is a **bootstrap artifact**. It is generated at init time to surface UX ambiguity from the PRD before the first execution slice runs. It is intentionally absent from `raes.config.yaml` — the execution loop does not consume it.

Its purpose is transfer, not persistence: the operator reviews it once, moves relevant findings into `execution-guidance.md` (as UX constraints the loop enforces) and `decisions.md` (as decided UX patterns), then it is done. It is not a document that accumulates over time.

### CLI and tooling archetypes

For CLI/tooling archetypes, UX concerns are narrow: help text, error messages, option naming, failure behavior. These belong as a `## Operator Experience Rules` subsection inside `execution-guidance.md` — not as a standalone document in the loop. The surface is small enough that a dedicated document creates overhead without adding resolution.

Example constraints for a CLI archetype:
- Every error message must tell the operator what to do next
- Help text must describe all supported invocation modes
- Failure must occur before any file I/O — never leave partial output on disk

### Product archetypes

For product archetypes with real end-user UX (frontend apps, AI experiences), UX concerns are first-class execution constraints: user flows, affordances, failure states, transitions, and timing all affect whether a slice is correct. These warrant a dedicated `ux-constraints.md` as a config key, loaded by the execution loop alongside `execution-guidance.md`.

That design is deferred to when the first product archetype is implemented.

---

## 10. Emergent Work

**Emergent work** is work discovered during a slice that was not in the PRD or pipeline. It is distinct from the FLAG step.

- **FLAG** — guidance is missing, conflicting, or ambiguous. May pause the slice.
- **SURFACE** — new scope discovered. Captured in the Parking Lot. Does not pause the slice unless blocking.

### Classification

When work surfaces that was not planned, classify it immediately:

| Classification | Criteria | Action |
|----------------|----------|--------|
| **Inline Fix** | <5 lines, no interface touched | Do it now in the current slice; note in handoff. No Parking Lot entry. |
| **New Slice** | More lines or touches a contract; fits current milestone | Add Parking Lot entry. Promote to milestone backlog at REVIEW. |
| **New Milestone** | Out of current milestone scope; 3–8 slices to complete | Add Parking Lot entry. Stub a new milestone section at REVIEW. |
| **Sub-Project** | 5+ slices, own constraints and unknowns | Add Parking Lot entry. Create a subdirectory with its own `pipeline.md`; link from the Parking Lot row. |

**If Blocking = Yes:** stop the current slice and raise at REVIEW. The next slice does not start until the item is promoted or dismissed.

### Parking Lot

**Status note (2026-05-12):** Parking Lot semantics are deferred for tooling contracts. For `raes-init` and other artifact-shape enforcement work, Sections 3 and 3a remain authoritative until this section is reconciled with the file-boundary contract in a later review slice. Tooling should not require or emit a `## Parking Lot` section based on this section alone.

A `## Parking Lot` section lives in `pipeline.md`, after all milestones. It holds a table of emergent items not yet promoted into the active backlog. At each REVIEW step, the operator promotes items (converts them to slice entries in the appropriate milestone) or dismisses them with a one-line note. Dismissed items remain in the table so the decision is visible.

### Sub-Projects

A sub-project gets its own subdirectory with a minimal `pipeline.md` (and `decisions.md` if decisions accumulate). It does not require the full eight-file RAES docs set unless it grows to that scale. The parent Parking Lot row links to the sub-project directory. The parent pipeline gains one integration verification slice that runs after the sub-project completes — because integration requires both contexts to be in scope simultaneously.

---

## 11. Open Questions and Flagged Gaps

The following items are not yet decided or are inconsistent across existing artifacts. Each represents work that must happen before the affected part of RAES can be considered stable.

---

**Gap 1: `raes.config.yaml` schema is not defined** ✓ Resolved 2026-04-20

The schema was defined and implemented in an Execution Slice (2026-04-19). `raes-init` now generates `raes.config.yaml` with five source keys: `build_intent`, `next_slice` (structured with `path` and `selection_rule`), `durable_decisions`, `execution_guidance`, and `validation`. See `projects/raes-init/src/generate-docs.ts` for the canonical schema and `projects/raes-init/docs/raes.config.yaml` for a live example.

---

**Gap 2: `raes-discover` is not implemented**

`raes-discover` is described in the Brownfield PDF and in the toolchain (Section 5) as the entry point for brownfield projects. It does not exist as a repo artifact, an implementation, or a formal spec. Projects that start with a brownfield inspection (as this review slice did) currently rely on the agent's own judgment to locate authoritative artifacts.

*Recommended next slice: Execution Slice to implement a minimal `raes-discover` CLI that inspects a repo and emits a `raes.config.yaml`.*

---

**Gap 3: `raes-execute` is not implemented** ✓ Resolved 2026-05-17

`raes-execute` now exists at `projects/raes-execute/` and supports single-slice execution via config-routed artifacts with execution/review loop handling, provider submission, boundary validation preflight, dry-run, and explicit operator confirmation before recording completion. The canonical prompt in Section 7 remains the shared behavioral contract; the runtime copy used by the tool lives in `projects/raes-execute/src/prompts/execution-loop.md`.

---

**Gap 4: The Review Slice is not formalized in any existing repo artifact** ✓ Resolved 2026-04-20

`README.md` updated in a Review Slice (2026-04-20) to document both slice types with their distinct loops, rules, and completion criteria. The two-slice-type model (Execution Slice and Review Slice) is now present in both `README.md` and this document.

---

**Gap 5: Existing prompt examples use hardcoded paths, not config-based routing** ✓ Resolved 2026-04-20

`README.md` "Example Execution Prompt" updated to use config-routed form. See `README.md` and Section 6 of this document for canonical prompt forms.

---

**Gap 6: Archetype coverage is narrow and undocumented** ✓ Partially resolved 2026-04-20

`archetypes/cli-doc-generator/README.md` added in a Review Slice (2026-04-20). It documents: what the templates are for, how they relate to generated output (reference only, not consumed by `raes-init`), what `raes-init` actually generates, and the V1 archetype contract. The contract between archetypes and generation logic will be formalized before a second archetype is implemented — that formalization is the remaining open work.
