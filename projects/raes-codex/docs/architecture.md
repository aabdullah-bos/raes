## Purpose

This document defines the architectural direction for replacing the user-facing functionality of raes-init and raes-execute with a Codex-native implementation of the Reusable AI Execution System.

It establishes the intended responsibilities of Codex, the deterministic mechanisms that must remain outside model reasoning, the compatibility requirements for existing RAES artifacts, and the phased approach for designing, testing, and adopting the new tooling.

The document serves as the durable architectural reference for the Codex-native RAES project. It is intended for maintainers and contributors who need to understand:

* the outcome the project is intended to produce;
* the RAES behaviors and guarantees that must be preserved;
* the boundaries between model-driven reasoning and deterministic enforcement;
* the decisions that have already been made;
* the assumptions that remain subject to validation;
* the unresolved questions that require further investigation or explicit decisions;
* the criteria by which the Codex-native implementation will be evaluated.

This document is authoritative regarding the current architectural direction. Changes to that direction should be made explicitly by updating the relevant decision, assumption, or open-question section rather than being introduced implicitly through implementation.

The document does not provide Codex with a specific execution task. Task-specific instructions, repository state, expected outputs, and stopping conditions belong in the temporary Codex handoff document.

The document also does not replace the RAES methodology or its authoritative project artifacts. Its purpose is to describe how Codex-native tooling will implement and enforce that methodology.

## Background and Current State

The Reusable AI Execution System (RAES) is a repository-centered methodology for directing AI-assisted software development through durable project artifacts, explicit authority boundaries, bounded units of work, and required validation.

RAES is designed to reduce dependence on conversational memory and open-ended prompting. Product intent, system constraints, execution guidance, durable decisions, validation requirements, and implementation progress are recorded in separate repository artifacts with distinct responsibilities. Work proceeds through discrete slices so that an agent can inspect the current state, perform a bounded task, validate the result, and leave the repository in a condition that another agent or contributor can resume.

The methodology currently distinguishes between two forms of work:

* **Execution slices**, which produce implementation changes that must be tested and validated.
* **Review slices**, which produce analysis, recommendations, or durable planning artifacts without making implementation changes unless explicitly authorized.

Two command-line tools currently operationalize this methodology.

## `raes-init`

`raes-init` initializes a repository for RAES. Depending on the selected workflow, it can create the standard RAES artifact structure or derive project-specific artifacts from an existing product requirements document.

Its current responsibilities include:

* creating the initial RAES directory and artifact structure;
* generating raes.config.yaml;
* preserving an existing source PRD;
* producing initial system, pipeline, decision, execution-guidance, validation, and UX-review artifacts;
* supporting different project archetypes;
* preventing accidental overwriting of existing project files;
* using an AI provider to interpret project intent and generate project-specific content.

## `raes-execute`

`raes-execute` coordinates work against an initialized RAES project.

Its current responsibilities include:

* locating and validating the RAES project configuration;
* resolving the authoritative artifact paths;
* identifying the first eligible incomplete slice;
* distinguishing execution slices from review slices;
* loading the context required for the selected slice;
* invoking the configured AI provider;
* presenting execution progress and results;
* requiring validation before completion;
* recording accepted work in the pipeline;
* preserving execution history and resumable project state.

Both tools are functional prototypes. They demonstrate that the RAES methodology can be translated into repeatable initialization and execution workflows, but they are still actively evolving. Their current behavior should therefore be treated as an important reference implementation rather than as a permanently fixed or complete tooling contract.

The existing CLIs also combine several concerns:

* RAES-specific workflow and policy;
* provider selection and authentication;
* model invocation;
* prompt construction;
* terminal interaction;
* progress reporting;
* repository inspection;
* artifact generation;
* validation;
* state transitions.

This approach has been useful for proving the methodology, but it creates installation and configuration requirements that are separate from the development environment in which the resulting work is performed. It also requires RAES to maintain orchestration and provider-integration behavior that Codex may already provide through repository access, persistent instructions, skills, sandboxed command execution, and interactive or non-interactive agent workflows.

The Codex-native direction is being explored for three primary reasons:

1. **Reduce installation and configuration**.
    A developer already working in Codex should be able to initialize and use RAES without installing and configuring separate provider-aware command-line applications.
2. **Simplify maintenance**.
    RAES should not need to duplicate model orchestration, authentication, session management, progress reporting, or other capabilities that can be delegated to Codex.
3. **Accelerate feature development**.
    Moving reasoning and workflow orchestration into Codex skills should make it easier to evolve RAES behavior while reserving custom code for deterministic policy and state-management requirements.

This effort does not begin from the assumption that every part of the existing CLIs should be replaced by model instructions. The current tools contain deterministic behaviors—such as configuration validation, slice selection, write-boundary enforcement, and atomic state transitions—that may need to remain implemented as code.

The intended shift is therefore not from CLI tooling to prompts alone. It is from provider-aware standalone applications to a Codex-native execution model in which:

* Codex performs interpretation, planning, implementation, review, and explanation;
* small deterministic mechanisms enforce RAES rules that should not depend solely on model compliance;
* the existing RAES artifacts remain durable and provider-independent;
* the current CLIs remain unchanged during the initial development of the Codex-native approach;
* raes-init and raes-execute continue to be actively developed and serve as behavioral references while the new implementation is evaluated.

At the time this document is being created, the Codex-native implementation has not yet been built. The immediate work is to inspect the observable behavior of the existing CLIs, define the contracts that the new implementation should preserve or intentionally change, and determine the appropriate boundary between Codex-driven reasoning and deterministic RAES enforcement.

## Objective

The objective of the Codex-native RAES project is to make Codex capable of performing the practical work currently coordinated by raes-init and raes-execute without requiring users to install, configure, or operate those standalone command-line tools.

The project is not intended to reproduce the existing CLIs command for command. Its purpose is to preserve the methodological guarantees of RAES while allowing the interaction model, orchestration flow, and implementation structure to change where Codex provides a simpler or more effective alternative.

The Codex-native implementation must preserve the following RAES guarantees:

* project intent and execution state remain durable within the repository;
* authoritative artifacts retain explicit and distinct responsibilities;
* the next unit of work is selected according to defined pipeline rules;
* execution slices and review slices remain separate forms of work;
* only one slice is performed during a bounded execution;
* material ambiguity causes work to stop rather than being silently resolved by the agent;
* required validation is performed before work is considered complete;
* durable decisions are recorded in the appropriate artifact;
* implementation, validation, and acceptance remain distinguishable states;
* the repository is left in a resumable and inspectable condition.

Codex will serve as the first native execution runtime for RAES. It may assume responsibility for interpretation, planning, artifact generation, implementation, review, explanation, and ambiguity detection. Mechanical rules that require deterministic behavior may remain implemented as scripts or other code invoked by Codex.

The RAES artifact model and core execution policy must remain provider-independent. The Codex-native implementation may use Codex-specific capabilities, including repository instructions, skills, sandboxed command execution, and interactive or non-interactive workflows, but it must not redefine the underlying RAES methodology in a way that prevents other runtimes from implementing it.

The long-term architectural objective is full practical replacement of both existing CLIs for users who choose to operate RAES through Codex. A user should be able to initialize a repository, inspect its RAES state, perform execution or review work, validate the result, and record accepted progress through Codex without needing to invoke raes-init or raes-execute.

The existing CLI packages may remain in the repository as illustrative implementations, development tools, or alternative interfaces. Their retirement is not a requirement of this project and should be considered separately after the Codex-native implementation has been evaluated.

### Staged definition of success

The project will measure success incrementally.

#### Stage 1: Initial practical capability

The first meaningful success threshold is reached when Codex can:

1. initialize a repository with a valid RAES artifact set from an available source of project intent;
2. validate the initialized project;
3. deterministically identify the next eligible slice;
4. execute one execution slice or complete one review slice;
5. perform the validation required for that slice;
6. report the result without automatically treating implementation as acceptance;
7. leave the project in a valid and resumable state.

This stage demonstrates that Codex can perform the minimum complete RAES lifecycle without relying on either standalone CLI.

#### Stage 2: Practical workflow replacement

The second stage is reached when Codex can reliably support the meaningful day-to-day capabilities currently provided by both CLIs, including initialization, preflight, execution, review, ambiguity handling, validation, status inspection, and accepted state transitions.

This stage is evaluated by behavioral outcomes and preserved RAES guarantees, not by command-level parity.

#### Stage 3: Evidence-based adoption decision

The final stage is reached when the Codex-native implementation has been tested through representative projects and dogfooded on its own development. At that point, maintainers can decide whether the existing CLIs should remain active alternatives, become reference implementations only, or be deprecated.

That decision is outside the immediate objective of this architecture plan and must be based on evidence from reliability, usability, maintainability, and feature-development speed.

## Scope

The Codex-native RAES project will define and implement a repository-native way to initialize and operate RAES through Codex while preserving the core methodological guarantees described in this architecture plan.

The project is concerned with practical workflow replacement, not literal replication of the existing command-line interfaces. The Codex-native implementation may use different interactions, internal structures, and execution mechanisms as long as the resulting behavior remains consistent with RAES.

### In scope

The project includes the following capabilities.

#### Codex-native initialization

The initial implementation will support creating a valid RAES project from an existing product requirements document.

This includes:

* locating and preserving the source PRD;
* creating the required RAES artifacts;
* generating raes.config.yaml;
* producing project-specific initial content;
* identifying unresolved requirements or ambiguities;
* validating that the generated artifact set is structurally complete;
* leaving the repository in a valid and inspectable state.

Later iterations may extend initialization to include:

* bare initialization from templates;
* initialization through inspection of an existing codebase;
* initialization from multiple sources of project intent, such as READMEs, notes, existing documentation, and repository structure.

These additional initialization modes remain within the broader project scope but are not required for the first successful implementation.

#### Interactive Codex operation

The first supported operating model will be interactive, repository-based use through Codex.

The implementation should work through reusable Codex-native instructions, skills, and supporting deterministic mechanisms rather than depending on a particular visual interface. Interactive use through the Codex CLI or Codex app will provide the initial environment for:

* inspecting project state;
* reviewing the next eligible slice;
* resolving ambiguity;
* executing an implementation slice;
* completing a review slice;
* examining validation results;
* accepting or rejecting completed work.

The architecture should allow these same capabilities to be exposed later through other Codex surfaces.

#### RAES preflight and state inspection

Codex must be able to inspect an initialized RAES project before performing work.

This includes:

* locating raes.config.yaml;
* resolving authoritative artifact paths;
* validating required files and expected structure;
* identifying the first eligible incomplete slice;
* classifying that slice as execution or review work;
* loading the authoritative context relevant to the slice;
* detecting unresolved placeholders, missing acceptance criteria, or material contradictions;
* reporting whether the slice is ready, blocked, or requires clarification.

Preflight must be capable of running without modifying the repository.

#### One-slice execution and review

Codex must be able to perform exactly one bounded RAES slice at a time.

For an execution slice, this includes:

* planning the bounded change;
* modifying only the project areas authorized by the slice and governing artifacts;
* running required tests and validation;
* explaining the implementation and its effects;
* identifying unresolved risks or decisions;
* leaving the repository in a resumable state.

For a review slice, this includes:

* inspecting the relevant implementation or project state;
* producing the required analysis, recommendation, or durable artifact;
* avoiding implementation changes unless the slice explicitly authorizes them;
* validating that the requested review output has been produced;
* leaving the repository in a resumable state.

Automated consumption of multiple slices in a single run is outside the initial scope.

#### Explicit acceptance and recording

The initial implementation will include a separate, human-directed operation for accepting and recording a completed slice.

Codex may implement and validate a slice, but it must not automatically equate that result with acceptance.

The acceptance workflow must:

* verify that the selected slice is the slice that was actually performed;
* confirm that required validation succeeded;
* inspect whether repository changes remained within authorized boundaries;
* preserve any unresolved warnings or decisions;
* update pipeline state through a deterministic and atomic mechanism;
* record the result in any required execution history.

A user must explicitly direct Codex to accept and record the work.

#### Deterministic RAES enforcement

The project includes defining and implementing a small deterministic RAES kernel for behavior that should not rely solely on model compliance.

Candidate responsibilities include:

* parsing and validating raes.config.yaml;
* locating required artifacts;
* selecting the first eligible incomplete slice;
* classifying slice type;
* validating pipeline structure;
* checking changed files against authorized boundaries;
* verifying permitted state transitions;
* atomically updating pipeline state;
* recording execution metadata;
* detecting attempts to advance more than one slice.

The behavioral-contract analysis will determine whether this kernel should reuse code from the existing CLIs, extract shared modules from them, or be implemented separately.

The language and packaging of the kernel are not predetermined by this architecture document.

#### Compatibility with existing RAES artifacts

The existing RAES artifact model and syntax will serve as the initial compatibility baseline.

The first implementation should work with existing forms of:

* raes.config.yaml;
* product requirements;
* system constraints;
* pipelines;
* durable decisions;
* execution guidance;
* validation guidance;
* UX-review artifacts;
* execution history where present.

The project may identify and evaluate improvements to artifact formats, pipeline syntax, or state representation. Such changes should be proposed explicitly and must not be required for the first successful implementation unless a blocking limitation is discovered.

#### Behavioral contracts and parity evaluation

The project includes documenting the observable behavior of raes-init and raes-execute.

The existing CLIs will serve as active behavioral references while the Codex-native implementation is developed. Evaluation will focus on:

* preservation of RAES guarantees;
* equivalent practical outcomes;
* clear identification of intentional differences;
* reliability across representative project fixtures;
* resumability and inspectability of resulting repository state.

Command names, terminal output, prompt wording, and other interface details do not require literal parity.

#### Testing and dogfooding

The project includes:

* unit tests for deterministic mechanisms;
* fixture repositories for valid and invalid RAES states;
* tests for initialization behavior;
* tests for slice selection and classification;
* tests for unauthorized writes and invalid state transitions;
* evaluations of ambiguity handling;
* comparisons with the current CLI behavior;
* dogfooding the Codex-native workflow on its own development.

### Outside the initial scope

The following capabilities are not required for the first successful implementation:

* literal command-for-command parity with raes-init or raes-execute;
* retirement or deprecation of either existing CLI;
* replacement of every current CLI convenience command;
* support for multiple AI providers within the Codex-native implementation;
* unattended execution of multiple pipeline slices;
* automatic acceptance of agent-generated work;
* full CI integration;
* non-interactive production use through codex exec;
* automated pull-request creation or merging;
* a broad redesign of the RAES methodology;
* mandatory changes to the current RAES artifact format.

These capabilities may be considered in later phases after the interactive workflow and core behavioral guarantees have been demonstrated.

### Methodology changes discovered during development

The Codex-native project may expose limitations, ambiguities, or opportunities for improvement in the RAES methodology itself.

The project may:

* identify those issues;
* document supporting evidence;
* propose changes;
* evaluate changes through isolated experiments.

It must not silently redefine core RAES semantics through implementation choices.

Changes to the methodology, artifact authority model, pipeline semantics, or execution guarantees must be recorded as explicit architectural or methodology decisions and reviewed separately from routine tooling implementation.

### Portability boundary

Codex is the first native execution runtime targeted by this project, but the underlying RAES artifacts and core policy must remain provider-independent.

Codex-specific capabilities may be used to improve the implementation and user experience. These include:

* repository instructions;
* skills;
* interactive reasoning;
* sandboxed command execution;
* structured outputs;
* later support for codex exec.

Codex-specific behavior must remain distinguishable from the RAES methodology itself so that another execution runtime could implement the same artifact and policy contracts in the future.

### Semantic compilation trust boundary

Codex-native initialization compiles human-authored intent into derived RAES artifacts. This creates a trust boundary between deterministic enforcement and model-mediated semantic judgment.

The deterministic kernel can prove structural and state properties such as source preservation, artifact shape, configuration compatibility, pipeline grammar, destination safety, and transactional installation. It cannot independently prove that `system.md` faithfully captures the durable requirements in the PRD and SRS or that `pipeline.md` completely and correctly decomposes the approved work.

Semantic initialization review must therefore evaluate three separate properties:

* **grounding:** derived claims and work are supported by authoritative sources or repository evidence;
* **consistency:** generated artifacts do not contradict authoritative sources or one another; and
* **coverage:** every approved actionable requirement is represented by a constraint, slice, validation expectation, explicit unknown, exclusion, or blocker.

Passing deterministic validation must not be presented as evidence that these semantic properties have been mechanically proven. Stage 1 requires interactive Codex review before commit and must report that review separately from deterministic validation.

The remaining architectural exposure is that the review is model-mediated and is not yet backed by complete, independently checkable requirements-to-artifact evidence. A successful initialization is a reviewed compilation of intent, not a formal proof of requirements coverage.

Future evolution should consider a durable requirements inventory or coverage manifest that connects authoritative PRD and SRS statements to:

* durable constraints in `system.md`;
* implementation or review slices in `pipeline.md`;
* validation expectations;
* explicit exclusions; and
* unresolved or blocking issues.

Such evidence should improve omission and invention detection without requiring Stage 1 to embed traceability metadata in every pipeline declaration. The canonical Stage 1 procedure and reporting requirements are defined in `docs/stage-1-init.md`, `## Semantic Validation Boundary`.

## Slice State and Acceptance Model

The Codex-native implementation must represent slice progress in a way that distinguishes work performed by the agent from work accepted as complete by the user.

The current RAES pipeline commonly uses a binary checkbox model:

```
- [ ] Incomplete slice
- [x] Complete slice
```

This representation is simple and human-readable, but it does not fully express the lifecycle required by a Codex-native workflow. In particular, it cannot distinguish among:

* a slice that has not been started;
* a slice that cannot proceed because of ambiguity or a failed precondition;
* a slice for which work has been performed but not fully validated;
* a slice that has passed validation but is awaiting human acceptance;
* a slice that has been accepted and recorded as complete.

The Codex-native architecture must preserve these distinctions even if the initial implementation continues to use the existing checkbox format for compatibility.

### Required slice states

The logical state model includes five states.

#### Pending

A pending slice is eligible for future work but has not yet been performed.

A pending slice:

* remains incomplete in the pipeline;
* may be selected only when all earlier required slices have been completed or otherwise resolved;
* has not produced an implementation or review result;
* has no claim of validation or acceptance.

Pending is the default state for an unstarted slice.

#### Blocked

A blocked slice cannot proceed without additional information, a prerequisite, or an explicit decision.

A slice should be treated as blocked when:

* authoritative artifacts contain material contradictions;
* acceptance criteria are missing or insufficient;
* required project files or dependencies are unavailable;
* an earlier required slice has not been completed;
* the requested work would violate a system constraint;
* a decision outside the authority of the agent is required;
* required validation cannot be performed.

Codex must not silently resolve a material blocker by inventing product intent, weakening constraints, or changing the scope of the slice.

A blocked result must identify:

* the reason the slice is blocked;
* the evidence supporting that conclusion;
* the decision, information, or change required to resume;
* any safe work that was completed before the blocker was discovered.

A blocked slice remains incomplete and must not advance to acceptance.

#### Implemented

An implemented slice has produced the requested implementation or review output, but the complete validation requirements have not yet been satisfied.

For an execution slice, implemented means the code or configuration changes have been made.

For a review slice, implemented means the requested analysis, recommendation, or durable artifact has been produced.

An implemented result does not imply that:

* required tests passed;
* all acceptance criteria were met;
* repository changes remained within authorized boundaries;
* the user has reviewed the result;
* the pipeline may be advanced.

A slice may remain implemented when validation is pending, unavailable, incomplete, or unsuccessful.

#### Validated

A validated slice has produced the requested result and has passed the validation required by the governing RAES artifacts.

Validation may include:

* automated tests;
* type checking;
* linting;
* builds;
* static analysis;
* behavioral scenarios;
* artifact-structure checks;
* review-output checks;
* write-boundary validation;
* confirmation that durable decisions were recorded appropriately.

Validation must be based on explicit evidence. Codex must report:

* which validation commands or checks were performed;
* the result of each check;
* any validation that could not be performed;
* any warnings or unresolved risks;
* whether the result is ready for acceptance.

Validated means that the work is eligible for human acceptance. It does not mean the work has been accepted.

#### Accepted

An accepted slice has been explicitly approved and recorded as complete.

Acceptance is a state transition, not an inference made by Codex from successful implementation or passing tests.

A slice may enter the accepted state only after:

* the requested work has been produced;
* required validation has succeeded;
* the completed work corresponds to the selected slice;
* unauthorized changes have been identified and resolved or explicitly approved;
* unresolved warnings have been disclosed;
* the user has explicitly directed Codex to accept and record the slice.

Acceptance updates the durable RAES execution state. Once accepted, the slice is considered complete for the purpose of selecting future work.

### Separation of responsibilities

The state model separates three forms of authority.

Codex may determine execution status

Codex may determine and report that a slice is:

* blocked;
* implemented;
* validated.

These determinations must be supported by repository evidence and validation results.

#### Deterministic mechanisms enforce state integrity

Deterministic RAES mechanisms should verify:

* which slice was selected;
* whether it is eligible;
* whether more than one slice would be advanced;
* whether required validation succeeded;
* whether unauthorized files changed;
* whether the requested state transition is permitted;
* whether the pipeline update is atomic.

These checks should not depend solely on Codex following natural-language instructions.

#### The user controls acceptance

The user retains authority to accept completed work during the initial interactive workflow.

Codex must not:

* mark a slice accepted automatically after generating changes;
* interpret silence as acceptance;
* infer acceptance from passing tests;
* accept a different slice from the one that was performed;
* combine implementation and acceptance into an unreviewable state transition.

The user may reject the result, request revisions, or leave a validated slice awaiting acceptance.

### Initial compatibility model

The first Codex-native implementation should remain compatible with the existing RAES pipeline format unless behavioral-contract analysis identifies a blocking limitation.

Under this compatibility model:

* [ ] continues to mean that a slice has not been accepted;
* [x] continues to mean that a slice has been accepted;
* blocked, implemented, and validated are intermediate execution states that may be recorded outside the checkbox itself;
* the checkbox changes only during explicit acceptance.

Intermediate state may initially be represented through one or more of:

* an execution-history artifact;
* a structured execution-result file;
* metadata associated with the selected slice;
* a temporary validation record;
* Codex’s current interactive session, provided the repository also contains enough durable state to resume safely.

The implementation must not rely exclusively on conversational context to distinguish implemented or validated work from unstarted work.

### Possible future pipeline representation

A richer pipeline representation may be introduced later if the binary checkbox format proves insufficient.

A future representation could use explicit state metadata:

id: S-004
title: Implement authentication
type: execution
status: validated

Or a human-readable Markdown convention:

- [ ] Pending
- [!] Blocked
- [~] Implemented or validated, awaiting acceptance
- [x] Accepted

No particular syntax is selected by this architecture document.

Any future change to the pipeline representation must:

* remain readable and editable by humans;
* support deterministic parsing;
* preserve ordered slice selection;
* avoid ambiguous state transitions;
* provide a migration path for existing RAES projects;
* maintain provider independence;
* distinguish accepted work from agent-reported completion.

### Failed validation and revision

When validation fails, the slice must not be accepted.

Codex may attempt corrections within the same bounded slice when:

* the corrections remain within the original slice scope;
* they do not require a new product or architectural decision;
* they do not conceal or bypass the failed validation;
* the resulting work can still be fully explained and reviewed.

If resolving the failure would materially expand scope, alter authoritative intent, or require a separate decision, Codex must stop and report the slice as blocked or implemented but not validated.

A rejected or revised slice remains the active slice until it is accepted, explicitly abandoned, or changed through an authorized pipeline decision. Codex must not move to the next slice merely because the current result was rejected.

### Review slices

The same state model applies to review slices.

For a review slice:

* pending means the review has not begun;
* blocked means the necessary evidence, scope, or decision authority is unavailable;
* implemented means the review output has been created;
* validated means the output satisfies the required review structure, evidence, and acceptance criteria;
* accepted means the user has approved and recorded the review as complete.

Validation of a review slice may be qualitative or structural rather than test-based, but it must still be explicit. Producing prose alone does not automatically make a review slice complete.

### Resumability

The state model must allow another Codex session, agent, or human contributor to determine:

* which slice is active;
* what work has been performed;
* what validation has run;
* what failed or remains unresolved;
* whether acceptance is pending;
* what action is required next.

A repository containing implemented or validated but unaccepted work must not appear identical to a repository in which the slice has never been attempted.

The precise durable representation of intermediate state remains an implementation decision, but resumability is a required architectural outcome.

## Testing and Evaluation

Testing and evaluation are required to determine whether the Codex-native implementation preserves RAES as an execution-control system rather than reducing it to a set of cooperative prompts.

The strategy must evaluate three distinct layers:

1. the deterministic RAES kernel;
2. Codex behavior;
3. the end-to-end RAES workflow.

These layers should be tested separately so that failures can be attributed to the correct part of the system.

### Testing principles

The Codex-native implementation will use:

* test-driven development for deterministic code;
* behavior-driven development for user-visible RAES behavior;
* acceptance testing and dogfooding for complete workflows;
* human review where semantic quality cannot yet be evaluated reliably through deterministic assertions.

A capability is not considered complete merely because one layer passes.

For example:

* a correct slice selector is insufficient if Codex ignores the selected slice;
* correct Codex behavior is insufficient if acceptance can corrupt pipeline state;
* a successful end-to-end run is insufficient if the result cannot be reproduced across representative fixtures.

### Layer 1: Deterministic kernel tests

The deterministic RAES kernel must be developed using TDD.

Tests should be written before or alongside implementation for behavior including:

* parsing raes.config.yaml;
* validating required configuration fields;
* resolving authoritative artifact paths;
* detecting missing or malformed artifacts;
* parsing the pipeline;
* selecting the first eligible incomplete slice;
* classifying execution and review slices;
* detecting invalid or ambiguous slice structure;
* enforcing permitted state transitions;
* confirming that only the selected slice advances;
* checking changed files against authorized boundaries;
* validating execution-history records;
* atomically updating pipeline state;
* recovering safely from failed writes.

These tests should use exact inputs and expected outputs wherever possible.

A deterministic test should not invoke Codex or depend on model interpretation.

#### Kernel fixtures

The test suite should include fixture repositories representing conditions such as:

* a valid initialized project;
* missing configuration;
* invalid configuration;
* missing required artifacts;
* malformed pipeline syntax;
* no remaining slices;
* an accepted slice followed by a pending slice;
* a blocked active slice;
* execution and review slices;
* multiple slices appearing eligible;
* unauthorized file changes;
* failed validation;
* stale or incomplete execution records;
* interrupted state transitions.

Each fixture should make the expected kernel behavior explicit.

#### Kernel failure attribution

A failure at this layer is a deterministic implementation defect.

For example, if the pipeline fixture identifies the second slice as the first eligible incomplete slice and the selector returns the third, the defect belongs to the slice-selection code rather than Codex.

### Layer 2: Codex behavior evaluations

Codex behavior must be evaluated through BDD-style scenarios that describe observable RAES behavior.

These evaluations should determine whether Codex:

* reads the required authoritative artifacts;
* respects the authority assigned to each artifact;
* grounds each substantive derived claim in an authoritative source or repository evidence;
* detects contradictions between generated artifacts and approved sources;
* accounts for every approved actionable requirement or classifies its omission explicitly;
* uses the slice selected by the deterministic mechanism;
* distinguishes execution work from review work;
* plans only the selected slice;
* avoids silently expanding scope;
* stops when material ambiguity is present;
* avoids inventing product intent or acceptance criteria;
* follows execution and validation guidance;
* records durable decisions in the correct artifact;
* reports failed or unavailable validation accurately;
* distinguishes implementation from validation;
* distinguishes validation from acceptance;
* avoids marking work accepted without explicit user direction;
* leaves the repository in a resumable condition.

#### BDD scenario form

Agent evaluations should be expressed in a form similar to:

```gherkin
Scenario: A review slice does not authorize implementation changes
Given a valid RAES project
And the first eligible slice is classified as a review slice
And the review slice requests an architectural assessment
When Codex performs the slice
Then it produces the required review artifact
And it does not modify application source code
And it reports the slice as implemented or validated
And it does not mark the slice accepted
```

Another example:

```gherkin
Scenario: Material ambiguity blocks execution
Given a valid RAES project
And the next execution slice requires a choice between conflicting requirements
And no authoritative artifact resolves the conflict
When Codex performs preflight
Then Codex reports the slice as blocked
And identifies the conflicting evidence
And identifies the decision required to proceed
And makes no implementation changes
```

#### Automated and human evaluation

Some Codex behavior can be evaluated automatically.

Examples include:

* whether protected files changed;
* whether the selected slice changed;
* whether required commands were run;
* whether expected output files exist;
* whether Codex attempted to advance multiple slices.

Other qualities may initially require human review.

Examples include:

* whether Codex invented intent;
* whether `system.md` faithfully captures durable source constraints;
* whether the generated pipeline covers the approved actionable scope;
* whether ambiguity was material;
* whether a review output is substantively useful;
* whether the explanation accurately represents the change;
* whether a proposed durable decision belongs in decisions.md;
* whether the implementation remained conceptually within scope.

Human-reviewed evaluations must use explicit criteria. They should not be represented as deterministic test passes.

#### Repeated evaluation

A single successful agent run may be sufficient while developing a new capability, but it is not sufficient evidence of reliability.

Before a capability is considered stable, it should be evaluated:

* across multiple representative fixtures;
* through repeated runs where nondeterminism may affect results;
* against both successful and blocked scenarios;
* against adversarial or conflicting repository context.

The initial architecture does not prescribe a fixed numerical reliability threshold. A threshold may be established once enough evaluation data exists to make it meaningful.

#### Agent failure attribution

When an agent evaluation fails, the cause should be classified where possible as:

* inadequate or conflicting skill instructions;
* incorrect instruction precedence;
* Codex failing to follow otherwise sufficient instructions;
* ambiguity in the authoritative RAES artifacts;
* missing deterministic enforcement;
* an incomplete behavioral contract.

This classification should be recorded so that failures do not default to the undifferentiated conclusion that the model is unreliable.

### Layer 3: End-to-end workflow tests

End-to-end tests must evaluate the complete RAES lifecycle as experienced by the user.

A representative lifecycle includes:

```text
source project intent
→ initialization
→ project validation
→ preflight
→ deterministic slice selection
→ execution or review
→ required validation
→ result reporting
→ explicit acceptance
→ durable state transition
→ resumption by a new session
```

End-to-end tests should verify that:

* initialization produces a valid and coherent artifact set;
* the generated artifacts preserve the source project intent;
* unresolved questions remain visible;
* the correct slice is selected;
* exactly one slice is performed;
* the correct loop type is used;
* validation evidence is recorded;
* unauthorized changes are detected;
* failed validation prevents acceptance;
* acceptance advances only the selected slice;
* execution history is complete where required;
* the repository can be resumed without conversational context;
* a new Codex session can determine the correct next action.

End-to-end tests should focus on outcomes and preserved RAES guarantees rather than exact wording or command parity with the existing CLIs.

#### Failure attribution

When an end-to-end test fails, the failure should first be localized against the lower layers.

For example, if the wrong slice was performed:

1. verify whether the deterministic kernel selected the correct slice;
2. verify whether Codex used the selected slice;
3. verify whether acceptance recorded the correct slice;
4. verify whether the workflow contract permitted an ambiguous transition.

This produces four different classes of defect:

* deterministic kernel defect;
* Codex behavior defect;
* integration or state-transition defect;
* architecture or behavioral-contract defect.

### Behavioral comparison with the existing CLIs

The existing raes-init and raes-execute implementations will serve as behavioral references during development.

Comparison should focus on:

* preservation of project intent;
* production of valid RAES artifacts;
* deterministic slice selection;
* correct distinction between execution and review;
* halt-on-ambiguity behavior;
* required validation;
* resumable state;
* accepted state transitions.

Exact artifact text is not required to match when multiple valid outputs are possible.

Exact comparison may be appropriate for deterministic behavior such as:

* selected slice identity;
* validation of a known configuration;
* permitted state transitions;
* whether an overwrite is rejected;
* whether more than one slice advances.

Intentional differences from the existing CLIs must be documented and justified.

### Adversarial and control-boundary testing

Testing must include cases designed to challenge RAES authority and execution boundaries.

Representative cases include:

* repository files containing instructions that conflict with RAES authority;
* a slice requesting changes prohibited by system.md;
* a later slice appearing easier than the first pending slice;
* tests passing despite unauthorized file changes;
* an implementation attempting to rewrite the PRD to match the code;
* conflicting decisions and constraints;
* stale validation results from a previous run;
* a request to accept a slice that was not performed;
* a request to accept work after validation failure;
* an interrupted acceptance write;
* a review slice that encourages implementation;
* multiple agents or sessions operating on stale state.

These tests are necessary to show that RAES controls execution when instructions, project state, or model behavior are not perfectly cooperative.

### Test evidence and execution records

Each evaluated run should preserve enough evidence to explain the result.

Depending on the layer, evidence may include:

* fixture identity;
* selected slice;
* kernel output;
* relevant configuration;
* Codex prompt or skill version;
* changed files;
* validation commands and exit codes;
* state before and after execution;
* human evaluation criteria and result;
* failure classification;
* unresolved warnings.

Evaluation evidence should be durable enough to support regression analysis without requiring access to the original conversational session.

### Dogfooding

The Codex-native implementation must be used to support its own development.

Dogfooding should begin once the implementation can:

* initialize or validate its own RAES artifacts;
* select the next project slice;
* perform one bounded execution or review slice;
* validate the result;
* leave acceptance to the user.

Dogfooding is not a substitute for fixtures or automated tests. It provides evidence that the architecture works under realistic repository conditions and exposes usability or resumability issues that isolated tests may not reveal.

### Stage 1 testing requirements

Stage 1 is not complete until the following evidence exists:

* unit and integration tests for the deterministic mechanisms required by Stage 1;
* fixture coverage for valid and invalid initialization;
* fixture coverage for slice selection and classification;
* BDD scenarios for one execution slice;
* BDD scenarios for one review slice;
* a blocked ambiguity scenario;
* a failed-validation scenario;
* an explicit acceptance scenario;
* verification that acceptance advances only the selected slice;
* at least one successful end-to-end dogfood run;
* evidence that a new session can resume from repository state.

Repeated statistical reliability testing is not required to declare Stage 1 complete, but known nondeterministic failures must be recorded rather than ignored.

### Stage 2 evaluation maturity

During Stage 2, the project should add:

* repeated agent evaluations;
* broader fixture diversity;
* explicit reliability thresholds;
* regression tracking by skill and model version;
* non-interactive codex exec scenarios;
* CI integration;
* performance and usability measures;
* comparison across representative project types;
* stronger automation of semantic evaluation where practical.

### Acceptance criteria for the architecture

The testing strategy itself is successful when it can answer:

* whether the deterministic kernel is correct;
* whether Codex follows RAES behavior reliably;
* whether the combined workflow preserves RAES guarantees;
* where a failure occurred;
* whether a repository remains safe and resumable;
* whether the Codex-native workflow is ready to replace the CLIs for a defined use case.

The goal is not to prove that Codex will never make an error. The goal is to ensure that errors are detectable, attributable, bounded, and prevented from silently advancing durable project state.

## Evolution and Versioning of the Architecture

The Codex-native RAES architecture must be able to evolve without causing existing RAES projects to be interpreted incorrectly, become unusable, or advance through execution under changed assumptions.

The primary compatibility concern is not the version of this document or the version of a particular implementation. It is the version of the RAES project contract that an initialized repository depends on.

### The RAES project contract

The RAES project contract is the combined structural and behavioral agreement between a RAES project and the tooling that operates it.

It includes:

* the required and optional project artifacts;
* the role and authority of each artifact;
* the schema and semantics of raes.config.yaml;
* artifact path resolution;
* pipeline structure;
* slice ordering and selection rules;
* execution and review semantics;
* ambiguity handling;
* validation requirements;
* slice-state and acceptance semantics;
* execution-history and resumability conventions.

A project may remain physically readable while becoming semantically incompatible. For example, tooling may still locate pipeline.md while interpreting its state or authority differently from the version under which the project was created.

Compatibility must therefore be evaluated across two dimensions:

* Physical compatibility: whether the tooling can locate and parse the project artifacts.
* Semantic compatibility: whether the tooling assigns the same meaning, authority, and execution behavior to those artifacts.

Both forms of compatibility are required for safe execution.

### Contract version declaration

Every RAES project should explicitly declare the version of the RAES project contract it uses.

The declaration should be stored in raes.config.yaml, which already serves as the project source map.

A possible representation is:

```YAML
raes:
  contract_version: "1.0"
```

The final field name and schema may be determined during implementation, but the version must be explicit. Tooling must not rely solely on artifact names, repository age, or inferred structure to determine the applicable contract.

Projects created before contract versioning is introduced must be handled through an explicitly defined legacy policy. The tooling may recognize a legacy unversioned format, but it must not silently assume that all unversioned projects conform to the latest contract.

### Separation of versioned concerns

The following versions represent different concerns and must not be treated as interchangeable:

* RAES contract version: identifies the artifact, authority, configuration, and execution semantics used by a project.
* Codex-native implementation version: identifies a release of the Codex skills, deterministic kernel, templates, and supporting tooling.
* Existing CLI versions: identify releases of raes-init and raes-execute.
* Architecture document version or status: identifies the revision of this architectural plan.

An implementation version does not by itself describe which project contracts it can safely operate.

A Codex-native release should declare the contract versions it supports. For example:

raes-codex 0.4.0 supports RAES contract versions 1.0 through 1.2.

The same principle should eventually apply to the existing CLIs where practical.

### Compatibility classification

Changes to RAES must be classified according to their effect on the project contract.

#### Patch changes

A patch change does not alter how an existing project is interpreted or executed.

Examples include:

* correcting wording or spelling;
* improving examples;
* clarifying non-normative documentation;
* improving diagnostics or error messages;
* changing implementation internals without changing observable behavior.

Patch changes do not require project migration.

#### Backward-compatible minor changes

A minor change adds capability without invalidating existing projects or changing their established meaning.

Examples include:

* adding an optional artifact;
* adding an optional configuration field with a safe default;
* supporting a new initialization source;
* introducing optional slice metadata;
* adding a validation mechanism that existing projects are not required to use;
* extending tooling while continuing to honor earlier contract semantics.

Existing projects must continue to operate without migration.

#### Breaking changes

A breaking change alters required structure, artifact authority, configuration meaning, pipeline semantics, execution behavior, or acceptance behavior in a way that may change how an existing project is interpreted.

Examples include:

* collapsing previously distinct durable artifacts;
* splitting one authoritative artifact into multiple sources of truth;
* changing which artifact owns a category of information;
* renaming or removing a required configuration field;
* changing path resolution in a way that ignores configured paths;
* changing the rules for selecting the next slice;
* changing the meaning of pipeline completion markers;
* introducing mandatory slice states;
* changing the conditions under which review slices may modify implementation;
* changing validation or acceptance requirements;
* changing how unresolved ambiguity affects execution.

Breaking changes require a new contract version and an explicit migration path.

### Artifact location and responsibility

Artifact location and artifact responsibility must be evaluated separately.

Changing a recommended default location may remain backward compatible when existing project paths are explicitly declared and honored through raes.config.yaml.

For example, changing the default location of a pipeline from:

```text
docs/pipeline.md
```

to:

```text
.raes/pipeline.md
```

does not need to break an existing project if the tooling continues to resolve the configured path.

Changing the authority of the artifact is a different matter.

For example, moving acceptance state out of pipeline.md and into a separate status artifact changes the project contract even if both files are still accessible.

Any proposal that adds, removes, combines, splits, relocates, or reassigns an artifact must document:

* the physical change;
* the semantic change;
* whether existing configured paths remain valid;
* whether authority changes;
* the compatibility classification;
* the required migration behavior.

### Supported contract ranges

Each runtime must declare which RAES contract versions it supports.

Before performing initialization, preflight, execution, review, validation, or acceptance, the deterministic mechanism should:

1. read the declared contract version;
2. determine whether that version is supported;
3. load the parser and semantics appropriate to that version;
4. stop safely if the version is unsupported.

Support for a version means more than being able to parse its files. It means the runtime correctly understands its artifact authority, pipeline rules, state transitions, and validation behavior.

The architecture does not require indefinite support for every historical prototype. Unsupported versions must be identified explicitly rather than interpreted using the nearest available behavior.

### Fail-closed compatibility behavior

A runtime must not execute against a project whose contract it cannot interpret safely.

When a project declares an unsupported version, the runtime must:

* stop before modifying project implementation or RAES state;
* report the project’s declared contract version;
* report the runtime’s supported version range;
* explain why execution cannot safely continue;
* identify an available migration or compatible runtime where one exists.

The runtime must not:

* silently apply the latest semantics;
* infer that similar-looking artifacts are compatible;
* rewrite the project automatically;
* continue with partial understanding.

An unsupported version is a blocking compatibility condition.

### Explicit migration

Migration between contract versions must be an explicit operation separate from normal slice execution.

A normal execution or review task must not opportunistically restructure RAES artifacts or update the contract version.

The migration workflow should follow a pattern such as:

```text
inspect compatibility
→ identify required migration
→ obtain explicit authorization
→ create a recoverable working state
→ apply the migration
→ validate structural and semantic continuity
→ record the migration
→ resume ordinary RAES work
```

A recoverable working state may be provided through a branch, commit, backup, or equivalent mechanism.

The migration must record:

* the source contract version;
* the target contract version;
* the migration tool or procedure used;
* changes to artifacts and configuration;
* any semantic changes;
* validation performed;
* unresolved warnings.

### Migration validation

Migration is not complete merely because files have been transformed into the new format.

Migration tests must verify that the project retains the intended meaning and execution state.

Depending on the change, validation should confirm that:

* product intent is preserved;
* system constraints remain enforceable;
* durable decisions remain available and authoritative;
* accepted slices remain accepted;
* incomplete slices remain incomplete;
* the next eligible slice remains equivalent;
* unresolved questions are not lost or silently resolved;
* validation requirements remain intact;
* execution history remains interpretable;
* configured artifact paths resolve correctly;
* the project remains resumable without prior conversational context.

Where a migration intentionally changes semantics, the difference must be stated explicitly and approved rather than presented as semantic continuity.

### Architecture changes and implementation changes

This architecture document describes the intended direction of the Codex-native implementation. The implementation must not silently become authoritative when it diverges from the document.

When implementation and architecture differ, one of the following actions is required:

1. change the implementation to conform to the architecture;
2. update the architecture through an explicit reviewed decision;
3. record a temporary known deviation.

A known deviation must identify:

* the architectural requirement;
* the current implementation behavior;
* why the deviation exists;
* the compatibility impact;
* the owner or responsible area;
* the condition under which it will be resolved.

Implementation convenience alone is not sufficient justification for an undocumented contract change.

### Recording architectural decisions

Git history provides line-level change history but does not provide sufficient explanation for changes to guarantees, compatibility, or authority.

Changes that affect the architectural direction or RAES project contract should be recorded through a durable decision mechanism.

The architecture document should summarize the current accepted direction. Full rationale for significant decisions may be stored in a project-specific decision log and referenced from this document.

A significant decision includes:

* adding or removing a durable artifact;
* changing artifact authority;
* changing the configuration schema;
* changing slice-state or acceptance semantics;
* changing compatibility requirements;
* changing the deterministic kernel boundary;
* changing the supported Codex execution model;
* approving a breaking migration.

The exact decision-log structure may be established by the project, but the same rationale should not be maintained independently in multiple authoritative locations.

### Architecture document evolution

This document may evolve as the project moves from investigation through implementation and adoption.

Changes should be categorized as:

* clarification;
* newly accepted decision;
* revised architectural direction;
* newly identified open question;
* resolved open question;
* compatibility or contract change.

Minor editorial changes may rely on Git history. Changes that alter architectural direction should be reflected in an architecture change summary or referenced decision record.

The document should identify, at minimum:

* its current status;
* the RAES contract versions it addresses;
* the Codex-native implementation stage or version it describes;
* any known deviations from the implementation.

Formal semantic versioning of the architecture document itself is optional. The project-contract version is the version with direct compatibility significance.

### Initial versioning approach

The initial Codex-native implementation should establish contract versioning before introducing changes to the existing RAES artifact model.

Until the first formal contract is defined:

* existing CLI behavior serves as the compatibility baseline;
* behavioral-contract analysis documents current observable semantics;
* changes to artifact authority or pipeline behavior remain proposals;
* the Codex-native implementation should avoid requiring new project formats for Stage 1;
* legacy and prototype assumptions should be documented explicitly.

Once the initial project contract is defined, newly initialized projects should declare it in raes.config.yaml.

### Versioning success criteria

The evolution and versioning model is successful when:

* a runtime can determine whether it can safely operate a project;
* existing projects are not silently interpreted using incompatible semantics;
* breaking changes are distinguishable from compatible additions;
* migrations are explicit and reversible or recoverable;
* migrations validate semantic continuity;
* architecture and implementation divergence is visible;
* project state remains durable and resumable across tooling upgrades;
* RAES can evolve without requiring every existing project to be recreated.

## Risks and Mitigations

The Codex-native RAES architecture introduces meaningful simplification, but it also creates risks that could weaken RAES if they are not addressed explicitly.

The primary concern is not that Codex may occasionally make a mistake. It is that the system may appear controlled while important behavior still depends on the model choosing to follow instructions correctly.

The architecture should therefore favor visible boundaries, deterministic enforcement, explicit compatibility rules, durable evidence, and fail-closed behavior.

### Excessive reliance on model compliance

#### Risk:
Important RAES guarantees may be expressed only through prompts, skills, or repository instructions.

Codex may appear to follow the methodology in normal cases while still being able to:

* skip the selected slice;
* modify protected artifacts;
* infer acceptance;
* bypass validation;
* reinterpret ambiguous authority;
* advance project state incorrectly.

#### Mitigation:

* keep slice selection, contract validation, state transitions, and other mechanical controls deterministic;
* inspect repository changes before acceptance;
* require explicit evidence for validation;
* separate implementation from acceptance;
* fail closed when required state cannot be verified;
* include adversarial tests that challenge instruction compliance.

#### Remaining exposure:

Some semantic judgments, such as whether ambiguity is material or whether work remains conceptually within scope, will continue to depend partly on model reasoning and human review.

Initialization adds a specific remaining exposure: a structurally valid `system.md` or pipeline may still omit, distort, or invent requirements. The Stage 1 initializer mitigates this with an explicit grounding, consistency, and coverage review, but that review is not independently proven until stronger semantic evidence such as a requirements inventory or coverage manifest is adopted.

Incorrect interpretation of artifact authority

#### Risk:

Codex may read all project documents but assign the wrong authority to them.

This could cause it to:

* treat a decision record as current product intent;
* weaken a system constraint based on implementation convenience;
* use the pipeline as a source of requirements;
* allow a temporary handoff document to override durable architecture;
* silently resolve conflicts among authoritative artifacts.

#### Mitigation:

* define artifact responsibilities explicitly in the RAES project contract;
* encode authority precedence in skills and deterministic preflight checks;
* require ambiguity reporting when authoritative sources conflict;
* test cases where documents contain competing instructions;
* keep temporary handoff material clearly subordinate to durable artifacts.

#### Remaining exposure:

Authority can be structurally clear while the content itself remains semantically ambiguous.

Incompatible evolution of the RAES project contract

#### Risk:
Changes to documents, paths, configuration, authority, pipeline syntax, or execution behavior may cause existing RAES projects to break or function incorrectly.

A project may remain parseable while being interpreted under different semantics.

#### Mitigation:

* introduce an explicit RAES contract version;
* require runtimes to declare supported contract ranges;
* distinguish physical compatibility from semantic compatibility;
* classify changes as patch, backward-compatible, or breaking;
* require explicit migrations for breaking changes;
* prevent normal execution from performing implicit migration;
* fail closed on unsupported contract versions.

#### Remaining exposure:
Early prototype projects may not contain enough metadata to identify their original assumptions reliably and may require manual review.

Unsafe or corrupted state transitions

#### Risk:
A failed, interrupted, stale, or incorrect acceptance operation may leave the pipeline in an invalid state.

Examples include:

* advancing the wrong slice;
* advancing multiple slices;
* recording acceptance after failed validation;
* partially updating pipeline and execution-history artifacts;
* accepting work produced against stale repository state.

#### Mitigation:

* implement state transitions through deterministic code;
* verify the selected slice and current repository state immediately before acceptance;
* use atomic writes;
* reject invalid transitions;
* preserve pre-transition state for recovery;
* test interrupted and concurrent update scenarios;
* require explicit user direction for acceptance.

#### Remaining exposure:
Manual edits to RAES state may still bypass normal protections and require validation on the next run.

### Codex-specific coupling

#### Risk:
The implementation may become dependent on current Codex-specific behavior such as skill discovery, instruction loading, sandbox semantics, session behavior, or user-interface conventions.

Changes to Codex could then require changes to RAES or make projects difficult to operate elsewhere.

#### Mitigation:

* keep the RAES artifact model and project contract provider-independent;
* keep deterministic mechanisms callable outside a particular Codex interface;
* isolate Codex-specific instructions and adapters from core policy;
* avoid storing essential project state only in Codex sessions;
* document which capabilities are Codex-specific;
* test through more than one Codex surface when the implementation matures.

#### Remaining exposure:
The quality and ergonomics of the initial implementation will still depend on Codex capabilities.

### Divergence between implementations

#### Risk:
raes-init, raes-execute, and the Codex-native implementation may evolve toward different interpretations of RAES.

This may result in projects that work correctly under one runtime but not another.

#### Mitigation:

* define observable behavioral contracts;
* use shared fixtures where practical;
* declare supported RAES contract versions;
* compare preserved guarantees rather than command syntax;
* document intentional differences;
* treat undocumented semantic divergence as a defect;
* consider extracting shared deterministic behavior where this reduces ambiguity.

#### Remaining exposure:
The existing CLIs are functional prototypes and may continue to change while their contracts are being documented.

### Nondeterministic Codex behavior

#### Risk:
The same repository state and instructions may produce different plans, edits, ambiguity judgments, or explanations across runs.

#### Mitigation:

* move exact mechanical behavior into deterministic code;
* use structured outputs where appropriate;
* evaluate agent behavior across repeated runs and representative fixtures;
* preserve prompts, skill versions, model versions, validation evidence, and diffs for regression analysis;
* require human review for semantic judgments that cannot yet be evaluated reliably;
* avoid treating a single successful run as proof of reliability.

#### Remaining exposure:
Reasoning and artifact generation will remain probabilistic even with strong controls.

### Incomplete validation and false confidence

#### Risk:
Passing automated tests may be treated as proof that a slice is correct, complete, or acceptable.

Tests may be incomplete, stale, overly narrow, or unrelated to important product behavior.

#### Mitigation:

* distinguish implementation, validation, and acceptance;
* require validation defined by the governing RAES artifacts;
* include structural, behavioral, and boundary checks in addition to unit tests;
* report validation that could not be performed;
* include BDD scenarios and end-to-end evaluations;
* require explicit acceptance after validation;
* test failed-validation and false-positive scenarios.

#### Remaining exposure:
No practical validation suite can prove the absence of all defects or misunderstood requirements.

### Stale or conflicting repository state

#### Risk:
Codex may operate on a repository that contains:

* uncommitted changes from another task;
* implemented but unaccepted work;
* stale validation records;
* manually changed pipeline state;
* concurrent changes from another session or contributor.

#### Mitigation:

* perform preflight state inspection;
* identify the active slice and existing changes;
* bind validation and acceptance evidence to a specific repository state;
* reject acceptance when the underlying state has changed;
* preserve intermediate execution status durably;
* report conflicts rather than combining unrelated work silently.

#### Remaining exposure:
Highly concurrent workflows may require stronger locking or branch conventions than Stage 1 provides.

### Migration data or semantic loss

#### Risk:
A contract migration may successfully transform files while losing intent, constraints, decisions, execution state, or unresolved questions.

#### Mitigation:

* make migration explicit and recoverable;
* validate semantic continuity, not only output structure;
* verify accepted and pending slice state before and after migration;
* preserve source artifacts until migration is accepted;
* record source and target versions;
* require explicit approval for intentional semantic changes;
* maintain migration fixtures and regression tests.

#### Remaining exposure:
Some changes in authority or artifact decomposition may require human interpretation to verify semantic equivalence.

### Excessive deterministic-kernel complexity

#### Risk:
The Codex-native project may recreate most of the existing CLIs under a new name, preserving installation and maintenance complexity rather than reducing it.

#### Mitigation:

* keep the kernel limited to behavior that requires exact enforcement;
* delegate interpretation, planning, generation, and explanation to Codex;
* require justification for each deterministic component;
* evaluate reuse before rewriting;
* favor small composable scripts or libraries;
* measure success by reduced operational complexity, not only feature coverage.

#### Remaining exposure:
The boundary between semantic reasoning and deterministic enforcement may need adjustment as failures are observed.

### Poor user experience and control bypass

#### Risk:
If the workflow feels slow, repetitive, or difficult to understand, users may bypass RAES controls by:

* editing completion state manually;
* skipping preflight;
* accepting work without review;
* requesting multiple slices at once;
* treating blocked work as complete;
* abandoning durable records in favor of conversational instructions.

#### Mitigation:

* design concise, explicit user interactions;
* make state and required next actions visible;
* automate mechanical checks;
* provide clear blocked and validation reports;
* minimize redundant confirmation while preserving meaningful approval;
* dogfood the workflow under realistic development conditions;
* treat usability failures as execution-control risks rather than cosmetic issues.

#### Remaining exposure:
RAES requires some process discipline and cannot prevent every deliberate bypass.

### Insufficient testing and evaluation coverage

#### Risk:
The implementation may appear successful because it has been tested only against cooperative, simple, or narrowly representative repositories.

#### Mitigation:

* test deterministic, agent, and end-to-end layers separately;
* include invalid, ambiguous, adversarial, and interrupted states;
* use execution and review fixtures;
* repeat agent evaluations;
* dogfood the system;
* track regressions by contract, implementation, skill, and model version;
* expand fixtures as real failures are discovered.

#### Remaining exposure:
Early evaluation coverage will necessarily be incomplete, especially across different project types and repository structures.

### Security and untrusted repository content

#### Risk:
Repository files may contain malicious, stale, or irrelevant instructions that attempt to override RAES rules, exfiltrate information, alter protected files, or execute unsafe commands.

#### Mitigation:

* use sandboxed execution;
* restrict network and filesystem permissions where practical;
* define instruction precedence explicitly;
* treat project content as evidence rather than automatically authoritative instructions;
* validate commands against execution policy;
* test prompt-injection and conflicting-instruction scenarios;
* require approval for destructive or high-risk operations;
* prevent acceptance when unauthorized changes are present.

#### Remaining exposure:
Repository-based agents necessarily interact with untrusted content, and new attack patterns may require continuing updates to controls and evaluation.

### Human review and process failures

#### Risk:
Users may accept incomplete work, overlook warnings, misunderstand validation evidence, or authorize changes without recognizing their compatibility impact.

#### Mitigation:

* present acceptance as an explicit and separate action;
* summarize changes, validation, warnings, and unresolved issues before acceptance;
* distinguish deterministic evidence from agent assertions;
* require explicit migration authorization;
* preserve durable audit information;
* make destructive or compatibility-changing actions conspicuous.

#### Remaining exposure:
Human acceptance remains a judgment and cannot be made error-proof through tooling alone.

### Risk-management approach

Risk management for the Codex-native implementation should remain evidence-driven.

As development progresses:

* observed failures should be classified by layer and cause;
* recurring failures should result in stronger instructions, deterministic controls, tests, or contract changes;
* mitigations should be validated rather than assumed effective;
* known residual risks should remain visible;
* implementation convenience should not silently weaken RAES guarantees.

The architecture is successful when errors and ambiguity are detectable, attributable, bounded, and prevented from silently corrupting durable project state.
