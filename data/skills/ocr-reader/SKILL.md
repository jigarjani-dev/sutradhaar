---
name: ocr-reader
description: Extract text from images and PDFs using OCR. Use when the user uploads or references a scanned document, receipt, invoice, or image with text.
license: Apache-2.0
metadata:
  vendor: workshop-agent-gateway
  version: "1.0"
---

# OCR Reader

Extract text from images and PDF documents.

## When to use
- "read this receipt", "what does this invoice say", "extract text from this scan"

## Scripts
- `scripts/extract.py` — OCR a file. Args: `file_path`, `image_description` (optional fallback text).

## Procedure
1. Run `scripts/extract.py` with `file_path`.
2. Return the extracted text to the user.
