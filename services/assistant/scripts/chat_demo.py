"""
Chat with the running assistant from the terminal, the same way the app will.

Run from services/assistant while the assistant (8004) and the check services are running:

    py scripts/chat_demo.py
    py scripts/chat_demo.py --token <JWT from the app>

Type a message and press Enter. Buttons are shown as [1], [2], ...: type the number to press one.
    /image <path>   send a screenshot
    /session        print the saved conversation
    /quit           stop

The company check runs in the background: its result is printed when it arrives (checked before
each prompt), and when only the company check is left the script polls until it finishes.

The login token is created from JWT_SECRET in services/assistant/.env unless --token is given.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
POLL_SECONDS = 3


def _token(cli_token: str | None) -> str:
    if cli_token:
        return cli_token
    from dotenv import load_dotenv

    load_dotenv(ENV_FILE)
    secret = (os.getenv("JWT_SECRET") or "").strip()
    if not secret:
        sys.exit("No login token: set JWT_SECRET in services/assistant/.env or pass --token.")
    import jwt

    now = int(time.time())
    payload = {"userId": "assistant-chat-demo", "iat": now, "exp": now + 3600}
    return jwt.encode(payload, secret, algorithm="HS256")


def _show(text: str, chips: list[dict], result: dict | None) -> None:
    print(f"\nAssistant: {text}")
    if result:
        print(f"\n  === {result['title']} ({result['colour']}) ===")
        if result.get("note"):
            print(f"  {result['note']}")
        print(f"  {result['disclaimer']}")
    if chips:
        print("  " + "   ".join(f"[{i}] {c['label']}" for i, c in enumerate(chips, 1)))


class Demo:
    def __init__(self, client: httpx.Client):
        self.client = client
        self.session_id: str | None = None
        self.chips: list[dict] = []
        self.seen = 0  # messages in the conversation already printed

    def send(self, **form) -> dict:
        image = form.pop("image", None)
        files = {"image": (image.name, image.read_bytes())} if image else None
        data = {k: v for k, v in {"session_id": self.session_id, **form}.items() if v}
        res = self.client.post("/assistant/message", data=data, files=files)
        if res.status_code != 200:
            print(f"\n[error {res.status_code}] {res.text}")
            return {}
        body = res.json()
        if body["session_id"] != self.session_id:
            self.session_id, self.seen = body["session_id"], 0
        self.chips = body["chips"]
        _show(body["reply"], body["chips"], body.get("result"))
        self.sync(skip_text=body["reply"])
        if body["awaiting"] == "waiting":
            self.wait()
        return body

    def sync(self, skip_text: str | None = None) -> dict:
        """Print assistant messages added by background checks since the last look."""
        view = self.client.get(f"/assistant/session/{self.session_id}").json()
        new = [m for m in view["messages"][self.seen:] if m["role"] == "assistant" and m["text"] != skip_text]
        self.seen = len(view["messages"])
        for m in new:
            self.chips = view["chips"]
            _show(m["text"], view["chips"], view.get("result"))
        return view

    def wait(self) -> None:
        print("  (waiting for the background check...)")
        while True:
            time.sleep(POLL_SECONDS)
            view = self.sync()
            if view["awaiting"] != "waiting":
                return


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="http://127.0.0.1:8004")
    p.add_argument("--token")
    args = p.parse_args()

    headers = {"Authorization": f"Bearer {_token(args.token)}"}
    with httpx.Client(base_url=args.url, headers=headers, timeout=120) as client:
        demo = Demo(client)
        if not demo.send():
            return

        while True:
            demo.sync()
            try:
                line = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return
            if not line:
                continue
            if line == "/quit":
                return
            if line == "/session":
                print(json.dumps(client.get(f"/assistant/session/{demo.session_id}").json(), indent=2))
                continue

            if line.isdigit() and 1 <= int(line) <= len(demo.chips):
                demo.send(chip=demo.chips[int(line) - 1]["id"])
            elif line.startswith("/image "):
                path = Path(line[len("/image "):].strip().strip('"'))
                if not path.is_file():
                    print(f"No such file: {path}")
                    continue
                demo.send(image=path)
            else:
                demo.send(text=line)


if __name__ == "__main__":
    main()
