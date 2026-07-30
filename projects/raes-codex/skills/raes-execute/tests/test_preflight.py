from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from helpers import copy_fixture, error_codes


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from preflight import preflight_project  # noqa: E402


class PreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = copy_fixture(Path(self.temp.name))

    @property
    def pipeline(self) -> Path:
        return self.project / "docs" / "pipeline.md"

    def run_preflight(self) -> dict:
        return preflight_project(self.project)

    def test_valid_execution_slice_is_selected(self) -> None:
        result = self.run_preflight()
        self.assertEqual("ready", result["status"])
        self.assertEqual("1.0", result["contract_version"])
        self.assertEqual("S-0002", result["slice"]["id"])
        self.assertEqual("execution", result["slice"]["type"])
        self.assertFalse(result["slice"]["checked"])

    def test_valid_review_slice_routes_from_explicit_type(self) -> None:
        text = self.pipeline.read_text()
        self.pipeline.write_text(text.replace("- [ ] S-0002", "- [x] S-0002", 1))
        result = self.run_preflight()
        self.assertEqual("ready", result["status"])
        self.assertEqual("S-0003", result["slice"]["id"])
        self.assertEqual("review", result["slice"]["type"])

    def test_multiline_body_is_returned_in_full(self) -> None:
        body = self.run_preflight()["slice"]["body_markdown"]
        self.assertIn("Implement subtraction", body)
        self.assertIn("Acceptance criteria:", body)
        self.assertIn("Validation:", body)

    def test_nested_bullets_and_checkboxes_are_body_not_slices(self) -> None:
        result = self.run_preflight()
        self.assertEqual(3, result["pipeline"]["slice_count"])
        self.assertIn("- [ ] Nested criteria", result["slice"]["body_markdown"])

    def test_duplicate_ids_fail_closed(self) -> None:
        self.project = copy_fixture(Path(self.temp.name) / "duplicate", "duplicate-slice-id")
        result = self.run_preflight()
        self.assertIn("DUPLICATE_SLICE_ID", error_codes(result))

    def test_missing_label_fails_closed(self) -> None:
        self.pipeline.write_text("## Slice Backlog\n\n- [ ] S-9 | execution |   \n")
        self.assertIn("MISSING_SLICE_LABEL", error_codes(self.run_preflight()))

    def test_unsupported_type_fails_closed(self) -> None:
        self.pipeline.write_text("## Slice Backlog\n\n- [ ] S-9 | maintenance | Work\n")
        self.assertIn("UNSUPPORTED_SLICE_TYPE", error_codes(self.run_preflight()))

    def test_missing_backlog_fails_closed(self) -> None:
        self.pipeline.write_text("# Pipeline\n\n## Handoff Notes\n")
        self.assertIn("MISSING_SLICE_BACKLOG", error_codes(self.run_preflight()))

    def test_malformed_top_level_declaration_fails_closed(self) -> None:
        self.project = copy_fixture(Path(self.temp.name) / "malformed", "malformed-pipeline")
        self.assertIn("MALFORMED_SLICE_DECLARATION", error_codes(self.run_preflight()))

    def test_milestone_heading_inside_backlog_fails_closed(self) -> None:
        self.project = copy_fixture(Path(self.temp.name) / "milestone", "milestone-pipeline")
        result = self.run_preflight()
        self.assertIn("UNSUPPORTED_MILESTONE_HEADING", error_codes(result))
        error = next(error for error in result["errors"] if error["code"] == "UNSUPPORTED_MILESTONE_HEADING")
        self.assertEqual(5, error["line"])

    def test_missing_artifact_fails_closed(self) -> None:
        (self.project / "docs" / "system.md").unlink()
        self.assertIn("MISSING_ARTIFACT", error_codes(self.run_preflight()))

    def test_artifact_directory_fails_closed(self) -> None:
        validation = self.project / "docs" / "validation.md"
        validation.unlink()
        validation.mkdir()
        self.assertIn("ARTIFACT_NOT_REGULAR_FILE", error_codes(self.run_preflight()))

    def test_artifact_path_escaping_project_root_fails_closed(self) -> None:
        outside = Path(self.temp.name) / "outside.md"
        outside.write_text("# Outside\n")
        config = self.project / "raes.config.yaml"
        config.write_text(config.read_text().replace("docs/prd.md", "../outside.md"))
        self.assertIn("ARTIFACT_PATH_ESCAPES_PROJECT", error_codes(self.run_preflight()))

    def test_all_slices_accepted_fails_closed(self) -> None:
        self.pipeline.write_text(self.pipeline.read_text().replace("- [ ]", "- [x]"))
        self.assertIn("NO_UNCHECKED_SLICE", error_codes(self.run_preflight()))

    def test_uppercase_checked_marker_is_rejected(self) -> None:
        self.pipeline.write_text(self.pipeline.read_text().replace("- [x] S-0001", "- [X] S-0001"))
        self.assertIn("UNSUPPORTED_CHECKBOX_MARKER", error_codes(self.run_preflight()))

    def test_missing_config_fails_closed(self) -> None:
        (self.project / "raes.config.yaml").unlink()
        self.assertIn("MISSING_CONFIG", error_codes(self.run_preflight()))

    def test_malformed_config_fails_closed(self) -> None:
        (self.project / "raes.config.yaml").write_text("sources:\n  build_intent\n")
        self.assertIn("MALFORMED_CONFIG", error_codes(self.run_preflight()))

    def test_missing_contract_version_blocks_before_artifact_resolution(self) -> None:
        config = self.project / "raes.config.yaml"
        config.write_text(config.read_text().replace('raes:\n  contract_version: "1.0"\n', ""))
        (self.project / "docs" / "system.md").unlink()
        result = self.run_preflight()
        self.assertIn("INVALID_CONFIG_SCHEMA", error_codes(result))
        self.assertNotIn("MISSING_ARTIFACT", error_codes(result))

    def test_unsupported_contract_version_reports_declared_and_supported(self) -> None:
        config = self.project / "raes.config.yaml"
        config.write_text(config.read_text().replace('"1.0"', '"2.0"'))
        result = self.run_preflight()
        self.assertIn("UNSUPPORTED_CONTRACT_VERSION", error_codes(result))
        self.assertIn("'2.0'", result["errors"][0]["message"])
        self.assertIn("'1.0'", result["errors"][0]["message"])

    def test_unquoted_numeric_contract_version_is_malformed(self) -> None:
        config = self.project / "raes.config.yaml"
        config.write_text(config.read_text().replace('"1.0"', "1.0"))
        self.assertIn("MISSING_OR_MALFORMED_CONTRACT_VERSION", error_codes(self.run_preflight()))

    def test_preflight_cli_emits_json_and_makes_no_changes(self) -> None:
        before = {path: path.read_bytes() for path in self.project.rglob("*") if path.is_file()}
        completed = subprocess.run(
            [sys.executable, str(SCRIPTS / "preflight.py"), "--project-root", str(self.project)],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.assertEqual(0, completed.returncode, completed.stderr)
        payload = json.loads(completed.stdout)
        self.assertEqual("ready", payload["status"])
        after = {path: path.read_bytes() for path in self.project.rglob("*") if path.is_file()}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
