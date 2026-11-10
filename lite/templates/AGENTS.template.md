# AGENTS.md

Shared guidance for every AI coding agent working in this repository. This file is the single source of truth; provider-specific files (such as `CLAUDE.md`) import it and add only notes specific to that provider.

## Intent
<!-- Two lines: what this repo is for, and what the current work is trying to achieve. Human-owned. -->

## Repo map
<!-- Fill in only what you can verify from the repo. -->

## Done means these checks pass
<!-- Commands that define done, for example: fmt, validate, lint, policy checks, plan. Start small, and add a check after it has shown up in three slices. -->

## Forbidden
- No `apply`, `destroy`, `import` or state-changing commands, and no write calls to cloud APIs. Applies go through CI or a human.
- No edits to `AGENTS.md`, or to intent and invariants anywhere. Propose changes in the handoff note.
<!-- Add environment- or account-specific prohibitions here. -->

## Invariants
<!-- "None yet" is a valid starting state. Add an invariant only when a human promotes a decision. -->
- None yet.

## Unknowns
<!-- Open questions that must not be decided silently. For each one, note what evidence would settle it and which slice will produce that evidence. -->

---

## RAES working rules (all agents)

### Always
- Read `AGENTS.md`, `docs/decisions.md` and the slice entry in `docs/pipeline.md` before acting.
- Define done as runnable checks before changing anything.
- Work exactly one slice, then stop.
- Propose decisions; don't promote them. You may append proposed entries to `docs/decisions.md`.
- Never mark a slice complete without the human's explicit confirmation.

### Scope
- Treat a slice's `scope:` and `out_of_scope:` lines as hard edges.
- Before touching anything outside the declared scope, stop and flag. Don't fix things on the side.
- If a slice declares no scope, state the scope you intend in one line before you start, and flag if the work grows beyond it.

### Flag (stop and ask) when any of these is true
1. The change would alter an invariant or a contract. For infra, that includes module inputs and outputs, naming and tag schemas, and launch configuration inputs.
2. The slice depends on an open Unknown.
3. There are two or more reasonable interpretations, and the choice affects a contract, data, cost, security or user-visible behavior.
4. A plan shows a destroy or replace, or touches IAM, networking, state or shared resources.
5. The work touches an environment or account outside the slice's scope, especially production.
6. The work needs a new dependency, provider or module source.
7. Sources disagree (docs vs. code, or one doc vs. another).
8. A required validation command is missing or can't run.

A flag says what you found, the options you see, and what you need from the human. Then wait.

### Stuck (stop and report) when any of these is true
- The same check has failed after 3 fix attempts.
- Progress needs a decision or information that isn't in the artifacts.
- The environment blocks the work (credentials, access, a missing service).

When stuck, stop trying. Write a handoff note in `docs/pipeline.md` that starts with `BLOCKED:` and lists what you tried, what failed, and what you need. Leave the slice unchecked.
