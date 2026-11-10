# Prompt: set up RAES Lite in a new repo (paste into your agent at the target repo's root)

I'm adopting RAES Lite in this repo. Start by reading `lite/README.md` (or wherever I've put the kit) for the principles and the slice contract.

**Your task: slice S-0000, orientation. Read only, and propose before writing anything.**

1. **Inspect the repo without changing anything:**
   - its layout, modules and environment or account structure
   - how validation runs today (fmt, validate, lint, policy checks, plan) and what CI does
   - any existing contracts: module inputs and outputs, naming or tag conventions, interfaces other systems consume
2. **Draft `AGENTS.md`** from `templates/AGENTS.template.md`. Fill in only what you can verify from the repo; mark anything you're inferring. Leave Invariants as "None yet" and Intent blank. List everything you couldn't determine as Unknowns, each with the evidence that would settle it.
3. **Draft `docs/pipeline.md`** from the template. Keep S-0000 as this slice, and propose 2–3 follow-up slices in the declaration format `- [ ] <id> | <execution|review> | <label>`, each with `scope`, `out_of_scope`, `question` (for review slices) and `experiment` lines. Don't invent goals: ask me for the two-line intent of the current work first.
4. **Create `docs/decisions.md`** from the template, with no entries.
5. **Apply the adapter for this agent** by following `adapters/<provider>/README.md`. For Claude Code, that means creating `CLAUDE.md` and installing the skill at `.claude/skills/raes-slice/SKILL.md`.
6. **Propose permission settings** based on the adapter's example (for Claude Code, `adapters/claude-code/settings.example.json`), adjusted to the tools this repo actually uses.

**Ground rules**
- Never run `apply`, `destroy`, `import`, state commands, image builds, or any command that writes to a cloud account.
- Run `plan` only after I confirm that the credentials in this shell are read-only or plan-only.
- If a Flag condition comes up, stop and ask.

Show me the drafts and a list of your Unknowns. Write the files only after I approve them, then stop.
