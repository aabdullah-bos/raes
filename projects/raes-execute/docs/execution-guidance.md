# RAES Execute: Execution Guidance

## Invariants

1. **Artifact Boundary Discipline is Non-Negotiable**
   - Each artifact (prd.md, system.md, decisions.md, etc.) has a single, immutable purpose as defined by RAES reference.
   - Constraints, rationale, goals, and acceptance criteria must never be mingled across artifact types.
   - The CLI must validate and enforce artifact boundaries on every execution; no exception handling allows boundary violation to pass silently.

2. **One Slice Per Invocation**
   - `--execute-next-slice` advances exactly one slice and halts.
   - Multi-slice or batch execution is explicitly out of scope; the tool enforces serial, bounded progression.
   - Each slice must complete its assigned loop (Execution or Review) before the next slice is eligible for execution.

3. **Ambiguity Halts Work**
   - If any artifact is missing, conflicting, or ambiguous, the CLI must halt execution and surface the issue with actionable guidance.
   - No workarounds, defaults, or "best guess" inference are allowed; ambiguity must be resolved by human decision before work advances.
   - Flags raised via `--flag` must be resolved (or explicitly cleared) before the next slice can execute.

4. **Project State is Durable and Auditable**
   - All artifact changes, slice completions, and flag resolutions are recorded in history with timestamps and context.
   - History must be machine-readable (supporting JSON/YAML export in future versions) and human-inspectable.
   - Config and artifact versions are immutable once a slice references them; changes to config require human review and flag resolution.

5. **CLI Writes Only to Correct Artifacts**
   - The tool updates only the artifact(s) designated for the current slice's type and loop.
   - Updates are atomic; partial writes or incomplete state transitions are prohibited.
   - No modifications to artifacts outside the slice boundary are permitted.

6. **No AI Creativity or Content Generation**
   - RAES Execute enforces workflow and discipline, not content creativity or prompt optimization.
   - The CLI guides the operator/agent through loops and validates inputs; it does not author, infer, or rewrite content.
   - Human or external AI agent is responsible for all substantive decisions and artifact content; the CLI only checks that boundaries and rules are respected.

## Workflow Rules

1. **Initialization & Validation Before Execution**
   - Before any `--execute-next-slice` invocation, `--check-config` must succeed.
   - raes.config.yaml must exist, be valid YAML, and reference only paths that are present and of correct type.
   - All artifact paths named in config must be readable; missing files halt all execution until resolved.

2. **Slice Selection & Context**
   - The next unchecked slice is determined by pipeline order in raes.config.yaml.
   - `--show-next-slice` must be called (or its output automatically shown on `--execute-next-slice` prompt) to confirm slice type, constraints, goal, acceptance criteria, and related files before human/agent commits to execution.
   - If the user or agent opts not to proceed, the slice remains unchecked; no partial state is recorded.

3. **Execution Loop (for Implementation Slices)**
   - CLI loads the slice definition and confirms its type is "implementation" or equivalent.
   - CLI prompts the operator/agent for decisions/inputs according to RAES execution loop rules.
   - CLI enforces that only designated artifacts are modified for this slice.
   - Operator/agent provides evidence/justification for each decision; CLI records it.
   - Upon completion, CLI atomically updates artifacts and marks slice as checked.

4. **Review Loop (for Review/Decision Slices)**
   - CLI loads the slice definition and confirms its type is "review," "decision," or equivalent.
   - CLI prompts the operator/agent to review relevant artifacts and prior slice history.
   - CLI enforces that review findings and decisions are recorded in decisions.md or appropriate artifact without mingling.
   - Upon completion, CLI marks slice as checked and flags any constraints for promotion to system.md if needed.

5. **Constraint Promotion & Boundary Validation**
   - If a new constraint is added to decisions.md, CLI must warn user that system.md may require update.
   - If system.md references a constraint not in decisions.md, CLI flags this as a boundary violation.
   - Promotion from decisions.md to system.md must be explicit (not automatic) and recorded in history.
   - CLI provides a mechanism (e.g., a review command or flag) to ensure durable constraints are properly promoted.

6. **Flag Lifecycle**
   - User may call `--flag <issue-type> <description>` to register ambiguity, blocking issue, or known problem.
   - Flagged state is stored in project history and must be displayed in `--status` output.
   - Flags must be explicitly resolved (via human review, config update, or artifact clarification) before subsequent slices can execute.
   - Resolved flags are archived in history with resolution context.

7. **History & State Inspection**
   - `--history` outputs recent executed slices, showing what changed, when, and by whom (or agent name if applicable).
   - `--list-slices` shows all slices with their current status (checked/unchecked), type, assignee, and label.
   - `--status` shows the current next slice, milestone, total progress, and any active flags or ambiguity.
   - `--print-artifact <name>` outputs the full content of any RAES artifact without interpretation or modification.
   - All outputs support both human-readable (default) and machine-readable (JSON/YAML, future) formats.

8. **Artifact Inspection & Debugging**
   - User may call `--print-artifact` at any time to inspect any artifact without side effects.
   - `--check-config` may be run repeatedly to validate current state and catch drift.
   - CLI outputs for inspection are concise but complete; no truncation or summarization that could obscure errors.

## Anti-Patterns

1. **Overriding or Inferring Ambiguous Config**
   - Anti-pattern: CLI assumes default behavior when config is ambiguous or incomplete.
   - Correct approach: CLI halts, outputs exact error, and provides guidance for fixing config before retry.

2. **Batching Slices Without Intermediate Validation**
   - Anti-pattern: Operator runs multiple slices in sequence without checking status or history between them.
   - Correct approach: CLI enforces one-slice-per-invocation; operator must explicitly call `--execute-next-slice` again.

3. **Mingling Artifact Boundaries**
   - Anti-pattern: A review slice updates both decisions.md and system.md simultaneously without explicit promotion step.
   - Correct approach: CLI enforces that only the designated artifact(s) are updated; promotion is a separate, deliberate action recorded in history.

4. **Silently Patching Broken References**
   - Anti-pattern: CLI auto-corrects a missing file path or invalid reference in config.
   - Correct approach: CLI flags the error, halts execution, and requires human to fix and verify before proceeding.

5. **Skipping Constraint Promotion Validation**
   - Anti-pattern: decisions.md records a new constraint, but system.md is not updated; CLI allows work to proceed anyway.
   - Correct approach: CLI warns on constraint mismatch and may require explicit resolution (e.g., a separate promotion action or flag acknowledgment).

6. **Lossy or Partial History Recording**
   - Anti-pattern: History only records slice completion, not what artifacts changed or why.
   - Correct approach: History includes full context: slice name, artifacts modified, operator/agent identity, timestamp, and summary of changes.

7. **Assuming Operator Intent Without Confirmation**
   - Anti-pattern: CLI executes a slice because it matches a pattern, without explicit user/agent confirmation.
   - Correct approach: `--execute-next-slice` always shows the next slice details and waits for explicit proceed/halt confirmation before advancing.

8. **Allowing Artifact Writes Outside Slice Scope**
   - Anti-pattern: An implementation slice modifies a file not in its artifact list.
   - Correct approach: CLI validates artifact writes against the slice's declared boundary; unauthorized writes are rejected and flagged.

## Definition of Done

A slice execution is complete and ready for advancement when:

1. **All Artifact Boundaries Respected**
   - Only artifacts designated for this slice's type have been modified.
   - No new files or artifact types have been introduced outside the RAES schema.
   - Boundary validation in CLI reports no violations.

2. **Ambiguity Resolved**
   - Any flagged ambiguity, missing information, or conflicting constraint related to this slice has been addressed.
   - If unresolved ambiguity remains, it must be explicitly flagged (via `--flag`) with clear description of what must be resolved before the next slice.
   - No "TODO" or "FIXME" comments exist in artifact changes without corresponding open flag.

3. **History and State Updated**
   - Slice is marked as checked in config/state.
   - History entry records slice name, artifacts modified, operator/agent identity, timestamp, and brief summary.
   - `--status` reflects the updated next slice and milestone progress.

4. **Artifact Content Coherent**
   - All references within the updated artifact(s) are internally consistent.
   - If a constraint is added to decisions.md, the tool warns whether system.md needs update; this warning is acknowledged or resolved.
   - No dangling references or undefined terms in updated artifacts.

5. **Acceptance Criteria Met**
   - The slice's acceptance criteria (from config) are reviewed and confirmed met.
   - Evidence or justification for completion is recorded in history or as comment in artifact.
   - If acceptance criteria cannot be met, the slice is halted and flagged for clarification.

6. **Config Remains Valid**
   - `--check-config` passes after the slice execution.
   - All artifact paths referenced in config still exist and are readable.
   - No config changes have been made outside the designated slice scope.

7. **Operator Ready for Next Slice**
   - Operator/agent has reviewed `--status` and `--show-next-slice` for the next slice.
   - No active flags or blocking issues prevent advancement.
   - Operator confirms understanding of what the next slice entails before calling `--execute-next-slice` again.

## Milestone Guidance

### Milestone 1: Scaffold & Core Validation

**Key Implementation Considerations**

- **CLI Framework & Argument Parsing:** Choose a robust CLI library (e.g., Click for Python, Commander.js for Node, Cobra for Go) that supports short/long options, error handling, and help generation. Ensure `--help` is always available and outputs concise, actionable usage information.

- **Config Loading & Schema Validation:** Implement a YAML/JSON parser and schema validator for raes.config.yaml. Define the expected schema (pipeline slices, artifact paths, milestone names, etc.) based on RAES Init outputs. Validation must be strict: reject unknown keys, missing required fields, and invalid paths.

- **Artifact Path Resolution:** Build a path resolver that reads config, resolves relative paths from project root, and checks that each artifact file exists and is readable. Do not attempt to create or modify files during validation; only verify presence and permissions.

- **Basic Error Handling & Logging:** Implement error messages that are specific, actionable, and human-readable. Include file paths, line numbers in config, and guidance for fixing issues. Set up basic logging (to stderr or a log file) for debugging and later analysis.

- **Help & Version Output:** Implement `--help` and `--version` commands. Help output should list all commands, their short options, brief description, and usage example. Version should match the package/release version.

- **Project State Initialization:** Design a minimal state/history file (e.g., raes.state.yaml or .raes/history.json) that tracks executed slices, timestamps, and flags. Initialize this file on first validation if it does not exist. Do not assume it exists; safely create it if needed.

**Sequencing Rationale**

This milestone is foundational: without robust config validation and state initialization, all downstream features (execution, history, boundary enforcement) are fragile. By delivering a validated, runnable binary that can check its own preconditions, the team gains confidence that the tool can be safely used in real projects. This milestone also sets the tone for discipline: if config validation is weak, boundary enforcement later will be weak.

**What the Executing Team Should Know Before Beginning**

- **Config Schema Definition:** Have a finalized, written schema for raes.config.yaml before coding. This is non-negotiable; the schema is the contract between RAES Init and RAES Execute.
- **Error Message Standard:** Define a standard for error messages (include file path, line number, what is wrong, how to fix). Apply this standard consistently across all CLI output.
- **State File Format:** Choose a simple, durable format (YAML or JSON) for tracking slices and history. Plan for extensibility (future fields for flags, resolution status, etc.) but keep the initial version minimal.
- **Testing Approach:** Plan unit tests for config parsing, path resolution, and error cases. Create fixture configs (valid, invalid, partial) for testing. This is critical because config validation is a guardrail; if it breaks, the whole tool is unreliable.
- **Performance Baseline:** Aim to complete `--check-config` in <100ms on commodity hardware. Measure early; if config parsing is slow, refactor before moving to later milestones.

---

### Milestone 2: Navigation & Visibility

**Key Implementation Considerations**

- **Slice Metadata & Status Tracking:** Extend state to track each slice's status (checked/unchecked), type, assignee, and label. Load this metadata from config and merge with runtime state. Ensure status is accurate: a slice marked "checked" must have a corresponding history entry.

- **`--list-slices` Implementation:** Iterate through all slices in config, retrieve their metadata and current status, and format output as a readable table or list. Include position in pipeline, type, assignee, label, and checked/unchecked indicator. Support plain-text and JSON output modes for scripting.

- **`--show-next-slice` Implementation:** Determine the next unchecked slice from the pipeline. Load its full definition: type, constraints, goal, acceptance criteria, related artifact files, and any prior flags or notes. Format as a readable summary. If no next slice exists (all checked), output a completion message.

- **`--print-artifact` Implementation:** Accept an artifact name (e.g., "prd", "system", "decisions") or full path. Load the artifact file and output its full content to stdout without modification. Support piping/redirection. Include a header showing the artifact name and file path for clarity.

- **`--status` Implementation:** Output a concise summary showing: next slice (name, type), current milestone, total slices complete/remaining, active flags (if any), and any blocking issues. Use color/icons for readability. This should be quick to scan and sufficient for orientation.

- **Output Formatting & Readability:** Ensure all list/inspection outputs are human-readable by default (clear column alignment, minimal clutter) but also machine-parseable (support JSON export in future). Use consistent symbols/icons for status (✓ for complete, ○ for pending, ⚠ for flagged).

**Sequencing Rationale**

With navigation features in place, operators can inspect project state at any time without reading raw files. This visibility is essential for build confidence before execution and for debugging when things go wrong. These commands have no side effects, so they are safe to develop in parallel and can be tested extensively before moving to execution.

**What the Executing Team Should Know Before Beginning**

- **Output Format Decisions:** Decide upfront on the structure of list/status outputs. Create examples and get feedback from likely users (engineers, operators) on readability and usefulness before finalizing format.
- **Slice Metadata Schema:** Define what metadata is stored per slice (type, assignee, label, description) and ensure config schema supports it. This metadata is later used in navigation and execution.
- **Edge Case Handling:** Consider edge cases: empty pipeline, all slices checked, slice with no acceptance criteria, artifact file with unusual encoding. Define behavior (error, default, skip) for each and test explicitly.
- **Help Text for Each Command:** Write concise, example-based help for `--list-slices`, `--show-next-slice`, `--print-artifact`, `--status`. Include usage examples and expected output samples in help.
- **Test Coverage:** Create test fixtures with different project states (no slices, mixed checked/unchecked, all complete). Verify output correctness and formatting for each state.

---

### Milestone 3: Slice Execution

**Key Implementation Considerations**

- **Execution Loop vs. Review Loop:** Implement logic to determine the next slice's type from config and invoke the appropriate loop (Execution for implementation, Review for decision/review slices). Each loop has different prompts, validation rules, and artifact updates; keep them modular and testable.

- **Execution Loop Details:** For implementation slices, walk the operator/agent through RAES execution loop steps: confirm constraints, elicit decisions, record evidence, and update only the designated artifact(s). Prompt for required inputs; do not allow empty responses for critical fields. Validate inputs against