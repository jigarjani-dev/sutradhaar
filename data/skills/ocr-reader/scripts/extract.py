#!/usr/bin/env python3
"""OCR text extraction (mock-aware). Args passed as key=value."""
import json
import sys


def main():
    args = {}
    for a in sys.argv[1:]:
        if "=" in a:
            k, v = a.split("=", 1)
            args[k] = v

    file_path = args.get("file_path", "")
    image_description = args.get("image_description", "unknown")

    result = {
        "file_path": file_path,
        "note": "A real OCR engine (e.g. PaddleOCR) would extract text here. "
                f"User described the image as: {image_description}",
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
