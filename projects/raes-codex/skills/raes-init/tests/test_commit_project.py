from __future__ import annotations
import tempfile
import unittest
from pathlib import Path
from helpers import artifacts, validate_manifest
from commit_project import commit


class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        base=Path(self.tmp.name); self.project=base/"project"; self.project.mkdir()
        self.prd=base/"prd.md"; self.prd.write_text("# Product\n")

    def make(self):
        manifest=artifacts(self.project, Path(self.tmp.name)/"stage", self.prd)
        self.assertEqual("valid", validate_manifest(manifest)["status"])
        return manifest

    def test_success_and_cleanup(self):
        manifest=self.make(); stage=manifest.parent
        result=commit(manifest)
        self.assertEqual("committed", result["status"]); self.assertFalse(stage.exists())
        self.assertTrue((self.project/"raes.config.yaml").is_file())

    def test_stale_destination_blocks_without_mutation(self):
        manifest=self.make(); (self.project/"raes.config.yaml").write_text("user")
        result=commit(manifest)
        self.assertEqual("STALE_PREFLIGHT_STATE", result["code"])
        self.assertEqual("user", (self.project/"raes.config.yaml").read_text())

    def test_failure_rolls_back(self):
        manifest=self.make(); result=commit(manifest, fail_after=3)
        self.assertEqual("INSTALL_FAILED", result["code"]); self.assertTrue(result["rollback_complete"])
        self.assertEqual([], list(self.project.rglob("*")))

    def test_unrelated_change_allowed(self):
        manifest=self.make(); (self.project/"app.py").write_text("user")
        self.assertEqual("committed", commit(manifest)["status"])
        self.assertEqual("user", (self.project/"app.py").read_text())


if __name__ == "__main__": unittest.main()
