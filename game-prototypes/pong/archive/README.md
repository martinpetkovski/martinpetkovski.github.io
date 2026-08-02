# Archived source

The `original` directory contains the three C++ files printed in `pong.pdf`,
starting on page 11. Only PDF pagination and visual line wrapping were removed;
the program text itself was not modernized or corrected.

`raw-extraction.txt` preserves the page-by-page text extraction, including page
numbers and PDF-induced line wrapping. Regenerate both forms with:

```powershell
python tools/extract_pdf_code.py
```

The build uses a compatibility wrapper outside this directory so these files
remain an untouched archive of the document's code.

