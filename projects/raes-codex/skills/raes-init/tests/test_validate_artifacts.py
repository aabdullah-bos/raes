from __future__ import annotations
import tempfile
import unittest
from pathlib import Path
from helpers import artifacts, validate_manifest


class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name); self.project = base/"project"; self.project.mkdir()
        self.prd = base/"prd.md"; self.prd.write_bytes(b"# Product\n\xcf\x80\n")
        self.manifest = artifacts(self.project, base/"stage", self.prd)

    def test_valid_eight_path_candidate_and_source_bytes(self):
        result = validate_manifest(self.manifest)
        self.assertEqual("valid", result["status"]); self.assertEqual(self.prd.read_bytes(), (self.manifest.parent/"docs/prd.md").read_bytes())

    def test_heading_in_fence_does_not_count(self):
        path = self.manifest.parent/"docs/system.md"
        path.write_text(path.read_text().replace("## Purpose", "```\n## Purpose\n```"))
        self.assertIn("INVALID_ARTIFACT_HEADINGS", {e["code"] for e in validate_manifest(self.manifest)["errors"]})

    def test_pipeline_shape_failures(self):
        path = self.manifest.parent/"docs/pipeline.md"
        for old, new, code in [
            ("S-0001", "S-0002", "NON_SEQUENTIAL_SLICE_IDS"),
            ("  Description:", "  Missing:", "INCOMPLETE_SLICE_BODY"),
            ("## Handoff Notes", "### Milestone\n\n## Handoff Notes", "UNSUPPORTED_BACKLOG_HEADING"),
        ]:
            with self.subTest(code=code):
                original = path.read_text(); path.write_text(original.replace(old, new))
                self.assertIn(code, {e["code"] for e in validate_manifest(self.manifest)["errors"]})
                path.write_text(original)

    def test_config_version_and_schema_exact(self):
        path = self.manifest.parent/"raes.config.yaml"
        path.write_text(path.read_text().replace('"1.0"', '"2.0"'))
        self.assertIn("INVALID_CONFIG_SCHEMA", {e["code"] for e in validate_manifest(self.manifest)["errors"]})


if __name__ == "__main__": unittest.main()
