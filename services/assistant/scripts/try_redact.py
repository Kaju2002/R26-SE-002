"""
Show what the LLM would receive after personal data is masked.

Run from services/assistant:

    py scripts/try_redact.py "Call 077 123 4567 and pay Rs 2,500 to account 8001234567"
    py scripts/try_redact.py            # uses a sample recruiter message
    py scripts/try_redact.py -          # read the message from standard input (paste, then Ctrl+Z Enter)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.redact import redact  # noqa: E402

SAMPLE = (
    "Congratulations! You are selected. Call Mr. Perera on 077 123 4567 or email "
    "hr.abcjobs@gmail.com. Pay the Rs 2,500 registration fee to account 8001234567 "
    "and send your NIC 951234567V. Your OTP is 482913. Details at www.abc-jobs.lk"
)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "-":
        text = sys.stdin.read()
    elif len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = SAMPLE

    result = redact(text)
    print("Original:\n" + text.strip())
    print("\nSent to the LLM:\n" + result.text.strip())
    hidden = ", ".join(f"{kind}: {n}" for kind, n in sorted(result.counts.items())) or "nothing"
    print(f"\nHidden: {hidden}")


if __name__ == "__main__":
    main()
