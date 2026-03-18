#!/usr/bin/env python3
"""
Upstox OAuth2 token generator.

Run once per trading day before starting the API:
    python scripts/upstox_auth.py

Prerequisites:
  1. Register an app at https://account.upstox.com/developer/apps
  2. Set Redirect URL to: http://127.0.0.1:8000/callback  (or any URL you control)
  3. Note your API Key and API Secret

The script will:
  - Print the authorization URL (open it in your browser)
  - Ask you to paste the 'code' from the redirect
  - Exchange it for an access token
  - Write UPSTOX_ACCESS_TOKEN to apps/api/.env automatically
"""

import sys
import re
import urllib.parse
from pathlib import Path

try:
    import httpx
except ImportError:
    print("httpx not installed. Run: pip install httpx")
    sys.exit(1)

ENV_FILE = Path(__file__).parent.parent / "apps" / "api" / ".env"


def update_env(key: str, value: str) -> None:
    content = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    pattern = rf"^{key}=.*$"
    new_line = f"{key}={value}"
    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, new_line, content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + f"\n{new_line}\n"
    ENV_FILE.write_text(content)


def main() -> None:
    print("=== Upstox Access Token Generator ===\n")

    api_key = input("API Key: ").strip()
    api_secret = input("API Secret: ").strip()
    redirect_uri = input("Redirect URI (must match your Upstox app): ").strip()

    auth_url = (
        "https://api.upstox.com/v2/login/authorization/dialog"
        f"?response_type=code"
        f"&client_id={urllib.parse.quote(api_key)}"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
    )

    print(f"\nOpen this URL in your browser:\n\n  {auth_url}\n")
    print("After logging in, Upstox will redirect to your Redirect URI.")
    print("The URL will look like: http://127.0.0.1:8000/callback?code=XXXXXXXX\n")

    raw = input("Paste the full redirect URL, the auth code, or an existing access token: ").strip()

    # If it looks like a JWT (access token), use it directly
    if raw.count(".") == 2 and raw.startswith("eyJ"):
        token = raw
        print("\nDetected existing access token — skipping exchange step.")
    else:
        # Extract code from full URL or use raw value as code
        if raw.startswith("http"):
            parsed = urllib.parse.urlparse(raw)
            code = urllib.parse.parse_qs(parsed.query).get("code", [None])[0]
            if not code:
                print("Could not extract 'code' from URL.")
                sys.exit(1)
        else:
            code = raw

        print("\nExchanging code for access token...")

        resp = httpx.post(
            "https://api.upstox.com/v2/login/authorization/token",
            data={
                "code": code,
                "client_id": api_key,
                "client_secret": api_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )

        if resp.status_code != 200:
            print(f"Error {resp.status_code}: {resp.text}")
            sys.exit(1)

        token = resp.json().get("access_token")
        if not token:
            print(f"Unexpected response: {resp.json()}")
            sys.exit(1)

    update_env("UPSTOX_ACCESS_TOKEN", token)
    print(f"\nSuccess! Token written to {ENV_FILE}")
    print("Restart the API server to pick it up.\n")


if __name__ == "__main__":
    main()
