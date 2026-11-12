"""Module boundaries (AGENTS.md, architecture rule 1), checked on every run.

A module may import another module's `service` only: never its models, schemas or router.
"""

import re
from pathlib import Path

MODULES = Path(__file__).parent.parent / "app" / "modules"
PRIVATE_IMPORT = re.compile(
    r"^\s*(?:from app\.modules\.(\w+)\.(?:models|schemas|router)\b"
    r"|from app\.modules\.(\w+) import .*\b(?:models|schemas|router)\b)",
    re.MULTILINE,
)


def test_modules_only_import_each_others_service():
    violations = [
        f"{file.relative_to(MODULES)} imports private code of {match[1] or match[2]}"
        for file in MODULES.glob("*/*.py")
        for match in PRIVATE_IMPORT.finditer(file.read_text(encoding="utf-8"))
        if (match[1] or match[2]) != file.parent.name
    ]

    assert violations == []


def test_the_boundary_check_catches_a_violation():
    assert PRIVATE_IMPORT.search("from app.modules.patients.models import Patient")
    assert PRIVATE_IMPORT.search("from app.modules.patients import models")
    assert not PRIVATE_IMPORT.search("from app.modules.patients import service as patients")
