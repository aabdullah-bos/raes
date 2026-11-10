# Pipeline

## Slice Backlog

<!--
Each slice can declare:
  - type: execution | review | learning
  - scope: the edges the agent must stay inside
  - out_of_scope: what it must not touch
  - experiment: a falsifiable prediction, checked at the end of the slice
A learning slice produces knowledge (resolved Unknowns, contracts, proposed decisions), not code you keep.
-->

- [ ] Slice 0: Orientation (learning)
  - type: learning
  - scope: read-only inspection of the repo; draft the Repo map, Done checks and Unknowns for `AGENTS.md`; propose the next 2–3 slices
  - out_of_scope: any change to code or infrastructure; any command that writes to a cloud account
  - experiment: <prediction, for example "the agent flags at least one Unknown rather than inventing a missing contract">

## Handoff Notes

<!-- One section per slice: what was done, the validation results, flags raised, proposed decisions, whether the experiment's prediction held, and the next recommended slice. Notes that start with BLOCKED: mean the slice is unfinished. -->
