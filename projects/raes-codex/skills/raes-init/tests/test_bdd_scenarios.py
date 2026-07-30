from __future__ import annotations
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from helpers import ROOT, artifacts, validate_manifest
from commit_project import commit


class Tests(unittest.TestCase):
    def test_actual_executor_interoperability(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp); project=base/"representative"; project.mkdir()
            prd=base/"prd.md"; prd.write_text("# Representative product\n")
            manifest=artifacts(project, base/"stage", prd)
            self.assertEqual("valid", validate_manifest(manifest)["status"])
            self.assertEqual("committed", commit(manifest)["status"])
            executor=ROOT.parent/"raes-execute/scripts/preflight.py"
            done=subprocess.run([sys.executable, str(executor), "--project-root", str(project)], text=True, capture_output=True)
            payload=json.loads(done.stdout)
            self.assertEqual(0, done.returncode, done.stderr); self.assertEqual("ready", payload["status"])
            self.assertEqual("1.0", payload["contract_version"]); self.assertEqual("S-0001", payload["slice"]["id"])
            self.assertEqual("execution", payload["slice"]["type"]); self.assertEqual("First work", payload["slice"]["label"])
            self.assertIn("Description:", payload["slice"]["body_markdown"])

    def test_skill_documents_ambiguity_rules(self):
        text=(ROOT/"SKILL.md").read_text()
        self.assertIn("add, remove, split, combine, or reorder", text)
        self.assertIn("docs/decisions.md", text); self.assertIn("docs/system.md", text)


if __name__ == "__main__": unittest.main()
