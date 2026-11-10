# RAES Lite: direction and kit (November 2026)

This is a lighter way to run RAES, packaged as plain files that ride on the agent you already use (Claude Code, Codex or Copilot). It replaces the full upfront setup (seven docs, a config file and a CLI that runs slices) with a small core that **grows as you learn**.

It comes out of a review of RAES against ten recent articles on AI-assisted development, and a trial on one real project. Most of the evidence behind it is agreement among practitioners rather than measured data, so treat it as a set of hypotheses to test.

---

## Why change

Three findings from real use:

1. **Agents follow explicit contracts well and implicit ones only partly.** Agents did well at reading intent first, defining done before coding, and proposing decisions without promoting them. They were only OK at flagging instead of guessing, staying in scope, and stopping when stuck. Those three depend on boundaries nobody had written down.
2. **Full RAES became too opinionated.** On larger projects, the number of files and the rules about which heading belongs in which file created friction. One whole slice went to normalizing RAES's own documents.
3. **You can't know `system.md` and `validation.md` on day one.** Invariants and validation emerge from the work. Requiring them upfront produced guesses that later drifted away from the code.

## Principles (the part that doesn't change)

1. Agents **flag ambiguity; they don't guess**.
2. Agents **propose decisions; humans decide and promote them**.
3. **Define done as runnable checks** before changing anything.
4. **Someone other than the author checks the work.**
5. **Record the why** for decisions that matter.

Everything else (file layout, extra documents, loop step names) is a convention. Add a convention only after you've felt its absence twice.

## Four layers: where each thing belongs

| Layer | What belongs here | Test for placing something |
|---|---|---|
| Prompts | This task's goal and framing | Used once; a mistake is cheap |
| Durable artifacts | Intent, invariants, decisions, conventions, contracts, skills | Must still be true next session |
| Tooling | The definition of done, permissions, gates, caps, independent review | A violation would be costly or irreversible, or a habit keeps getting skipped |
| Habits (yours) | Goals with stopping conditions, writing intent, challenging plans, reading output | Needs judgment |

Things move between layers:
- **Prompt to artifact:** the third time you write the same instruction.
- **Habit to tooling:** when you keep skipping something critical.
- **Artifact to tooling:** when breaking the rule would be costly.

## Grow, don't front-load

- **"Unknown" is a valid answer.** On day one, invariants can be "none yet."
- **Define done per slice first.** When the same check shows up in three slices, promote it to the project level. If you keep forgetting to run it, turn it into a hook.
- **Invariants usually start as decisions.** A recorded decision gets promoted to an invariant once later work depends on it.
- **Start with one file (`AGENTS.md`) plus two small docs.** Split a section into its own file when it gets long or when most tasks don't need it.
- **Use a review slice with a `question:` line when you need knowledge first.** It can run commands and disposable local environments, and its output is knowledge (resolved Unknowns, contracts, proposed decisions), not code you keep.

## The slice contract

Each slice in `docs/pipeline.md` is one line:

```
- [ ] <stable-id> | <execution|review> | <label>
```

IDs are stable and never reused. The type comes from the declaration only, never from the label. Optional body lines, indented under the declaration:
- `scope`: the edges the agent must stay inside
- `out_of_scope`: what it must not touch
- `question`: for review slices, the question the slice must answer with evidence
- `experiment`: a falsifiable prediction, checked and recorded at the end of the slice
- `allowed_paths`: comma-separated path globs the slice may change. `scope` is prose for people; `allowed_paths` is what the scripts check

There are two slice types:
- **Execution** changes code. Tests or checks come first, then the minimum change.
- **Review** changes no tracked code, schema or config. It may run commands, read-only queries and disposable local environments. It may change only the decision log and its `allowed_paths`, and inspection blocks anything else.

What the agent must do, and when it must flag or stop, is defined once in `AGENTS.md`.

## Decision rights

- **Agents propose and humans promote.** Agents may append proposed decisions; only humans change invariants and intent.
- **Rights follow boundaries.** Inside a well-bounded unit with explicit contracts, the agent works with more freedom. Changing a contract, or crossing a boundary, needs a human.
- **Thresholds are set in advance.** Decide before you see a plan which changes are fine to make, which wait for a human, and which are refused.
- **Decisions can be provisional.** Record what evidence would confirm or overturn a decision, then supersede it with a new entry. The log stays append-only.

## Execution

- Slices run inside the agent through the `/raes-slice` skill. `/raes-slice --dry-run` previews a slice without making changes.
- Deterministic checks run from scripts bundled with the skill: `preflight.py` (validate the project and select the slice), `inspect_result.py` (baseline, then compare changes against scope and validation evidence) and `accept_slice.py` (tick the checkbox only after an explicit yes). They need only `python3` and `git`, so every provider can run them.
- **To try later:** a thin coordinator that does only what a single agent can't, such as a fact sheet built from the artifacts, plan checks, threshold gates, a trace log, and dispatch across providers.

## Verification, added in stages

1. A reviewer with a clean context (a subagent) that reads only the slice, the invariants and the diff.
2. A Stop hook that runs the validation commands before the agent can declare the slice done.
3. **Not proven yet:** a reviewer running on a different model. In the one study that tested it, it added nothing measurable. Test it before relying on it.

## Measurement

- Each slice's `experiment:` line records a prediction, and the result goes in its handoff note.
- Where you can, measure against a known answer, such as a test repo seeded with known defects.

## Infrastructure work

- **Never run `apply` or `destroy`.** The agent works with plan-level access only; applies go through CI or a human.
- **"Done" means passing checks:** format, validate, lint, policy checks, and a plan that shows only the intended changes.
- **The agent may loop on plan, never on apply.** Use an iteration cap and work on a branch.
- **Contracts include:**
  - module inputs and outputs
  - image naming and tag schemas
  - launch configuration inputs

  Treat a change to any of these as a contract change: classify it as MAJOR, MINOR or PATCH, list who consumes it, and roll it out as expand, migrate, contract.
- **Find undocumented consumers** in audit logs before changing a contract.
- **Write the intent down** (why this rule or resource exists). An agent that is tidying up can remove an exception that something depends on.

## Open questions

- Do the same rules produce the same behavior across providers? Untested.
- How small should the always-loaded core be?
- Is a schema-validated plan enough, or does enforcement need an executable plan language?
- Does a coordinator add value beyond hooks and skills?

## Layout

```
lite/
  README.md               # this file: direction, principles, slice contract
  bootstrap-prompt.md     # paste into an agent to run S-0000 (orientation) in a new repo
  templates/              # provider-agnostic: AGENTS, pipeline, decisions
  skills/raes-slice/      # SKILL.md in the open Agent Skills format
  adapters/
    claude-code/          # CLAUDE.md template, settings example, install notes
```

The core (README, templates, skill) is meant to work with any provider. Each adapter holds only what one provider needs: its instruction file, its permission settings, and where to install the skill. Whether the core really behaves the same across providers is still untested.

## Using this kit

Copy these into the target repo:

- `templates/AGENTS.template.md` becomes `AGENTS.md`
- `templates/pipeline.template.md` becomes `docs/pipeline.md`
- `templates/decisions.template.md` becomes `docs/decisions.md`
- For your provider, follow its adapter's `README.md` (for example `adapters/claude-code/`)

Then run S-0000 (orientation) using `bootstrap-prompt.md`.

## Design decisions

| ID | Decision | Status | Revisit when |
|---|---|---|---|
| L-001 | Slices use stable IDs: `- [ ] <id> \| <type> \| <label>`, the format the deterministic scripts already parse | accepted | — |
| L-002 | Two slice types (execution, review). Review is widened to allow commands, read-only queries and disposable environments; there is no separate learning type | provisional | A slice first needs throwaway code (a spike) to answer its question |
| L-004 | The pipeline file is frozen during a slice. `accept_slice.py` ticks the checkbox, and the handoff note is written after acceptance (or after a blocked result) | accepted | Handoff notes written after acceptance prove unreliable |
| L-005 | `allowed_paths` (globs the scripts check) is a separate body line from `scope` (prose for people) | accepted | — |
| L-003 | The orientation slice (S-0000) is how RAES is applied to an existing repo. It stands in for the planned `raes-discover` CLI | provisional | Orientation proves too manual to repeat across repos |

## Next steps for the kit

- **Deterministic checks are bundled with the skill.** `skills/raes-slice/scripts/` holds `preflight.py`, `inspect_result.py` and `accept_slice.py`, copied from `projects/raes-codex` and adapted for the lite layout, slice body fields and review-slice path rules. Run their tests from the skill folder: `python3 -m unittest discover -s tests`.
- **Add adapters** for Codex and Copilot.
- **Migrate existing projects** (for example Me Fighter) to stable slice IDs, so the scripts can parse them.
