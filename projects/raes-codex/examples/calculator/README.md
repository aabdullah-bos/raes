# RAES Execute Calculator Example

This directory is a small, copyable example for dogfooding the Codex-native `raes-execute` skill. It begins with RAES authority documents and an unchecked pipeline, but no calculator implementation. Running the slices builds a Python command-line calculator that adds and subtracts integers.

The example is intentionally version-control-neutral. You may use it inside a Git repository or as an ordinary directory.

## What the Example Contains

```text
calculator/
├── README.md
├── raes.config.yaml
└── docs/
    ├── prd.md
    ├── system.md
    ├── pipeline.md
    ├── decisions.md
    ├── execution-guidance.md
    └── validation.md
```

The pipeline contains three ordered slices:

1. `CALC-001` implements addition and the initial CLI.
2. `CALC-002` adds subtraction without changing addition.
3. `CALC-003` reviews the completed behavior and test coverage without modifying implementation files.

`raes-execute` selects and performs exactly one unchecked slice per Codex task. Validation and acceptance are separate, and the skill stops after acceptance or rejection.

## Prerequisites

- Python 3
- The ChatGPT desktop app with Codex
- A local checkout containing the Codex-native `raes-execute` skill

## 1. Copy the Example

Copy the entire directory to a location where Codex may modify it:

```sh
cp -R \
  /absolute/path/to/raes/projects/raes-codex/examples/calculator \
  /absolute/path/to/your/sandbox/calculator
```

Replace both absolute paths for your machine. Run the example from the copied directory so the source example remains reusable.

Do not copy a previously executed calculator if you want to begin with `CALC-001`; confirm that every top-level declaration in `docs/pipeline.md` is unchecked.

## 2. Add the Skill to Codex

Codex discovers user-scoped skills under `~/.agents/skills`. On macOS or Linux, create that directory and symlink the skill from your RAES checkout:

```sh
mkdir -p ~/.agents/skills

ln -s \
  /absolute/path/to/raes/projects/raes-codex/skills/raes-execute \
  ~/.agents/skills/raes-execute
```

Use the absolute path to your RAES checkout. Codex supports symlinked skill directories, so edits made while developing `raes-execute` remain available without copying it again.

Open a new Codex task after adding the skill. If `$raes-execute` does not appear, restart the desktop app and open another new task.

## 3. Optionally Check Preflight

Run deterministic preflight without changing the copied project:

```sh
python3 \
  /absolute/path/to/raes/projects/raes-codex/skills/raes-execute/scripts/preflight.py \
  --project-root /absolute/path/to/your/sandbox/calculator
```

For a fresh copy, the JSON should report:

- `status` as `ready`;
- `CALC-001` as the selected slice;
- `execution` as the selected type;
- three pending slices and zero accepted slices.

## 4. Add the Copied Folder as a Codex Project

In the ChatGPT desktop app:

1. Select Codex.
2. If the copied calculator is not listed, click the **+** beside **Projects** and select the copied `calculator` directory.
3. Select the calculator project.
4. Create a **New chat** for a fresh task. On macOS, you can press `Cmd+N`.
5. Choose **Local** under the composer. The example does not require a Git worktree.

## 5. Run the First Slice

Submit this prompt in the new task:

```text
Use $raes-execute on this project. Execute exactly one slice.
```

The skill should:

1. run preflight and select `CALC-001`;
2. read all configured RAES authority documents;
3. capture a filesystem baseline;
4. implement `calculator.py` and `tests/test_calculator.py`;
5. run the slice-specific smoke commands and mandatory unit tests;
6. inspect the resulting project state;
7. report `validated`, `implemented but not validated`, or `blocked`.

The pipeline must remain unchanged during implementation and validation.

## 6. Accept or Reject the Slice

For a validated result, the skill asks:

```text
Accept slice CALC-001 and mark it complete in the pipeline?
```

To accept, respond explicitly:

```text
Accept slice CALC-001 and mark it complete in the pipeline.
```

The skill rechecks the validated state, atomically changes only the `CALC-001` checkbox from `[ ]` to `[x]`, reports acceptance, and stops.

To reject, respond explicitly:

```text
Do not accept CALC-001.
```

Rejection leaves the pipeline unchanged and does not automatically remove implementation files. The skill then stops.

## Continue Through the Example

Start a new Codex task and invoke `$raes-execute` again for each subsequent slice. After `CALC-001` is accepted, the next invocation selects `CALC-002`; after that is accepted, the following invocation selects the `CALC-003` review.

Never ask a single task to run the entire pipeline. The Stage 1 workflow deliberately requires a separate validated result and explicit acceptance for every slice.

## References

- [Codex projects and chats](https://learn.chatgpt.com/docs/projects)
- [Build and use Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [ChatGPT desktop app commands](https://learn.chatgpt.com/docs/reference/commands)
