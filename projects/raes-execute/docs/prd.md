# RAES Execute

### TL;DR

RAES Execute is a CLI tool that automates disciplined, ambiguity-resistant AI-assisted software development. It executes one slice of work at a time, ensures each decision and artifact stays in its proper place, and prevents drift from project intent. Ideal for engineers and operators using the RAES methodology to produce reliable, testable outcomes.

---

## Goals

### Business Goals

* Enable repeatable, reliable execution of RAES workflow in real-world projects.
* Reduce ambiguity and execution drift in AI-assisted software development by at least 90% compared to a prompt-driven baseline.
* Drive adoption of the RAES methodology and supporting toolchain (init, execute, discover).
* Minimize support burden by catching and surfacing specification/documentation errors early.
* Generate cases for case studies and testimonials by achieving successful launches with at least 3 external teams.

### User Goals

* Run the next bounded slice safely and clearly, never skipping steps or missing ambiguities.
* Quickly inspect project state (current, next, and past slices) and artifacts without reading each file directly.
* Trust that system constraints, decisions, and product intent will not be mingled or lost in execution.
* Surface or flag ambiguities or missing information before code or artifact is produced.
* Debug, validate, and confirm the RAES configuration and artifact boundaries as needed — without leaving the CLI.

### Non-Goals

* Does not support automated multi-slice/multi-milestone batch execution (one slice per invocation).
* Does not merge, overwrite, or reinterpret artifact files outside the strict rules defined in RAES.
* Not a code generator, agent, or prompt optimizer — enforces workflow, not content creativity.

---

## User Stories

**Operator (Engineer/Product/AI Operator):**

* As an operator, I want to execute the next slice so that work advances within all project constraints.
* As an operator, I want to list all defined slices so that I can see project and milestone progression.
* As an operator, I want to view details about the next slice before executing it so I have context.
* As an operator, I want to print any RAES artifact to stdout so that I can debug or inspect state easily.
* As an operator, I want to check that config and all referenced artifacts are present and valid before running an execution.
* As an operator, I want to see a concise status summary of the project at any time so I stay oriented.
* As an operator, I want to review or export recent history of executed slices and major document changes.
* As an operator, I want to flag ambiguity or blocking issues directly so I can pause work until resolved.
* As an operator, I want help text always available so I can recall CLI usage quickly.

---

## Functional Requirements

* **CLI Execution:** (Priority: High)

  * \--execute-next-slice (-e): Runs the next unchecked slice using strict RAES rules (determining slice type, running the right loop, updating artifacts appropriately).
  * \--list-slices (-l): Outputs a list of all pipeline slices, showing position, status (checked/unchecked), type, assignee, and label.
  * \--show-next-slice (-n): Prints the details of the next unchecked slice (type, constraints, goal, acceptance criteria, related files).
  * \--print-artifact (-p): Prints the content of a named RAES artifact (prd, system, decisions, etc.) to stdout.
  * \--check-config (-c): Checks that raes.config.yaml exists, is valid, and that all referenced artifact paths are present and proper types.
  * \--status (-s): Outputs current project status: next slice, milestone, total slices complete/remaining, active flags/ambiguity.
  * \--history: Lists the most recent N executed slices, showing what changed and when.
  * \--flag : Adds a flag to current slice or config for ambiguity, blocking, or known issues.
  * \--help (-h): Shows concise help and usage for all supported options.

* **Boundary/Artifact Discipline:** (Priority: High)

  * Each CLI invocation/integration must check that artifacts are only updated in their correct roles as per RAES reference (never allow constraints/rationale to be mixed).
  * Durable constraints promoted from decisions.md must be referenced in system.md (and vice versa); tool must validate or warn when boundary is unclear.

* **Safety/Drift Guards:** (Priority: High)

  * Disallow execution if artifact boundary is violated or unknown artifact is referenced in config.
  * Halt on ambiguous, missing, or conflicting slice/content until resolved by human.

* **Extensibility/Auditability:** (Priority: Medium)

  * CLI extensible via subcommands, but core RAES execution flow and artifact rules cannot be bypassed.
  * History/log output and flagging designed to be machine-readable for later ingestion/analysis.

---

## User Experience

**Entry Point & First-Time User Experience**

* User installs RAES Execute as a CLI tool (npm, pip, binary, etc.)
* User navigates to a RAES-initialized project directory containing valid raes.config.yaml.
* On first run, user may call --help for a full summary, or --check-config to verify everything is valid before beginning.

**Core Experience**

* **Step 1:** User runs `raes-execute --execute-next-slice` (or -e).
  * Tool reads raes.config.yaml and loads all artifact sources.
  * CLI confirms which slice will execute next, its type, and relevant constraints.
  * If any artifact is missing, ambiguous, or boundary is violated, halts execution and outputs actionable flag/error.
* **Step 2:** Tool walks user/agent through either Execution Loop or Review Loop (prompting, recording, and enforcing boundaries).
  * Writes/updates only the correct artifact(s) for that slice.
* **Step 3:** Upon completion, tool appends results/handoff notes and updates status, history, and (if encountered) flags.
* **Step 4:** User may call --status, --history, --list-slices, or --print-artifact at any time to see project state, or --flag to register open ambiguity/blocking.

**Advanced Features & Edge Cases**

* User flags ambiguity: Tool halts advancement until issue is resolved and flag is cleared, ensuring no action "papers over" uncertainty.
* If a constraint is added to decisions.md but not promoted to system.md, or vice versa, tool warns user and optionally blocks advancement.
* Detects outdated or inconsistent config references and guides user to self-heal.

**UI/UX Highlights**

* CLI outputs are color-coded and use clear icons/symbols for errors, active slice, warnings, completions.
* All help/status/list outputs are formatted for easy reading and piping/scripting (plain text, with optional JSON/YAML modes in future).
* Strict, concise error messages: always say what is blocking, why, and what file or data needs to be fixed before proceeding.

---

## Narrative

Imagine a small engineering team bootstrapping a new app with RAES. After the initial structure is set up, every day someone runs `raes-execute -e` to take the next step. Instead of guessing what “next” means or discovering mid-implementation that a requirement was misunderstood, the CLI tells them, in plain language, what slice they’re advancing, where artifacts will update, and whether anything needs clarification.

When the inevitable ambiguity surfaces—was this a product goal or a tech constraint?—the tool stops them immediately, highlights the artifact in error, and forces a team conversation before work can proceed. With a glance, project state and health is accessible to anyone (`--status`) and new team members can see exactly what’s left and why decisions were made in prior steps (`--history`, `--print-artifact`).

RAES Execute doesn’t just automate; it remaps team attention to the highest-value moments: decision, constraint, and successful handoff. The team ships each iteration with confidence, and every lesson is encoded for the next cycle.

---

## Success Metrics

### User-Centric Metrics

* % of slices executed without boundary or artifact errors (as measured by CLI guardrails)
* User-reported clarity on artifact boundaries and “where truth lives” (survey or feedback)
* Median time to blocked/flagged ambiguity resolution

### Business Metrics

* Number of successful project completions using RAES Execute in new repos/month (tracked opt-in)
* Support tickets related to execution drift or artifact confusion (low volume is good)
* Adoption/conversion rate from RAES Init to RAES Execute

### Technical Metrics

* Ratio of slices executed to slices flagged for ambiguity/conflict (should trend toward "clean")
* CLI uptime/bug reports
* Rate of config/artifact validation errors detected (trends, regressions)

### Tracking Plan

* Invocations of each CLI command
* Number and type of flags raised by users per project
* Error and boundary violation types encountered
* Time-to-resolve for flagged items
* Artifacts printed/inspected most frequently

---

## Technical Considerations

### Technical Needs

* Robust CLI parser supporting short/long options, subcommands and error-handling for missing/extra params.
* Modular artifact loaders and boundary validators, extensible for new artifact types but immutable for core rules.
* Safe, atomic file I/O for updating artifacts; never partial writes.
* Logging and history recording for later analysis.

### Integration Points

* Integration with RAES Init (outputs must match expected doc set and config schema)
* Optionally support third-party CLI runners (e.g., scriptable via shell, npm, Python, etc.)
* Potential future integration with RAES Discover (when brownfield flow is live)

### Data Storage & Privacy

* Reads and writes only to explicitly configured files in the current project root (never touches non-RAES files)
* All user and slice history data stored locally; no remote calls
* No collection of PII unless user enables telemetry

### Scalability & Performance

* Designed for small-to-medium teams and projects (<500 slices per project)
* CLI should execute core commands (other than --history) in under 200ms on commodity hardware

### Potential Challenges

* Ensuring artifact boundaries never slip due to human or agent error (edge case validation is critical)
* Providing helpful errors/guidance without overburdening the CLI surface
* Supporting extensibility for future archetypes without breaking contract discipline

---

## Milestones & Sequencing

### Project Estimate

Small Team: 2–3 weeks to v1 with disciplined CLI, config validation, boundary enforcement, and help/status/history surface.

### Team Size & Composition

Small team: 1–2 total people (Engineer/CLI specialist, with Product for test/user-feedback review; optionally, docs support for robust help and error wording).

### Milestone-Based Sequencing

* Milestone 1 — Scaffold & Core Validation: Initialize project outputs, implement raes.config.yaml check, and build foundational CLI scaffolding (basic command parsing, help, and config validation). This delivers a runnable binary/package and ensures config + artifact paths are validated before use.
* Milestone 2 — Navigation & Visibility: Implement listing and inspection features: --list-slices and --show-next-slice. Provide concise, pipe-friendly output formats for easy scripting and quick project orientation.
* Milestone 3 — Slice Execution: Implement --execute-next-slice with strict RAES execution rules, artifact boundary enforcement, and halt-on-ambiguity behavior. Ensure writes are atomic and history/status updates are recorded.

Each milestone is intentionally lean and sequential: deliver a minimal, testable surface that can be validated before moving to the next milestone. The plan aligns with a fast-startup team focused on rapid iteration and clear guardrails.