"""
Run the three checks against the real services and print each result plus the combined verdict.

Run from services/assistant (the services on ports 8000, 8001 and 8003 must be running):

    py scripts/try_checks.py
    py scripts/try_checks.py --job-text "..." --company "ABC Holdings" --email "abc.jobs@gmail.com" --message "..."
    py scripts/try_checks.py --job-image poster.jpg --message-image chat.png
    py scripts/try_checks.py --skip-company        # employer verification can take up to 90 s

The message check needs a login token: pass --token <JWT from the app>, or set JWT_SECRET
(the same value as user-management) in services/assistant/.env and a test token is created.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.tools.company import check_company  # noqa: E402
from app.tools.job_post import check_job_post_image, check_job_post_text  # noqa: E402
from app.tools.recruiter_chat import check_recruiter_image, check_recruiter_text  # noqa: E402
from app.verdict import combine  # noqa: E402

SAMPLE_JOB_POST = (
    "URGENT HIRING! Data entry work from home. Earn Rs 5,000 daily, no experience needed. "
    "Pay a small registration fee of Rs 2,500 to start. WhatsApp only: 07X XXX XXXX."
)
SAMPLE_COMPANY = {"company_name": "Dialog Axiata PLC", "website_url": "https://www.dialog.lk", "email": None}
SAMPLE_MESSAGE = (
    "Congratulations, you are selected! Only 2 seats left, confirm today or lose the offer. "
    "Send the Rs 3,000 registration fee now to start your training tomorrow."
)


def _token(cli_token: str | None) -> str | None:
    if cli_token:
        return cli_token
    secret = (os.getenv("JWT_SECRET") or "").strip()
    if not secret:
        return None
    import jwt

    now = int(time.time())
    payload = {"userId": "assistant-try-checks", "iat": now, "exp": now + 600}
    return jwt.encode(payload, secret, algorithm="HS256")


def _print(result) -> None:
    risk = result.risk or "-"
    print(f"\n[{result.source}] status={result.status} risk={risk}")
    for reason in result.reasons:
        print(f"  - {reason}")


async def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--job-text")
    p.add_argument("--job-image", type=Path)
    p.add_argument("--company")
    p.add_argument("--website")
    p.add_argument("--email")
    p.add_argument("--message")
    p.add_argument("--message-image", type=Path)
    p.add_argument("--token")
    p.add_argument("--skip-company", action="store_true")
    args = p.parse_args()

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    token = _token(args.token)
    if not token:
        print("No login token: the message check will report that it needs a login (see --help).")

    if args.job_image:
        job = check_job_post_image(args.job_image.read_bytes())
    else:
        job = check_job_post_text(args.job_text or SAMPLE_JOB_POST)

    if args.message_image:
        message = check_recruiter_image(args.message_image.read_bytes(), auth_token=token)
    else:
        message = check_recruiter_text(args.message or SAMPLE_MESSAGE, auth_token=token)

    tasks = [job, message]
    if not args.skip_company:
        if args.company or args.website or args.email:
            tasks.append(check_company(args.company, args.website, args.email))
        else:
            tasks.append(check_company(**SAMPLE_COMPANY))
        print("Checking... the company check can take up to 90 seconds.")

    started = time.perf_counter()
    results = await asyncio.gather(*tasks)
    for result in results:
        _print(result)

    verdict = combine(results)
    print(f"\n=== {verdict.title} ({verdict.colour}) ===")
    if verdict.note:
        print(verdict.note)
    print(verdict.disclaimer)
    print(f"\nFinished in {time.perf_counter() - started:.1f} s")


if __name__ == "__main__":
    asyncio.run(main())
