from __future__ import annotations
import os
import tempfile
import unittest
from pathlib import Path
from helpers import preflight


class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "project"; self.root.mkdir()
        self.prd = Path(self.tmp.name) / "prd.md"; self.prd.write_text("# Product\n")

    def test_prd_only_and_no_mutation(self):
        before = list(self.root.iterdir())
        result = preflight(str(self.root), str(self.prd))
        self.assertEqual("ready", result["status"]); self.assertEqual(8, len(result["destinations"]))
        self.assertEqual(before, list(self.root.iterdir()))

    def test_optional_sources_and_supporting_inputs(self):
        srs = Path(self.tmp.name) / "srs.md"; srs.write_text("# SRS\n")
        arch = Path(self.tmp.name) / "arch.md"; arch.write_text("# Architecture\n")
        handoff = Path(self.tmp.name) / "handoff.txt"; handoff.write_text("scope")
        result = preflight(str(self.root), str(self.prd), str(srs), str(arch), [str(handoff)], [str(handoff)])
        self.assertEqual("ready", result["status"]); self.assertEqual(10, len(result["destinations"]))

    def test_missing_nonregular_unreadable_and_format(self):
        self.assertEqual("MISSING_PRD", preflight(str(self.root), None)["errors"][0]["code"])
        self.assertEqual("INPUT_NOT_REGULAR_FILE", preflight(str(self.root), str(self.root))["errors"][0]["code"])
        bad = Path(self.tmp.name) / "prd.txt"; bad.write_text("x")
        self.assertEqual("INVALID_INPUT_FORMAT", preflight(str(self.root), str(bad))["errors"][0]["code"])
        bad.chmod(0); self.addCleanup(lambda: bad.chmod(0o644))
        self.assertEqual("INPUT_NOT_READABLE", preflight(str(self.root), str(bad))["errors"][0]["code"])

    def test_all_generated_conflicts(self):
        for relative in ("docs/system.md", "docs/pipeline.md", "docs/decisions.md", "docs/prd-ux-review.md", "docs/execution-guidance.md", "docs/validation.md", "raes.config.yaml"):
            with self.subTest(relative=relative):
                root = Path(self.tmp.name) / relative.replace("/", "_"); root.mkdir()
                path = root / relative; path.parent.mkdir(exist_ok=True); path.touch()
                self.assertIn("DESTINATION_CONFLICT", {e["code"] for e in preflight(str(root), str(self.prd))["errors"]})

    def test_canonical_in_place_allowed_external_conflict_blocked(self):
        docs = self.root / "docs"; docs.mkdir(); canonical = docs / "prd.md"; canonical.write_text("# Canonical\n")
        self.assertEqual("ready", preflight(str(self.root), str(canonical))["status"])
        self.assertIn("DESTINATION_CONFLICT", {e["code"] for e in preflight(str(self.root), str(self.prd))["errors"]})

    def test_symlink_escape(self):
        outside = Path(self.tmp.name) / "outside"; outside.mkdir()
        (self.root / "docs").symlink_to(outside, target_is_directory=True)
        self.assertIn("DESTINATION_ANCESTOR_ESCAPES_PROJECT", {e["code"] for e in preflight(str(self.root), str(self.prd))["errors"]})


if __name__ == "__main__": unittest.main()
