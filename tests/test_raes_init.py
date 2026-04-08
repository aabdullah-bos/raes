from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from raes_init import GenerationError, generate_docs


class GenerateDocsTests(unittest.TestCase):
    def test_generates_raes_docs_for_narrow_happy_path(self) -> None:
        with TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            source_prd = temp_root / "source-prd.md"
            source_prd.write_text(
                "# Sample Widget CLI\n\n"
                "## Purpose\n\n"
                "Create a widget management CLI for operators.\n\n"
                "## Core Functionality\n\n"
                "- Operators can create a widget definition from a template.\n"
                "- Operators can validate required widget fields before saving.\n",
                encoding="utf-8",
            )
            target_project = temp_root / "sample-widget"

            generated = generate_docs(
                prd_path=source_prd,
                target_project_path=target_project,
                archetype="cli-doc-generator",
            )

            docs_dir = target_project / "docs"
            self.assertEqual(
                generated,
                [
                    docs_dir / "PRD.md",
                    docs_dir / "system.md",
                    docs_dir / "pipeline.md",
                    docs_dir / "decisions.md",
                    docs_dir / "prd-ux-review.md",
                ],
            )

            for path in generated:
                self.assertTrue(path.exists(), msg=f"expected generated file: {path}")

            self.assertEqual(
                (docs_dir / "PRD.md").read_text(encoding="utf-8"),
                source_prd.read_text(encoding="utf-8"),
            )

            system_text = (docs_dir / "system.md").read_text(encoding="utf-8")
            self.assertIn("# sample-widget", system_text)
            self.assertIn("Sample Widget CLI", system_text)
            self.assertIn("## Product Invariants", system_text)
            self.assertIn("## Unknowns", system_text)

            pipeline_text = (docs_dir / "pipeline.md").read_text(encoding="utf-8")
            self.assertIn("# sample-widget", pipeline_text)
            self.assertIn("## Slice Backlog", pipeline_text)
            self.assertIn("[ ] Slice 1", pipeline_text)

            decisions_text = (docs_dir / "decisions.md").read_text(encoding="utf-8")
            self.assertIn("# sample-widget", decisions_text)
            self.assertIn("## Durable Decisions", decisions_text)

            review_text = (docs_dir / "prd-ux-review.md").read_text(encoding="utf-8")
            self.assertIn("# sample-widget", review_text)
            self.assertIn("## Open Questions", review_text)

    def test_rejects_unsupported_archetype_without_writing_files(self) -> None:
        with TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            source_prd = temp_root / "source-prd.md"
            source_prd.write_text("# Product\n", encoding="utf-8")
            target_project = temp_root / "target-project"

            with self.assertRaises(GenerationError):
                generate_docs(
                    prd_path=source_prd,
                    target_project_path=target_project,
                    archetype="frontend-backend-ai-app",
                )

            self.assertFalse((target_project / "docs").exists())

    def test_fails_before_partial_generation_when_target_file_exists(self) -> None:
        with TemporaryDirectory() as tmp:
            temp_root = Path(tmp)
            source_prd = temp_root / "source-prd.md"
            source_prd.write_text("# Product\n", encoding="utf-8")
            target_project = temp_root / "target-project"
            docs_dir = target_project / "docs"
            docs_dir.mkdir(parents=True)
            (docs_dir / "system.md").write_text("existing", encoding="utf-8")

            with self.assertRaises(GenerationError):
                generate_docs(
                    prd_path=source_prd,
                    target_project_path=target_project,
                    archetype="cli-doc-generator",
                )

            self.assertFalse((docs_dir / "PRD.md").exists())
            self.assertFalse((docs_dir / "pipeline.md").exists())
            self.assertFalse((docs_dir / "decisions.md").exists())
            self.assertFalse((docs_dir / "prd-ux-review.md").exists())
            self.assertEqual(
                (docs_dir / "system.md").read_text(encoding="utf-8"),
                "existing",
            )


if __name__ == "__main__":
    unittest.main()
