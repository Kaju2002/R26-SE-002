"""One place that imports the web-search client.

The old `duckduckgo_search` package was renamed to `ddgs` and the old one now often returns no results at all.
Prefer `ddgs`; fall back to the old package only if `ddgs` is not installed.
"""
from __future__ import annotations

import warnings


def get_ddgs_class():
    """Return the DDGS class, or raise ImportError if neither package is installed."""
    try:
        from ddgs import DDGS  # new package name

        return DDGS
    except ImportError:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            from duckduckgo_search import DDGS  # old name (fallback)

        return DDGS
