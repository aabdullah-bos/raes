from __future__ import annotations

import os
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


VALIDATION = [
    {
        "command": "python -m unittest",
        "source": "docs/validation.md",
        "exit_code": 0,
        "result": "passed",
        "output": "OK",
    }
]


class AcceptSliceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = copy_fixture(Path(self.temp.name))
        initialize_git(self.project)
        preflight = preflight_project(self.project)
        baseline = capture_baseline(self.project)
        self.evidence = inspect_result(
            self.project,
            baseline,
            preflight,
            VALIDATION,
            scope_decision="in_scope",
        )

    @property
    def pipeline(self) -> Path:
        return self.project / "docs" / "pipeline.md"

    def accept(self, **kwargs) -> dict:
        return accept_slice(self.project, self.evidence, "S-0002", **kwargs)

    def test_successful_acceptance(self) -> None:
        result = self.accept()
        self.assertEqual("accepted", result["status"])
        self.assertIn("- [x] S-0002 | execution", self.pipeline.read_text())

    def test_successful_acceptance_without_version_control(self) -> None:
        project = copy_fixture(Path(self.temp.name) / "non-git")
        preflight = preflight_project(project)
        baseline = capture_baseline(project)
        evidence = inspect_result(
            project,
            baseline,
            preflight,
            VALIDATION,
            scope_decision="in_scope",
        )

        self.assertEqual("validated", evidence["status"])
        result = accept_slice(project, evidence, "S-0002")
        self.assertEqual("accepted", result["status"])
        self.assertIn("- [x] S-0002 | execution", (project / "docs" / "pipeline.md").read_text())

    def test_target_no_longer_first_unchecked_is_blocked(self) -> None:
        text = self.pipeline.read_text().replace("- [x] S-0001", "- [ ] S-0001", 1)
        self.pipeline.write_text(text)
        result = self.accept()
        self.assertIn("TARGET_NOT_FIRST_UNCHECKED", error_codes(result))

    def test_target_already_accepted_is_blocked(self) -> None:
        self.pipeline.write_text(self.pipeline.read_text().replace("- [ ] S-0002", "- [x] S-0002", 1))
        result = self.accept()
        self.assertIn("TARGET_ALREADY_ACCEPTED", error_codes(result))

    def test_duplicate_target_id_is_blocked(self) -> None:
        marker = "- [ ] S-0003 | review | Review calculator error handling"
        duplicate = "- [ ] S-0002 | review | Duplicate target"
        self.pipeline.write_text(self.pipeline.read_text().replace(marker, duplicate))
        result = self.accept()
        self.assertIn("DUPLICATE_SLICE_ID", error_codes(result))

    def test_changed_slice_body_is_blocked(self) -> None:
        self.pipeline.write_text(self.pipeline.read_text().replace("Implement subtraction", "Changed after validation"))
        result = self.accept()
        self.assertIn("VALIDATED_SLICE_CHANGED", error_codes(result))

    def test_changed_pipeline_hash_is_blocked(self) -> None:
        self.pipeline.write_text(self.pipeline.read_text() + "\nUnrelated pipeline edit.\n")
        result = self.accept()
        self.assertIn("VALIDATION_STATE_STALE", error_codes(result))

    def test_changed_repository_fingerprint_is_blocked(self) -> None:
        (self.project / "src" / "calculator.py").write_text("changed after validation\n")
        result = self.accept()
        self.assertIn("VALIDATION_STATE_STALE", error_codes(result))

    def test_only_target_checkbox_changes(self) -> None:
        before = self.pipeline.read_text()
        result = self.accept()
        self.assertEqual("accepted", result["status"])
        after = self.pipeline.read_text()
        expected = before.replace("- [ ] S-0002", "- [x] S-0002", 1)
        self.assertEqual(expected, after)

    def test_temp_file_is_cleaned_after_replace_failure(self) -> None:
        def fail_replace(_source: str | os.PathLike[str], _target: str | os.PathLike[str]) -> None:
            raise OSError("simulated replace failure")

        result = self.accept(replace_fn=fail_replace)
        self.assertIn("ATOMIC_WRITE_FAILED", error_codes(result))
        self.assertFalse(list(self.pipeline.parent.glob(".raes-accept-*")))
        self.assertIn("- [ ] S-0002", self.pipeline.read_text())

    def test_atomic_replace_uses_same_directory(self) -> None:
        calls: list[tuple[Path, Path]] = []

        def recording_replace(source: str | os.PathLike[str], target: str | os.PathLike[str]) -> None:
            source_path = Path(source)
            target_path = Path(target)
            calls.append((source_path, target_path))
            os.replace(source_path, target_path)

        result = self.accept(replace_fn=recording_replace)
        self.assertEqual("accepted", result["status"])
        self.assertEqual(1, len(calls))
        self.assertEqual(self.pipeline.parent.resolve(), calls[0][0].parent.resolve())
        self.assertEqual(self.pipeline.resolve(), calls[0][1].resolve())

    def test_unvalidated_evidence_is_rejected(self) -> None:
        self.evidence["status"] = "ready_for_review"
        result = self.accept()
        self.assertIn("EVIDENCE_NOT_VALIDATED", error_codes(result))


if __name__ == "__main__":
    unittest.main()
