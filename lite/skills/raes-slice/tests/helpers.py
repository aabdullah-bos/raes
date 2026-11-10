from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


TEST_ROOT = Path(__file__).resolve().parent
FIXTURES = TEST_ROOT / "fixtures"


def copy_fixture(destination: Path, name: str = "valid-project") -> Path:
    project = destination / "project"
    shutil.copytree(FIXTURES / "valid-project", project)
    if name != "valid-project":
        overlay = FIXTURES / name
        if overlay.exists():
            shutil.copytree(overlay, project, dirs_exist_ok=True)
    return project


def run_git(project: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=project,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout.strip()


def initialize_git(project: Path) -> None:
    run_git(project, "init", "-q")
    run_git(project, "config", "user.email", "raes-tests@example.invalid")
    run_git(project, "config", "user.name", "RAES Tests")
    run_git(project, "add", ".")
    run_git(project, "commit", "-qm", "fixture baseline")


def error_codes(result: dict) -> set[str]:
    return {error["code"] for error in result.get("errors", [])}
