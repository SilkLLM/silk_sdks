"""
key_controls.py
Scopes, rate limits, shared budgets and webhooks.

A spend cap answers "how much". This example covers the rest: what a key may
call, how fast it may call it, whose budget it shares, and how you find out
before a customer does.

The shape of the problem: you hand a key to a service that only needs one cheap
model, and you would rather a bug in that service could not empty the account,
could not reach an expensive model by accident, and could not hammer the API in
a loop. Each of those is one argument.

Usage:
    export SILKLLM_API_KEY=silk_your_key_here
    python key_controls.py
"""

# File: silkllm-sdks/packages/python/examples/key_controls.py

import silkllm
from silkllm import (
    KeyLimitExceeded, KeyRateLimited, KeyScopeError,
    PoolLimitExceeded, InsufficientBalanceError,
)

client = silkllm.Client()   # reads SILKLLM_API_KEY; the endpoint is built in

# ── A shared budget ────────────────────────────────────────────────────────
# One ceiling for a whole team, however many keys are handed out inside it.

team = client.create_budget("Mobile team", spend_limit_usd=200)
print(f"Shared budget: {team['name']}, limit ${team['spend_limit_usd']}")

# ── A key with every control set ───────────────────────────────────────────

key = client.create_key(
    "CI pipeline",
    spend_limit_usd=5.0,            # this key stops at $5
    alert_at_percent=80,            # notify me at $4, before it stops
    allowed_models=["gpt-4o-mini"], # anything else is refused
    rate_limit_per_min=30,          # a runaway loop is slowed, not funded
    budget_pool_id=team["id"],      # and it draws on the team budget too
)
print(f"Key created: {key.name}")
print(f"  cap        ${key.spend_limit_usd}")
print(f"  alert at   {key.alert_at_percent}%")
print(f"  models     {key.allowed_models}")
print(f"  rate       {key.rate_limit_per_min}/min")

# ── Using it, and reacting to whichever limit bites ────────────────────────
# Each limit raises its own error carrying the figures behind the message, so
# nothing here has to parse an English sentence to decide what to do.

scoped = silkllm.Client(api_key=key.key)
try:
    response = scoped.generate(
        messages=[{"role": "user", "content": "Say hello."}],
        model="gpt-4o-mini",
    )
    print(f"Served: {response.content[:60]}")
except KeyScopeError as e:
    print(f"This key may not call {e.details['model']}. Widen allowed_models.")
except KeyRateLimited as e:
    print(f"Too fast. Retry in {e.details['retry_after']}s.")
except KeyLimitExceeded as e:
    print(f"Key spent {e.details['spent']} of {e.details['limit']}. Raise it or reset it.")
except PoolLimitExceeded as e:
    print(f"The '{e.details['pool_name']}' budget is used up. This key is fine.")
except InsufficientBalanceError:
    print("The account itself is out of credit. Top up.")

# ── Webhooks ───────────────────────────────────────────────────────────────
# So you hear about a limit rather than discovering it from a failed request.

print("Subscribable events:", client.webhook_events())

hook = client.create_webhook(
    "https://your-app.example.com/hooks/silkllm",
    events=["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
)
print(f"Webhook secret (shown once): {hook['secret'][:12]}...")

# Waits for the delivery and reports what your endpoint answered, so the
# signature check can be proven to work before a real limit is reached.
result = client.test_webhook(hook["id"])
print(f"Test delivery: delivered={result['delivered']} status={result['status_code']}")

# Verify one on the receiving end like this:
#
#     from silkllm import verify_webhook
#
#     body = await request.body()      # the raw bytes, not a parsed dict
#     if not verify_webhook(SECRET, body, request.headers["X-Silk-Signature"]):
#         return Response(status_code=401)

# ── Auditing ───────────────────────────────────────────────────────────────

usage = client.key_usage(key.id, page_size=10)
print(f"{usage.total_requests} requests, ${usage.total_cost_usd:.6f} spent")
for entry in usage.entries[:5]:
    print(f"  {entry.created_at}  {entry.status:<16} {entry.served_model or 'n/a'}")

with open("audit.csv", "wb") as f:
    f.write(client.export_key_usage(key.id))
print("Full history written to audit.csv, refused attempts included.")

# ── Loosening a control again ──────────────────────────────────────────────
# Removal needs an explicit flag: an omitted argument means "leave as is", so
# without the flags a call that only renamed a key could never take a limit off.

client.update_key(key.id, clear_rate_limit=True, clear_scope=True)
print("Rate limit and model allowlist removed. The spend cap is still in place.")

# ── Tidying up ─────────────────────────────────────────────────────────────

client.revoke_key(key.id)
client.delete_webhook(hook["id"])
client.delete_budget(team["id"])   # keys on it keep working, on their own caps
print("Cleaned up.")

# EOF silkllm-sdks/packages/python/examples/key_controls.py
