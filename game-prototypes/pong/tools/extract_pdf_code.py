"""Extract the C++ appendix from pong.pdf while preserving an archival copy.

Pages are one-based in the accompanying document. The appendix begins on page
11; its three files are separated by //SOURCE.CPP, //BAM.H, and //OBJECTS.H.
"""

from __future__ import annotations

import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "pong.pdf"
ARCHIVE = ROOT / "archive"
RAW = ARCHIVE / "raw-extraction.txt"
ORIGINAL = ARCHIVE / "original"

MARKERS = {
    "//SOURCE.CPP": "source.cpp",
    "//BAM.H": "bam.h",
    "//OBJECTS.H": "objects.h",
}


def remove_pdf_wrapping(lines: list[str]) -> str:
    """Undo wrapping introduced by the PDF layout, not original code changes."""
    restored: list[str] = []
    pending = ""
    in_string = False

    for line in lines:
        if pending:
            separator = " " if in_string else "\n"
            pending += separator + line
        else:
            pending = line

        # Count unescaped quotes to detect the visually wrapped string literals.
        quote_count = len(re.findall(r'(?<!\\)"', line))
        in_string = in_string ^ (quote_count % 2 == 1)
        if not in_string:
            restored.append(pending)
            pending = ""

    if pending:
        restored.append(pending)

    text = "\n".join(restored)
    # The PDF split this identifier at the right margin on page 24.
    text = text.replace("WIDT\nH/", "WIDTH/")
    # A commented-out call on page 18 wraps after an open parenthesis. Join
    # comment continuations until that call's parentheses balance again.
    logical_lines: list[str] = []
    comment_depth = 0
    for line in text.splitlines():
        if comment_depth:
            logical_lines[-1] += " " + line.lstrip()
            comment_depth += line.count("(") - line.count(")")
            continue
        logical_lines.append(line)
        if line.lstrip().startswith("//"):
            comment_depth = line.count("(") - line.count(")")
    text = "\n".join(logical_lines)
    return text.rstrip() + "\n"


def main() -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    ORIGINAL.mkdir(parents=True, exist_ok=True)

    raw_pages: list[str] = []
    files: dict[str, list[str]] = {name: [] for name in MARKERS.values()}
    current: str | None = None

    with pdfplumber.open(PDF) as document:
        for page_number in range(11, len(document.pages) + 1):
            text = document.pages[page_number - 1].extract_text() or ""
            raw_pages.append(f"--- PDF PAGE {page_number} ---\n{text.rstrip()}\n")

            lines = text.splitlines()
            if lines and lines[-1].strip() == str(page_number):
                lines.pop()

            for line in lines:
                marker = line.strip().upper()
                if marker in MARKERS:
                    current = MARKERS[marker]
                    continue
                if current is not None:
                    files[current].append(line.rstrip())

    RAW.write_text("\n".join(raw_pages), encoding="utf-8")
    for filename, lines in files.items():
        (ORIGINAL / filename).write_text(remove_pdf_wrapping(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
