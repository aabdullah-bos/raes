from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from helpers import error_codes, initialize_git, run_git


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from inspect_result import capture_baseline, inspect_result  # noqa: E402
from preflight import preflight_project  # noqa: E402


REVIEW_PIPELINE = """# Pipeline

## Slice Backlog

- [ ] S-0001 | review | Orientation

  - scope: read-only inspection; draft notes for AGENTS.md
  - out_of_scope: any change to tracked code
  - question: how is this repo validated today?
  - experiment: the agent flags at least one Unknown
  - allowed_paths: notes/**, `docs/orientation.md`

- [ ] S-0002 | execution | Add subtraction

  Implement subtraction.

## Handoff Notes
"""


def passed_validation() -> list[dict]:
    return [{"command": "true", "source": "AGENTS.md", "exit_code": 0, "result": "passed", "output": ""}]


def make_lite_project(root: Path, pipeline: str = REVIEW_PIPELINE) -> Path:
    project = root / "project"
    (project / "docs").mkdir(parents=True)
    (project / "src").mkdir()
    (project / "AGENTS.md").write_text("# AGENTS.md\n\n## Intent\n")
    (project / "docs" / "pipeline.md").write_text(pipeline)
    (project / "docs" / "decisions.md").write_text("# Decisions\n")
    (project / "src" / "calculator.py").write_text("def add(a, b):\n    return a + b\n")
    return project


class LitePreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_lite_layout_is_ready_without_config(self) -> None:
        result = preflight_project(make_lite_project(self.root))
        self.assertEqual("ready", result["status"], result.get("errors"))
        self.assertEqual("lite", result["layout"])
        self.assertIsNone(result["config_path"])
        self.assertEqual(
            {"agents": "AGENTS.md", "next_slice": "docs/pipeline.md", "durable_decisions": "docs/decisions.md"},
            result["artifacts"],
        )
        self.assertEqual("S-0001", result["slice"]["id"])
        self.assertEqual("review", result["slice"]["type"])

    def test_lite_layout_requires_decisions_file(self) -> None:
        project = make_lite_project(self.root)
        (project / "docs" / "decisions.md").unlink()
        result = preflight_project(project)
        self.assertEqual("blocked", result["status"])

    def test_body_fields_are_parsed(self) -> None:
        fields = preflight_project(make_lite_project(self.root))["slice"]["fields"]
        self.assertEqual("read-only inspection; draft notes for AGENTS.md", fields["scope"])
        self.assertEqual("any change to tracked code", fields["out_of_scope"])
        self.assertEqual("how is this repo validated today?", fields["question"])
        self.assertEqual("the agent flags at least one Unknown", fields["experiment"])
        self.assertEqual(["notes/**", "docs/orientation.md"], fields["allowed_paths"])

    def test_slice_without_fields_has_empty_fields(self) -> None:
        pipeline = REVIEW_PIPELINE.replace("- [ ] S-0001", "- [x] S-0001")
        result = preflight_project(make_lite_project(self.root, pipeline))
        self.assertEqual("S-0002", result["slice"]["id"])
        self.assertEqual({}, result["slice"]["fields"])

    def test_duplicate_field_blocks(self) -> None:
        pipeline = REVIEW_PIPELINE.replace(
            "  - question: how is this repo validated today?\n",
            "  - question: how is this repo validated today?\n  - question: again?\n",
        )
        result = preflight_project(make_lite_project(self.root, pipeline))
        self.assertIn("DUPLICATE_SLICE_FIELD", error_codes(result))

    def test_allowed_paths_escaping_project_blocks(self) -> None:
        pipeline = REVIEW_PIPELINE.replace("notes/**, `docs/orientation.md`", "../outside/**")
        result = preflight_project(make_lite_project(self.root, pipeline))
        self.assertIn("ALLOWED_PATH_ESCAPES_PROJECT", error_codes(result))

    def test_empty_allowed_paths_entry_blocks(self) -> None:
        pipeline = REVIEW_PIPELINE.replace("notes/**, `docs/orientation.md`", "notes/**, ")
        result = preflight_project(make_lite_project(self.root, pipeline))
        self.assertIn("INVALID_ALLOWED_PATHS", error_codes(result))

    def test_no_config_and_no_agents_file_is_missing_config(self) -> None:
        project = make_lite_project(self.root)
        (project / "AGENTS.md").unlink()
        self.assertIn("MISSING_CONFIG", error_codes(preflight_project(project)))


class ReviewSliceInspectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = make_lite_project(Path(self.temp.name))
        initialize_git(self.project)
        self.preflight = preflight_project(self.project)
        self.baseline = capture_baseline(self.project)

    def inspect(self) -> dict:
        return inspect_result(self.project, self.baseline, self.preflight, passed_validation(), scope_decision="in_scope")

    def test_review_slice_changing_tracked_code_is_blocked(self) -> None:
        calculator = self.project / "src" / "calculator.py"
        calculator.write_text(calculator.read_text() + "# changed\n")
        result = self.inspect()
        self.assertEqual("blocked", result["status"])
        self.assertIn("REVIEW_SLICE_CHANGED_UNPERMITTED_PATH", error_codes(result))

    def test_review_slice_leaving_untracked_file_is_blocked(self) -> None:
        (self.project / "scratch.sql").write_text("select 1;\n")
        self.assertIn("REVIEW_SLICE_CHANGED_UNPERMITTED_PATH", error_codes(self.inspect()))

    def test_review_slice_may_change_decisions_and_allowed_paths(self) -> None:
        decisions = self.project / "docs" / "decisions.md"
        decisions.write_text(decisions.read_text() + "| D-001 | proposed |\n")
        (self.project / "notes").mkdir()
        (self.project / "notes" / "findings.md").write_text("findings\n")
        (self.project / "docs" / "orientation.md").write_text("orientation\n")
        result = self.inspect()
        self.assertEqual("validated", result["status"], result.get("errors"))
        self.assertIn("notes/**", result["scope_review"]["allowed_path_patterns"])

    def test_declared_allowed_paths_feed_execution_warnings(self) -> None:
        pipeline = self.project / "docs" / "pipeline.md"
        pipeline.write_text(
            REVIEW_PIPELINE.replace("- [ ] S-0001 | review |", "- [ ] S-0001 | execution |").replace(
                "notes/**, `docs/orientation.md`", "src/**"
            )
        )
        run_git(self.project, "commit", "-qam", "execution slice")
        preflight = preflight_project(self.project)
        baseline = capture_baseline(self.project)
        calculator = self.project / "src" / "calculator.py"
        calculator.write_text(calculator.read_text() + "# changed\n")
        result = inspect_result(self.project, baseline, preflight, passed_validation(), scope_decision="in_scope")
        self.assertEqual("validated", result["status"], result.get("errors"))
        self.assertEqual([], result["scope_review"]["warnings"])


if __name__ == "__main__":
    unittest.main()
