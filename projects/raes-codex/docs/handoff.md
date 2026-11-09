## Purpose

This handoff document provides Codex with the repository context, authority hierarchy, constraints, required analysis, expected outputs, and stopping conditions necessary to inspect the existing `raes-init` and `raes-execute` implementations and produce behavioral contracts for both tools.

The behavioral contracts are intended to serve as the evidence base for designing the Codex-native RAES tooling described in architecture.md. They must document the full observable behavior of the current CLIs, identify which behavior is deterministic and which behavior is delegated to an AI provider, and distinguish current implementation behavior from the future architectural direction.

The contracts should be primarily descriptive of what the existing tools do today. Where the code, CLI documentation, and architecture.md differ, Codex must identify and classify the inconsistency rather than silently resolving it. The architecture document governs the intended direction of the Codex-native project, while the existing implementation and documentation provide evidence about current behavior.

The analysis must also identify:

* behavior required for the Stage 1 Codex-native implementation;
* behavior relevant only to later stages of practical replacement;
* gaps, ambiguities, and inconsistencies in the current tools;
* behavior that should not be carried forward into the Codex-native implementation;
* assumptions in architecture.md that are unsupported or contradicted by the existing code.

This handoff authorizes analysis and contract creation only. It does not authorize implementation of Codex skills, creation of the deterministic RAES kernel, modification of the existing CLIs, changes to architecture.md, or changes to the RAES methodology or project contract.

## Authority and Document Hierarchy

Codex must interpret the repository using a clear authority hierarchy so that current implementation behavior, intended architectural direction, and task-specific instructions are not conflated.

Different sources are authoritative for different questions. No single document governs both the current behavior of the existing CLIs and the future behavior of the Codex-native implementation.

### Authority hierarchy

For this task, Codex must use the following hierarchy:

1. RAES methodology and current project contract
    Define the underlying RAES concepts, artifact responsibilities, execution loops, validation expectations, and existing project semantics.
2. projects/raes-codex/docs/architecture.md
    Defines the intended architectural direction, scope, compatibility requirements, state model, testing strategy, and constraints for the Codex-native implementation.
3. projects/raes-codex/docs/handoff.md
    Defines the immediate task, required outputs, authorized changes, analysis requirements, and stopping condition for the current Codex session.
4. Existing CLI source code and automated tests
    Define the current implemented behavior of raes-init and raes-execute.
5. Each tool’s Software Requirements Specification
    * projects/raes-init/docs/srs.md
    * projects/raes-execute/docs/srs.md
    These documents provide curated descriptions of the implemented tools, including functional requirements, constraints, gap analyses, and open questions. They are required source material, but their claims must be verified against the source code and tests.
6. Tool-specific PRDs, decisions, system constraints, pipelines, execution guidance, and validation artifacts
    Describe intended behavior, historical decisions, project constraints, current development state, and deferred work for each CLI.
7. README files, archetype documentation, command help, examples, and other user-facing material
    Describe how the tools are presented and expected to be used, but may be incomplete or out of date.
8. Codex analysis and generated behavioral contracts
    Are derived outputs. They do not become authoritative merely because Codex generated them. They must remain traceable to the evidence above and are subject to human review.

### Authority by question

Codex must use the hierarchy according to the question being answered.

#### What should the Codex-native implementation become?

architecture.md is authoritative.

The existing CLIs may provide useful patterns and evidence, but they must not override the architectural direction.

#### What is Codex required to do during this task?

handoff.md is authoritative.

It may narrow the immediate task, prohibit changes, and establish stopping conditions. It must not override architecture.md or redefine RAES.

#### What do the existing CLIs actually do?

The source code and automated tests are authoritative.

The SRS documents, PRDs, READMEs, and other documentation must be checked against the implementation.

#### What were the existing CLIs intended to do?

The tool-specific PRDs, decisions, constraints, pipelines, and other RAES artifacts provide the primary evidence of intent.

Implemented behavior may differ from that intent. Such differences must be documented rather than silently reconciled.

#### How are the tools described to users?

README files, examples, command help, and archetype documentation provide the relevant evidence.

These materials do not override source code when describing actual implemented behavior.

### Treatment of the SRS documents

The SRS documents are high-value descriptive references because they:

* identify the source files and tests inspected;
* describe implemented behavior in a structured form;
* distinguish implementation from PRD intent;
* document deferred capabilities;
* identify known gaps and open questions.

Codex must read both SRS documents in full before writing the behavioral contracts.

The SRS documents must not be copied uncritically. Where an SRS claim is not supported by code or tests, Codex must:

1. determine the implemented behavior from the source code and tests;
2. describe that behavior in the contract;
3. identify the SRS discrepancy explicitly;
4. avoid correcting the SRS unless separately authorized.

### Conflict resolution

Codex must not silently reconcile conflicting sources.

When sources disagree, apply the following rules.

#### Code or tests conflict with an SRS or README

For current implemented behavior:

* source code and tests govern;
* the discrepancy must be recorded;
* the lower-authority document must not be treated as evidence that the behavior exists.

#### Code conflicts with tests

Codex must inspect the relevant execution path and determine whether:

* the test is outdated;
* the implementation is defective;
* the test covers a different condition;
* the behavior is genuinely ambiguous.

The conflict must be reported. Codex must not choose whichever result better fits the future architecture.

#### Current implementation conflicts with architecture.md

Both must be documented:

* the existing implementation defines current behavior;
* architecture.md defines the intended Codex-native direction.

The behavioral contract should identify the difference and classify the current behavior as one of:

* behavior to preserve;
* behavior to adapt;
* behavior not to carry forward;
* behavior requiring an architectural decision.

Codex must not modify the existing implementation or reinterpret the architecture to eliminate the conflict.

#### handoff.md conflicts with architecture.md

architecture.md governs the architectural direction.

Codex must stop and report the conflict because the handoff is not authorized to redefine the architecture.

#### Project artifacts conflict with the RAES methodology or project contract

Codex must report the conflict and determine whether the project represents:

* an intentional documented deviation;
* a legacy format;
* an incomplete implementation;
* a defect;
* an unresolved methodology question.

It must not silently normalize the project to the latest assumed behavior.

### Evidence and traceability

When practical, evidence references should include a repository-relative file path and a function, test name, heading, or line range. A reference to a directory or document without identifying the relevant location is insufficient for a material behavioral claim.

Every material statement in the behavioral contracts should be traceable to one or more of:

* source code;
* automated tests;
* an SRS;
* a tool-specific RAES artifact;
* user-facing documentation;
* an observed CLI behavior, where execution is necessary and safe.

The contracts should distinguish clearly between:

* implemented behavior;
* documented intent;
* inferred behavior;
* known gap;
* open question;
* future architectural requirement.

Inferences must be labeled as such and supported by evidence.

### Limits of authority

This hierarchy does not authorize Codex to:

* change the RAES methodology;
* update the existing CLI implementations;
* correct the SRS documents;
* change architecture.md;
* resolve open architectural questions;
* convert future requiremenvalidatoin.mdts into claims about current behavior;
* treat generated behavioral contracts as self-validating.

The purpose of the hierarchy is to make the resulting contracts accurate, reviewable, and useful as inputs to later design and implementation work.

## Task

Inspect the current implementations of raes-init and raes-execute and produce a behavioral contract for each tool.

The contracts must describe the observable behavior of the existing CLIs as implemented today. They must not define the future Codex-native implementation directly, but they must identify how current behavior relates to the architectural requirements in projects/raes-codex/docs/architecture.md.

For each tool, Codex must:

1. inspect the source code, automated tests, SRS, RAES project artifacts, and relevant user-facing documentation;
2. identify the tool’s inputs, outputs, workflows, state changes, validation behavior, errors, and failure conditions;
3. distinguish deterministic behavior from behavior delegated to an AI provider;
4. identify behavior enforced by code, behavior enforced only through model instructions, and behavior described but not implemented;
5. document differences among the implementation, tests, SRS, PRD, README, and other relevant artifacts;
6. classify current behavior as:
    * required for the Stage 1 Codex-native implementation;
    * relevant to a later stage;
    * useful reference behavior that does not need to be preserved;
    * behavior that conflicts with or requires adaptation under architecture.md;
7. identify unresolved questions that must be answered before implementation begins.

The analysis must cover the complete observable capability of both CLIs, not only the subset required for Stage 1. The contracts should nevertheless make the Stage 1 requirements easy to identify.

This task is complete when Codex has created both behavioral contract documents, validated them against the available implementation evidence, and reported any unresolved conflicts or unsupported architectural assumptions.

Codex must not begin implementation of the Codex-native tooling as part of this task.

## Required Sources

Codex must inspect the following sources before writing either behavioral contract.

### Codex-native architecture

* projects/raes-codex/docs/architecture.md

This document defines the intended direction, scope, compatibility requirements, state model, testing strategy, and constraints for the future Codex-native implementation.

### `raes-init`

Read, at minimum:

* docs/raes-reference.md
* projects/raes-init/docs/srs.md
* projects/raes-init/src/
* projects/raes-init/tests/
* projects/raes-init/docs/prd-ux-review.md
* projects/raes-init/docs/prd.md
* projects/raes-init/docs/system.md
* projects/raes-init/docs/decisions.md
* projects/raes-init/docs/pipeline.md
* projects/raes-init/docs/validation.md
* projects/raes-init/docs/execution-guidance.md
* projects/raes-init/README.md
* projects/raes-init/package.json
* projects/raes-init/tsconfig.json
* archetypes/

### `raes-execute`

Read, at minimum:

* docs/raes-reference.md
* projects/raes-execute/docs/srs.md
* projects/raes-execute/src/
* projects/raes-execute/tests/
* projects/raes-execute/docs/prd.md
* projects/raes-execute/docs/system.md
* projects/raes-execute/docs/decisions.md
* projects/raes-execute/docs/pipeline.md
* projects/raes-execute/docs/validation.md
* projects/raes-execute/docs/execution-guidance.md
* projects/raes-execute/README.md
* projects/raes-execute/raes.config.yaml
* projects/raes-execute/src/prompts/
* projects/raes-execute/package.json
* projects/raes-execute/tsconfig.json

### Shared RAES material

Codex must also inspect any top-level RAES documentation or configuration referenced by either tool, including:

* the canonical RAES methodology or reference document;
* shared artifact definitions;
* workspace configuration examples;
* top-level README material that describes the relationship among RAES tools.

If a listed source does not exist, Codex must record that absence rather than substituting an assumed equivalent.

Codex may inspect additional files when they are necessary to verify behavior, but it must not omit the sources listed above without explaining why they are irrelevant.

## Required Outputs

Codex must create the following two behavioral contract documents:

* projects/raes-codex/docs/contracts/raes-init-contract.md
* projects/raes-codex/docs/contracts/raes-execute-contract.md

Each contract must describe the observable behavior of the corresponding CLI and distinguish current implementation behavior from future Codex-native requirements.

The contracts are descriptive inventories, not parity commitments. Every current capability must be documented, but only capabilities classified as required, adapted, or intentionally preserved become candidates for Codex-native implementation.

At minimum, each contract must include:

### 1. Purpose and scope

Describe:

* what the tool does;
* what it does not do;
* the role it plays within RAES;
* the boundaries of the behavior covered by the contract.

### 2. Inputs and invocation

Document:

* command syntax;
* required and optional arguments;
* environment variables;
* configuration files;
* workspace inputs;
* provider requirements;
* relevant defaults;
* invalid input behavior.

### 3. Outputs and side effects

Document:

* files created or modified;
* terminal output;
* exit codes;
* execution records;
* state transitions;
* provider calls or subprocesses;
* conditions under which no changes are made.

### 4. Primary workflows

Describe each meaningful workflow in execution order.

For raes-init, this includes at least:

* bare initialization;
* initialization from an existing PRD;
* provider-backed generation;
* non-provider generation;
* artifact validation;
* create-or-fail behavior;
* workspace registration.

For raes-execute, this includes at least:

* configuration and artifact validation;
* status and inspection operations;
* next-slice selection;
* execution-slice routing;
* review-slice routing;
* provider invocation;
* validation and preflight;
* operator confirmation;
* slice completion recording.

### 5. Deterministic and model-dependent behavior

Classify behavior as:

* enforced deterministically by code;
* delegated to an AI provider;
* enforced only through prompt or model instructions;
* dependent on human confirmation;
* described in documentation but not implemented.

The contract must identify where an apparent RAES guarantee depends on model compliance rather than code enforcement.

### 6. Preconditions, invariants, and failure behavior

Document:

* required repository state;
* required files and configuration;
* protected artifact boundaries;
* write guarantees;
* validation gates;
* halt conditions;
* partial-failure behavior;
* recovery behavior;
* known cases where the implementation fails open or relies on convention.

### 7. Observable command and interface behavior

Document each supported command or operation, including:

* inputs;
* outputs;
* side effects;
* exit behavior;
* errors;
* whether the capability is complete, partial, deferred, or stubbed.

Literal reproduction of help text is not required unless the exact text forms part of the behavior.

### 8. Evidence and traceability

Material claims must reference the evidence supporting them, such as:

* source file and relevant function;
* automated test;
* SRS section;
* PRD or decision;
* README or help output;
* observed CLI execution where necessary.

The contract should make clear whether each claim is:

* verified by code;
* verified by tests;
* documented but not verified;
* inferred;
* unresolved.

### 9. Discrepancies and gaps

Identify differences among:

* source code;
* tests;
* SRS;
* PRD;
* decisions and constraints;
* README and user-facing documentation;
* the future direction in architecture.md.

Each discrepancy should state:

* the conflicting sources;
* the current implemented behavior;
* the documented or intended behavior;
* whether the difference is a defect, deferred capability, documentation error, intentional deviation, or unresolved issue.

### 10. Codex-native relevance

Classify each meaningful capability as:

* required for Stage 1;
* relevant to a later stage;
* useful reference behavior that need not be preserved;
* behavior that should be adapted;
* behavior that should not be carried forward;
* behavior requiring an architectural decision.

This classification must not rewrite the current contract as a future design specification.

### 11. Open questions

List unresolved questions that cannot be answered from the available evidence.

For each question, identify:

* why it matters;
* what sources were inspected;
* what decision or additional evidence is required;
* whether it blocks Stage 1 implementation.

### 12. Contract summary

End each document with a concise summary of:

* the tool’s essential behavioral guarantees;
* the deterministic behaviors that may be reusable;
* the provider-dependent behaviors that should move into Codex;
* the most important gaps or risks;
* the behavior required for Stage 1.

Codex may choose a different internal heading structure if all required content is present, clearly organized, and easy to compare across the two contract documents.

## Constraints and Validation

Codex must perform this task as a bounded analysis and documentation exercise. It may inspect the repository, run safe read-only commands, and execute the existing automated tests where useful to verify behavior.

### Authorized changes

Codex may create or modify only:

* projects/raes-codex/docs/contracts/raes-init-contract.md
* projects/raes-codex/docs/contracts/raes-execute-contract.md

Codex may also create temporary local files needed for analysis, provided they are not committed and are removed before the task is complete.

### Prohibited changes

Codex must not:

* modify source code or tests in projects/raes-init;
* modify source code or tests in projects/raes-execute;
* change either tool’s PRD, system constraints, decisions, pipeline, execution guidance, validation guidance, SRS, README, or configuration;
* modify projects/raes-codex/docs/architecture.md;
* modify this handoff document;
* implement Codex skills;
* implement or select the language for the deterministic RAES kernel;
* change the current RAES artifact model or project contract;
* resolve architectural questions through implementation;
* advance or complete any existing RAES pipeline slice;
* perform migrations;
* install new dependencies unless strictly required to run the repository’s existing validation and explicitly approved;
* make network-dependent provider calls to test live AI behavior.

### Analysis constraints

Codex must:

* distinguish observed behavior from documented intent;
* verify SRS claims against source code and tests;
* avoid treating future architecture requirements as current CLI behavior;
* label inferences explicitly;
* report missing evidence rather than inventing a conclusion;
* preserve meaningful differences between the two tools;
* describe partial, deferred, and stubbed behavior accurately;
* inspect failure and no-write paths, not only successful workflows;
* identify where guarantees depend on provider or model compliance;
* identify where human confirmation is part of the behavior;
* avoid recommending implementation details that are not necessary to complete the contracts.

Codex should not reproduce large sections of existing documents verbatim. The contracts must synthesize the evidence into precise behavioral descriptions.

### Validation requirements

Before considering either contract complete, Codex must validate it against the repository evidence.

At minimum, Codex must:

1. inspect the source files responsible for every primary workflow described;
2. inspect the automated tests relevant to those workflows;
3. compare the implementation with the corresponding SRS;
4. compare the implementation with the tool’s PRD and durable decisions;
5. verify all claims about files written, state changed, exit behavior, and failure handling;
6. identify unsupported or contradictory claims;
7. confirm that Stage 1 relevance classifications align with architecture.md;
8. verify that no prohibited repository files were modified.

Where practical, Codex should run the existing test suites for both tools.

Test execution must use the project’s existing commands and dependencies. If tests cannot be run, Codex must report:

* the command attempted;
* the reason it could not run;
* which contract claims remain unverified as a result.

A passing test suite does not replace source inspection. Tests demonstrate covered behavior but may not describe every implemented path.

### Contract review checklist

Before stopping, Codex must confirm that each contract:

* covers every implemented workflow, command, mode, and state transition that changes observable behavior, writes or modifies files, invokes a provider, depends on human confirmation, affects exit status, or is explicitly documented as supported, partial, deferred, or stubbed;
* distinguishes documenting current behavior from committing to preserve or reimplement it; inclusion in the contract does not imply that the Codex-native tooling must reproduce that capability;
* distinguishes deterministic, model-dependent, and human-controlled behavior;
* identifies complete, partial, deferred, and stubbed capabilities;
* includes failure and no-change behavior;
* identifies discrepancies among code, tests, SRS, PRD, and documentation;
* classifies Codex-native relevance without redefining current behavior;
* identifies unresolved Stage 1 blockers;
* contains evidence traceable to repository sources;
* does not claim unsupported guarantees;
* is understandable without access to the original ChatGPT conversation.

### Repository validation

After creating the contracts, Codex must inspect the final repository diff.

The diff must contain only the two required contract documents unless an additional change has been explicitly authorized.

If any unrelated or prohibited change is present, Codex must:

1. stop;
2. identify the unexpected change;
3. avoid modifying or discarding user-authored work without authorization;
4. report that the task cannot be considered complete until the repository state is resolved.

### Reporting unresolved issues

Codex must not resolve material conflicts or architectural questions merely to make the contracts appear complete.

Unresolved issues must be recorded in the relevant contract and summarized in the final report.

An issue should be identified as blocking when it prevents a reliable Stage 1 behavioral requirement from being defined or verified.

## Stopping Condition

Codex must stop when both behavioral contract documents have been created, validated against the required repository evidence, and reviewed against the constraints in this handoff.

Before stopping, Codex must confirm that:

* projects/raes-codex/docs/contracts/raes-init-contract.md exists;
* projects/raes-codex/docs/contracts/raes-execute-contract.md exists;
* each contract covers every implemented workflow, command, mode, and state transition that changes observable behavior, writes or modifies files, invokes a provider, depends on human confirmation, affects exit status, or is explicitly documented as supported, partial, deferred, or stubbed;
* each contract distinguishes documenting current behavior from committing to preserve or reimplement it;
* each contract separates deterministic behavior, model-dependent behavior, human-controlled behavior, documented intent, and unimplemented capability;
* discrepancies among code, tests, SRS documents, RAES artifacts, and user-facing documentation are identified;
* Stage 1 relevance is classified without turning the contracts into implementation specifications;
* unresolved questions and unsupported architectural assumptions are recorded;
* the existing validation commands were run where practical, or any unverified claims are clearly identified;
* the final repository diff contains only the two authorized contract documents.

Codex must then provide a concise final report containing:

* the two files created;
* the validation performed;
* the most important discrepancies discovered;
* any questions that block Stage 1 implementation;
* any assumptions in architecture.md that require review;
* confirmation that no implementation work was started.

Codex must not proceed to:

* design or implement Codex skills;
* create the deterministic RAES kernel;
* select implementation languages or packaging;
* modify raes-init or raes-execute;
* update architecture.md;
* change the RAES methodology or project contract;
* create implementation slices unless separately authorized;
* begin the next phase merely because the contracts are complete.

Completion of this handoff means the behavioral evidence has been documented and is ready for human review. It does not authorize implementation of the Codex-native tooling.