from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from helpers import copy_fixture, error_codes, initialize_git, run_git


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from inspect_result import capture_baseline, inspect_result  # noqa: E402
from preflight import preflight_project  # noqa: E402


def passed_validation() -> list[dict]:
    return [
        {
            "command": "python -m unittest",
            "source": "docs/validation.md",
            "exit_code": 0,
            "result": "passed",
            "output": "OK",
        }
    ]


class InspectResultTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = copy_fixture(Path(self.temp.name))
        initialize_git(self.project)
        self.preflight = preflight_project(self.project)
        self.baseline = capture_baseline(self.project)

    def inspect(
        self,
        validation: list[dict] | None = None,
        *,
        allowed_paths: list[str] | None = None,
        scope_decision: str = "unreviewed",
    ) -> dict:
        return inspect_result(
            self.project,
            self.baseline,
            self.preflight,
            validation if validation is not None else passed_validation(),
            allowed_paths=allowed_paths or [],
            scope_decision=scope_decision,
        )

    def test_modified_and_added_files_are_classified(self) -> None:
        calculator = self.project / "src" / "calculator.py"
        calculator.write_text(calculator.read_text() + "\n# modified\n")
        added = self.project / "src" / "subtract.py"
        added.write_text("def subtract(a, b):\n    return a - b\n")
        run_git(self.project, "add", "src/subtract.py")
        result = self.inspect(allowed_paths=["src/**"])
        self.assertIn("src/calculator.py", result["changes"]["modified"])
        self.assertIn("src/subtract.py", result["changes"]["added"])

    def test_deleted_and_untracked_files_are_classified(self) -> None:
        (self.project / "src" / "calculator.py").unlink()
        (self.project / "notes.txt").write_text("untracked\n")
        result = self.inspect()
        self.assertIn("src/calculator.py", result["changes"]["deleted"])
        self.assertIn("notes.txt", result["changes"]["untracked"])

    def test_rename_is_classified_by_matching_content(self) -> None:
        source = self.project / "src" / "calculator.py"
        target = self.project / "src" / "arithmetic.py"
        source.rename(target)
        result = self.inspect()
        self.assertIn(
            {"from": "src/calculator.py", "to": "src/arithmetic.py"},
            result["changes"]["renamed"],
        )

    def test_pre_existing_working_tree_changes_are_preserved_in_baseline(self) -> None:
        project = copy_fixture(Path(self.temp.name) / "preexisting")
        initialize_git(project)
        guidance = project / "docs" / "execution-guidance.md"
        guidance.write_text(guidance.read_text() + "\nPre-existing note.\n")
        baseline = capture_baseline(project)
        (project / "src" / "calculator.py").write_text("changed after baseline\n")
        result = inspect_result(
            project,
            baseline,
            preflight_project(project),
            passed_validation(),
            allowed_paths=["src/**"],
        )
        paths = {entry["path"] for entry in result["pre_existing_conditions"]}
        self.assertIn("docs/execution-guidance.md", paths)
        self.assertNotIn("docs/execution-guidance.md", result["changes"]["modified"])

    def test_non_git_project_uses_filesystem_baseline_and_added_classification(self) -> None:
        project = copy_fixture(Path(self.temp.name) / "non-git")
        preflight = preflight_project(project)
        baseline = capture_baseline(project)

        self.assertEqual("baseline", baseline["status"])
        self.assertEqual("none", baseline["repository"]["version_control"])
        self.assertIsNone(baseline["repository"]["git_root"])
        self.assertIsNone(baseline["repository"]["git_head"])
        self.assertEqual([], baseline["repository"]["git_status"])

        calculator = project / "src" / "calculator.py"
        calculator.write_text(calculator.read_text() + "\n# modified outside version control\n")
        (project / "src" / "subtract.py").write_text("def subtract(a, b):\n    return a - b\n")
        result = inspect_result(
            project,
            baseline,
            preflight,
            passed_validation(),
            allowed_paths=["src/**"],
            scope_decision="in_scope",
        )

        self.assertEqual("validated", result["status"])
        self.assertIn("src/calculator.py", result["changes"]["modified"])
        self.assertIn("src/subtract.py", result["changes"]["added"])
        self.assertEqual([], result["changes"]["untracked"])
        self.assertIsNone(result["git_head"])

    def test_passed_validation_and_scope_attestation_produce_validated_evidence(self) -> None:
        result = self.inspect(scope_decision="in_scope")
        self.assertEqual("validated", result["status"])
        self.assertTrue(result["validation_complete"])
        self.assertTrue(result["pipeline_unchanged"])
        self.assertTrue(result["scope_review"]["requires_human_judgment"])
        self.assertEqual("in_scope", result["scope_review"]["decision"])

    def test_unreviewed_scope_does_not_claim_validation(self) -> None:
        result = self.inspect()
        self.assertEqual("ready_for_review", result["status"])
        self.assertFalse(result["scope_review"]["deterministically_proven"])

    def test_failed_required_validation_prevents_validation(self) -> None:
        result = self.inspect(
            [
                {
                    "command": "python -m unittest",
                    "source": "docs/validation.md",
                    "exit_code": 1,
                    "result": "failed",
                    "output": "failure",
                }
            ],
            scope_decision="in_scope",
        )
        self.assertEqual("implemented_but_not_validated", result["status"])
        self.assertIn("VALIDATION_FAILED", error_codes(result))

    def test_unavailable_validation_command_prevents_validation(self) -> None:
        result = self.inspect(
            [
                {
                    "command": "missing-tool",
                    "source": "selected slice",
                    "exit_code": None,
                    "result": "unavailable",
                    "output": "not found",
                }
            ]
        )
        self.assertIn("VALIDATION_UNAVAILABLE", error_codes(result))

    def test_premature_pipeline_checkbox_mutation_is_blocking(self) -> None:
        pipeline = self.project / "docs" / "pipeline.md"
        pipeline.write_text(pipeline.read_text().replace("- [ ] S-0002", "- [x] S-0002", 1))
        result = self.inspect()
        self.assertFalse(result["pipeline_unchanged"])
        self.assertIn("PIPELINE_CHANGED_BEFORE_ACCEPTANCE", error_codes(result))

    def test_selected_slice_body_mutation_is_blocking(self) -> None:
        pipeline = self.project / "docs" / "pipeline.md"
        pipeline.write_text(pipeline.read_text().replace("Implement subtraction", "Implement changed subtraction"))
        result = self.inspect()
        self.assertFalse(result["slice_unchanged"])
        self.assertIn("SELECTED_SLICE_CHANGED", error_codes(result))

    def test_unexplained_raes_artifact_change_is_reported(self) -> None:
        system = self.project / "docs" / "system.md"
        system.write_text(system.read_text() + "\nUnexpected change.\n")
        result = self.inspect()
        self.assertIn("docs/system.md", result["raes_artifact_changes"])
        self.assertTrue(result["scope_review"]["warnings"])

    def test_review_slice_with_no_repository_changes_can_be_validated(self) -> None:
        pipeline = self.project / "docs" / "pipeline.md"
        pipeline.write_text(pipeline.read_text().replace("- [ ] S-0002", "- [x] S-0002", 1))
        preflight = preflight_project(self.project)
        baseline = capture_baseline(self.project)
        result = inspect_result(
            self.project,
            baseline,
            preflight,
            [
                {
                    "command": "review-output-structure",
                    "source": "selected slice",
                    "exit_code": 0,
                    "result": "passed",
                    "output": "No output requested for this controlled check.",
                }
            ],
            scope_decision="in_scope",
        )
        self.assertEqual("review", result["slice_type"])
        self.assertEqual("validated", result["status"])
        self.assertEqual([], result["changes"]["modified"])


if __name__ == "__main__":
    unittest.main()
