"""
Isolate imports across FraudAware ML services that share module names (`app`, `main`, `src`).
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType

REPO_ROOT = Path(__file__).resolve().parents[1]

SERVICE_ROOTS: dict[str, list[Path]] = {
    "scam-detection": [REPO_ROOT / "services" / "scam-detection"],
    "fake-job-detection": [REPO_ROOT / "services" / "fake-job-detection"],
    "employer-verification": [
        REPO_ROOT / "services" / "employer-verification",
        REPO_ROOT / "services" / "employer-verification" / "app",
    ],
    "job-recommendation": [REPO_ROOT / "services" / "job-recommendation"],
}

_ALL_SERVICE_PATHS = {str(path) for paths in SERVICE_ROOTS.values() for path in paths}
_SHARED_MODULE_ROOTS = ("app", "main", "explain", "src")


def _clear_shared_modules() -> None:
    remove: list[str] = []
    for name in list(sys.modules):
        if name in _SHARED_MODULE_ROOTS:
            remove.append(name)
            continue
        for root in _SHARED_MODULE_ROOTS:
            if name.startswith(root + "."):
                remove.append(name)
                break
    for name in remove:
        sys.modules.pop(name, None)


def _clear_service_paths() -> None:
    sys.path[:] = [entry for entry in sys.path if entry not in _ALL_SERVICE_PATHS]


def _ensure_paths(service: str) -> None:
    for path in reversed(SERVICE_ROOTS[service]):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


def import_module(service: str, dotted: str) -> ModuleType:
    """Import a module from a specific service without cross-service pollution."""
    _clear_shared_modules()
    _clear_service_paths()
    _ensure_paths(service)
    return importlib.import_module(dotted)
