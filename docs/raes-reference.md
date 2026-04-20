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

## 3. The Two Slice Types

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

## 4. Config Design Principle

> **RAES config should route execution to truth, not replace truth.**

`raes.config.yaml` is a thin source map. It answers five questions for the agent:

1. Where is build intent?
2. Where is execution guidance?
3. Where are durable decisions?
4. How do I find the next slice?
5. Where do I look for validation guidance?

**What belongs in config:** file paths to authoritative artifacts.

**What does NOT belong in config:** the content of those artifacts. When new constraints emerge during execution, they are recorded in the project's existing truth artifacts — `pipeline.md` for slice progression and workflow guidance, `decisions.md` for durable choices that future slices must respect, `system.md` when the project has a stable project-wide rules document. RAES picks those constraints up on the next pass. This keeps config thin and prevents it from becoming a second documentation system.

**Config schema (not yet formalized — see Section 8, Gap 1).**

---

## 5. The Toolchain

RAES has three tools. Each targets a different starting condition.

### `raes-init`

Initializes a greenfield project. Accepts a PRD file path plus an archetype identifier and generates the full RAES docs set (`PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`) under the target project's `/docs` directory. Write behavior is create-or-fail: no overwrite, no merge.

Current status: V1 implemented in TypeScript. Supports the `cli-doc-generator` archetype. Located at `projects/raes-init/`.

### `raes-discover`

Inspects an existing repository (brownfield), identifies candidate artifacts that can serve as authoritative sources, and produces a `raes.config.yaml` source map. The output tells `raes-execute` where truth lives in a repo that was not initialized with RAES.

Current status: not yet implemented. Design exists in RAES Brownfield PDF.

### `raes-execute --next-slice`

Runs the next slice using `raes.config.yaml` as the source map. Reads the configured pipeline to find the first unchecked slice, loads execution guidance and durable decisions from their configured locations, and executes one slice following the rules appropriate for its slice type.

Current status: not yet implemented. The canonical prompt (Section 6) is the manual equivalent of what this tool will automate.

---

## 6. The Canonical Prompt Structure

The prompt structure separates three concerns:

- **Config** tells the agent where truth lives
- **Prompt** tells the agent how to behave
- **Project docs** remain the source of truth

This structure is platform-agnostic — it does not assume a specific agent runtime.

### Execution Slice Prompt (canonical form)

```
Read `docs/raes.config.yaml` first and use it to locate the authoritative 
project artifacts for:
- build intent
- next slice
- execution guidance
- durable decisions
- validation guidance

Then inspect the repository and execute the next slice using the RAES core loop:
PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD

Execution rules:
- execute one slice only
- use the configured next-slice source as the source of truth for what to do next
- use the configured execution-guidance sources as the source of truth for 
  constraints, anti-patterns, workflow rules, and definition of done
- use the configured durable-decisions source as the source of truth for 
  decisions that must persist across slices
- do not redesign the milestone or restate the overall plan unless required 
  for execution
- write failing tests first
- implement the minimum code required to make those tests pass
- run relevant tests and typecheck using the project's existing tooling and 
  the configured validation guidance
- append handoff notes to the configured pipeline file
- append durable implementation decisions to the configured decisions file 
  only when needed
- stop immediately after completing the slice
- if required guidance is missing, conflicting, or ambiguous, flag it 
  explicitly before proceeding

Expected output format:
- Current slice
- Sources used
- Repo inspection
- Plan
- Tests added/updated
- Implementation changes
- Commands run
- Result
- Flags
- Next recommended slice

Start with the first unchecked slice in the configured backlog and stop 
after that slice is complete.
```

### Review Slice Prompt (canonical form)

```
Read `docs/raes.config.yaml` first and use it to locate the authoritative 
project artifacts for:
- build intent
- next slice
- execution guidance
- durable decisions
- validation guidance

If `docs/raes.config.yaml` does not exist, inspect the repository for 
candidate artifacts and treat what you find as the available truth.

This is a REVIEW SLICE. Do not write implementation code. Do not write 
failing tests.

Review Slice rules:
- Inspect existing repo artifacts before writing anything
- Identify what is already captured vs. what is missing
- Do not duplicate what already exists — reference it
- Synthesize the gaps into the output artifact
- If required guidance is missing, conflicting, or ambiguous, flag it 
  explicitly before proceeding

Completion criteria:
- Output artifact exists and is coherent
- It does not contradict existing durable decisions
- Gaps and inconsistencies are explicitly listed
- Pipeline is updated with this slice marked complete and next slice recommended
- No implementation code was written
```

**Note on prompt evolution:** Existing prompt examples in `README.md` and `RAES_template.md` Section 6 use hardcoded document paths rather than config-based routing. These are earlier-generation prompts. The canonical forms above supersede them for projects that have a `raes.config.yaml`. For projects without one, fall back to the repo inspection pattern shown in the Review Slice prompt.

---

## 7. The Human-in-the-Loop Position

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

## 8. Open Questions and Flagged Gaps

The following items are not yet decided or are inconsistent across existing artifacts. Each represents work that must happen before the affected part of RAES can be considered stable.

---

**Gap 1: `raes.config.yaml` schema is not defined**

No repo artifact specifies what keys `raes.config.yaml` must contain, what values are valid, or what behavior is expected when a key is absent. The design principle (Section 4) is decided. The schema is not. Any implementation of `raes-discover` or `raes-execute` requires a formal schema.

*Recommended next slice: Define and document the minimal `raes.config.yaml` schema as a Review Slice. No implementation required.*

---

**Gap 2: `raes-discover` is not implemented**

`raes-discover` is described in the Brownfield PDF and in the toolchain (Section 5) as the entry point for brownfield projects. It does not exist as a repo artifact, an implementation, or a formal spec. Projects that start with a brownfield inspection (as this review slice did) currently rely on the agent's own judgment to locate authoritative artifacts.

*Recommended next slice: Execution Slice to implement a minimal `raes-discover` CLI that inspects a repo and emits a `raes.config.yaml`.*

---

**Gap 3: `raes-execute` is not implemented**

`raes-execute --next-slice` is described in Section 5 as the tool that automates what the canonical prompt currently does manually. It does not exist. Currently, operators copy and paste the canonical prompt (Section 6) into their AI tool of choice.

*Dependency: Requires Gap 1 to be resolved first.*

---

**Gap 4: The Review Slice is not formalized in any existing repo artifact**

`RAES_template.md` documents only the execution loop. `README.md` documents only the execution loop. The Review Slice loop (`PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD`) and its distinct rules and completion criteria exist only in the Brownfield PDF and now in this document. The template and README should be updated to reflect both slice types.

*Recommended next slice: Review Slice to update `RAES_template.md` and `README.md` to include the two-slice-type model.*

---

**Gap 5: Existing prompt examples use hardcoded paths, not config-based routing**

`README.md` Section "Example Execution Prompt" and `RAES_template.md` Section 6 reference specific file paths (`docs/PRD.md`, `docs/system.md`, etc.) directly. This is the pre-config design. For projects using `raes.config.yaml`, these prompts should route through config. The canonical prompts in Section 6 of this document supersede the earlier examples — but the earlier examples remain in the repo and could mislead new adopters.

*Recommended action: Update both artifacts in the same slice as Gap 4 above.*

---

**Gap 6: Archetype coverage is narrow and undocumented**

`raes-init` supports one archetype (`cli-doc-generator`). The README roadmap lists five planned archetypes. There is no document that defines what an archetype must contain to be considered complete, or what the contract is between an archetype and `raes-init`'s generation logic. Adding a second archetype requires that contract to be explicit.

*Recommended next slice: Review Slice to define the archetype contract before implementing a second archetype.*
