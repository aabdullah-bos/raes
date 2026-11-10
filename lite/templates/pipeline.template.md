# Pipeline

<!--
Slice format (one line per slice, under "## Slice Backlog"):
  - [ ] <stable-id> | <execution|review> | <label>
IDs are stable and never reused (for example S-0001). Use lowercase [x] for accepted slices.

Optional body lines, indented two spaces under the declaration:
  - scope: the edges the agent must stay inside
  - out_of_scope: what it must not touch
  - question: (review slices) the question this slice must answer with evidence
  - experiment: a falsifiable prediction, checked at the end of the slice
  - allowed_paths: comma-separated path globs the slice may change (checked at inspection)

A review slice may run commands, read-only queries and disposable local environments.
It may change only the decision log and its allowed_paths; anything else it creates is removed or kept outside the repo.
The pipeline file itself is not edited during a slice: acceptance ticks the checkbox, and the handoff note is written afterwards.
-->

## Slice Backlog

- [ ] S-0000 | review | Orientation

  - scope: read-only inspection of the repo; draft the Repo map, Done checks and Unknowns for `AGENTS.md`; propose the next 2–3 slices
  - out_of_scope: any change to tracked code, infrastructure or config; any command that writes to a cloud account
  - question: what does this repo contain, how is it validated today, and what is still unknown?
  - experiment: <prediction, for example "the agent flags at least one Unknown rather than inventing a missing contract">

## Handoff Notes

<!-- One section per slice, headed with its ID: what was done, the validation results, flags raised, proposed decisions, whether the experiment's prediction held, and the next recommended slice. Notes that start with BLOCKED: mean the slice is unfinished. -->
