# CLAUDE.md

@AGENTS.md

`AGENTS.md` (imported above) is the single source of truth. Keep shared guidance there, so that every agent reads the same rules.

## Notes specific to Claude Code
- To work a slice, run `/raes-slice`. To preview one without making changes, run `/raes-slice --dry-run`.
- `.claude/settings.json` (shared, committed) holds the deny rules. `.claude/settings.local.json` is personal, so don't commit it.
- To confirm `AGENTS.md` loaded, run `/memory`.
