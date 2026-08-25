"""
metered-agent-key/provision_agent_key.py

Creates a new SilkLLM API key capped for a specific autonomous agent, and
prints it once (SilkLLM never returns the plaintext key again after this).
Run this with your own, uncapped account key - the key it creates is the one
you actually hand to the agent process.

Usage:
    python provision_agent_key.py "research-agent-01" \
        --limit 5.00 --rate 20 --model gpt-4o-mini
"""

import argparse

import silkllm


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="A label for this key, e.g. the agent's name")
    parser.add_argument("--limit", type=float, default=None, help="Spend cap in USD (default: uncapped)")
    parser.add_argument("--rate", type=int, default=None, help="Requests per minute ceiling")
    parser.add_argument("--model", action="append", default=None, help="Allowed model id (repeatable)")
    parser.add_argument("--alert-at", type=int, default=80, help="Alert threshold, percent of the cap")
    args = parser.parse_args()

    client = silkllm.Client()
    key = client.create_key(
        args.name,
        spend_limit_usd=args.limit,
        alert_at_percent=args.alert_at if args.limit else None,
        allowed_models=args.model,
        rate_limit_per_min=args.rate,
    )

    print(f"Created key for '{args.name}': {key.id}")
    print(f"  spend_limit_usd:    {key.spend_limit_usd}")
    print(f"  rate_limit_per_min: {key.rate_limit_per_min}")
    print(f"  allowed_models:     {key.allowed_models}")
    print()
    print("Hand this key to the agent process. It will not be shown again:")
    print(f"  {key.key}")


if __name__ == "__main__":
    main()
