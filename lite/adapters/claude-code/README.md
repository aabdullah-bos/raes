# Claude Code adapter

Everything Claude Code needs beyond the provider-agnostic core in `lite/`.

## Install into a target repo

| From | To |
|---|---|
| `adapters/claude-code/CLAUDE.template.md` | `CLAUDE.md` (it imports `AGENTS.md`) |
| `skills/raes-slice/` | `.claude/skills/raes-slice/` |
| `adapters/claude-code/settings.example.json` | `.claude/settings.json`, after review |

## Use

- `/raes-slice` runs the next slice. `/raes-slice --dry-run` previews it without making changes.
- `/memory` confirms that `AGENTS.md` loaded through the import in `CLAUDE.md`.
- `/permissions` shows which deny rules are active.

## Notes

- Commit `.claude/settings.json` and `.claude/skills/`. Don't commit `.claude/settings.local.json`, which is personal.
- The deny list is only a backstop. For infrastructure work, the real boundary is a plan-only or read-only cloud role for whatever credentials the agent's shell has.
- `settings.example.json` denies `packer build` by default. If you want the agent building images in a sandbox account, loosen that rule deliberately.
- Settings syntax can change between Claude Code versions, so check that the example is accepted after copying it.
