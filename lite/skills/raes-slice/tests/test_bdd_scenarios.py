from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from helpers import copy_fixture, error_codes, initialize_git


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from accept_slice import accept_slice  # noqa: E402
from inspect_result import capture_baseline, inspect_result  # noqa: E402
from preflight import preflight_project  # noqa: E402


PASSED_VALIDATION = [
    {
        "command": "python -m unittest",
        "source": "docs/validation.md",
        "exit_code": 0,
        "result": "passed",
        "output": "OK",
    }
]

FAILED_VALIDATION = [
    {
        "command": "python -m unittest",
        "source": "docs/validation.md",
        "exit_code": 1,
        "result": "failed",
        "output": "FAILED",
    }
]


class StageOneDogfoodScenarios(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def ready_project(self, name: str = "valid-project") -> Path:
        project = copy_fixture(self.base / name, name)
        initialize_git(project)
        return project

    def validated_evidence(
        self,
        project: Path,
        *,
        allowed_paths: list[str],
    ) -> tuple[dict, dict, dict]:
        preflight = preflight_project(project)
        baseline = capture_baseline(project)
        evidence = inspect_result(
            project,
            baseline,
            preflight,
            PASSED_VALIDATION,
            allowed_paths=allowed_paths,
            scope_decision="in_scope",
        )
        return preflight, baseline, evidence

    def test_execution_succeeds_and_only_selected_slice_is_accepted(self) -> None:
        project = self.ready_project()
        preflight = preflight_project(project)
        baseline = capture_baseline(project)
        pipeline = project / "docs" / "pipeline.md"
        before_pipeline = pipeline.read_text(encoding="utf-8")

        calculator = project / "src" / "calculator.py"
        calculator.write_text(
            calculator.read_text(encoding="utf-8")
            + "\n\ndef subtract(left: int, right: int) -> int:\n    return left - right\n",
            encoding="utf-8",
        )
        evidence = inspect_result(
            project,
            baseline,
            preflight,
            PASSED_VALIDATION,
            allowed_paths=["src/calculator.py"],
            scope_decision="in_scope",
        )

        self.assertEqual("execution", preflight["slice"]["type"])
        self.assertEqual("validated", evidence["status"])
        self.assertTrue(evidence["pipeline_unchanged"])
        accepted = accept_slice(project, evidence, "S-0002")
        self.assertEqual("accepted", accepted["status"])
        self.assertEqual(
            before_pipeline.replace("- [ ] S-0002", "- [x] S-0002", 1),
            pipeline.read_text(encoding="utf-8"),
        )

    def test_review_succeeds_without_modifying_implementation_behavior(self) -> None:
        project = copy_fixture(self.base / "review")
        pipeline = project / "docs" / "pipeline.md"
        pipeline.write_text(
            pipeline.read_text(encoding="utf-8").replace("- [ ] S-0002", "- [x] S-0002", 1),
            encoding="utf-8",
        )
        initialize_git(project)
        calculator = project / "src" / "calculator.py"
        before_implementation = calculator.read_bytes()
        preflight = preflight_project(project)
        baseline = capture_baseline(project)

        review_output = project / "docs" / "error-handling-review.md"
        review_output.write_text(
            "# Error-handling review\n\nNo error-handling paths exist in the fixture calculator.\n",
            encoding="utf-8",
        )
        evidence = inspect_result(
            project,
            baseline,
            preflight,
            PASSED_VALIDATION,
            allowed_paths=["docs/error-handling-review.md"],
            scope_decision="in_scope",
        )

        self.assertEqual("review", preflight["slice"]["type"])
        self.assertEqual("validated", evidence["status"])
        self.assertEqual(before_implementation, calculator.read_bytes())
        accepted = accept_slice(project, evidence, "S-0003")
        self.assertEqual("accepted", accepted["status"])
        self.assertIn("- [x] S-0003 | review", pipeline.read_text(encoding="utf-8"))

    def test_failed_validation_never_changes_pipeline(self) -> None:
        project = self.ready_project()
        preflight = preflight_project(project)
        baseline = capture_baseline(project)
        pipeline = project / "docs" / "pipeline.md"
        before_pipeline = pipeline.read_bytes()
        calculator = project / "src" / "calculator.py"
        calculator.write_text("def broken(:\n", encoding="utf-8")

        evidence = inspect_result(
            project,
            baseline,
            preflight,
            FAILED_VALIDATION,
            allowed_paths=["src/calculator.py"],
            scope_decision="in_scope",
        )

        self.assertEqual("implemented_but_not_validated", evidence["status"])
        self.assertEqual(before_pipeline, pipeline.read_bytes())
        blocked_acceptance = accept_slice(project, evidence, "S-0002")
        self.assertIn("EVIDENCE_NOT_VALIDATED", error_codes(blocked_acceptance))
        self.assertEqual(before_pipeline, pipeline.read_bytes())

    def test_rejected_acceptance_leaves_same_slice_next(self) -> None:
        project = self.ready_project()
        pipeline = project / "docs" / "pipeline.md"
        before_pipeline = pipeline.read_bytes()
        preflight, _baseline, evidence = self.validated_evidence(project, allowed_paths=[])

        self.assertEqual("validated", evidence["status"])
        self.assertEqual(before_pipeline, pipeline.read_bytes())
        after_rejection = preflight_project(project)
        self.assertEqual(preflight["slice"]["id"], after_rejection["slice"]["id"])
        self.assertEqual("S-0002", after_rejection["slice"]["id"])

    def test_stale_acceptance_is_blocked_without_pipeline_change(self) -> None:
        project = self.ready_project()
        pipeline = project / "docs" / "pipeline.md"
        before_pipeline = pipeline.read_bytes()
        _preflight, _baseline, evidence = self.validated_evidence(project, allowed_paths=[])
        (project / "src" / "calculator.py").write_text("changed after validation\n", encoding="utf-8")

        result = accept_slice(project, evidence, "S-0002")

        self.assertIn("VALIDATION_STATE_STALE", error_codes(result))
        self.assertEqual(before_pipeline, pipeline.read_bytes())

    def test_unsupported_milestone_is_blocked_without_repository_changes(self) -> None:
        project = copy_fixture(self.base / "milestone", "milestone-pipeline")
        before = {
            path.relative_to(project): path.read_bytes()
            for path in project.rglob("*")
            if path.is_file()
        }

        result = preflight_project(project)

        self.assertEqual("blocked", result["status"])
        self.assertIn("UNSUPPORTED_MILESTONE_HEADING", error_codes(result))
        error = next(error for error in result["errors"] if error["code"] == "UNSUPPORTED_MILESTONE_HEADING")
        self.assertEqual("docs/pipeline.md", error["path"])
        self.assertIsInstance(error["line"], int)
        after = {
            path.relative_to(project): path.read_bytes()
            for path in project.rglob("*")
            if path.is_file()
        }
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
