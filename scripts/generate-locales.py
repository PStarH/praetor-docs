#!/usr/bin/env python3
"""Generate complete locale copies from the canonical public English pages."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    "index.md",
    "films.md",
    "getting-started.md",
    "cli.md",
    "api.md",
    "configuration.md",
    "architecture.md",
    "web-console.md",
    "packages.md",
    "deployment.md",
    "operations.md",
    "security.md",
    "sdk.md",
    "troubleshooting.md",
    "benchmarks.md",
    "support.md",
    "tools.md",
    "providers.md",
    "mcp.md",
    "workflows.md",
]
LOCALES = {
    # zh is maintained manually as a fully localized first-class translation
    "ja": "日本語",
    "ko": "한국어",
    "es": "Español",
    "fr": "Français",
}

for locale, label in LOCALES.items():
    target = ROOT / locale
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    for page in PAGES:
        source = (ROOT / page).read_text()
        notice = f"> This page is synchronized from the canonical English documentation. {label} navigation is available; commands and product limits are identical in every locale.\n\n"
        if source.startswith("---\n"):
            end = source.index("\n---\n", 4) + len("\n---\n")
            localized = source[:end] + "\n" + notice + source[end:].lstrip("\n")
        else:
            title = source.splitlines()[0].removeprefix("# ")
            localized = f"# {title}\n\n{notice}" + "\n".join(source.splitlines()[2:])
        (target / page).write_text(localized)
