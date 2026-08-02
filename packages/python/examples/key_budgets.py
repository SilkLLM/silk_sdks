"""
key_budgets.py
Capping what an API key can spend, and auditing what it did.

The problem this solves: you want to hand a key to a side project, a contractor,
or a CI pipeline without risking your whole balance. Give that key a cap. It
stops working at that amount; every other key on the account carries on.

The cap is a ceiling on the shared balance, not a separate wallet. Three keys
capped at $10 do not reserve $30 between them; they each simply stop at $10.

Usage:
    export SILKLLM_API_KEY=silk_your_key_here
    python key_budgets.py
"""

# File: silkllm-sdks/packages/python/examples/key_budgets.py

import silkllm
from silkllm import InsufficientBalanceError

client = silkllm.Client()

# ── Create a capped key ──────────────────────────────────────────────────────
# The plaintext key is on `.key` and is never retrievable again.
key = client.create_key("Side project", spend_limit_usd=5.00)
print(f"Created {key.name}")
print(f"  secret : {key.key}          <- store this now, it is not shown again")
print(f"  cap    : ${key.spend_limit_usd:.2f}")

# ── See where every key stands ───────────────────────────────────────────────
print("\nYour keys:")
for k in client.list_keys():
    if k.spend_limit_usd is None:
        budget = "uncapped"
    else:
        budget = f"${k.spent_usd:.4f} of ${k.spend_limit_usd:.2f}"
        if k.is_exhausted:
            budget += "  (AT LIMIT)"
    print(f"  {k.name:<20} {budget}")

# ── Handle the cap being reached ─────────────────────────────────────────────
# A spent key answers 402 with the code `key_limit_exceeded`, which is distinct
# from an empty account balance, so you can tell the two apart and react
# differently: raise a cap, or top up.
scoped = silkllm.Client(api_key=key.key)
try:
    scoped.generate(messages=[{"role": "user", "content": "Hello"}], model="gpt-4o")
except InsufficientBalanceError as e:
    if getattr(e, "code", "") == "key_limit_exceeded":
        print("\nThis key is out of budget. Raising its cap instead of topping up.")
        client.update_key(key.id, spend_limit_usd=20.00)
    else:
        print("\nThe account itself is out of credit; add funds.")

# ── Audit what the key actually did ──────────────────────────────────────────
# Refused attempts are in here too, which is what makes this useful when a
# deployment stops working: a run of limit_exceeded rows says why.
history = client.key_usage(key.id, page_size=10)
print(f"\n{history.key_name}: {history.total_requests} requests, "
      f"${history.total_cost_usd:.6f} spent in total")
for entry in history.entries:
    marker = "ok " if entry.status == "ok" else "REFUSED"
    print(f"  {entry.created_at[:19]}  {marker}  {entry.served_model or entry.endpoint:<24} "
          f"${entry.cost_usd:.6f}")

# Only the refusals, to see exactly when it ran out.
refusals = client.key_usage(key.id, status="limit_exceeded")
print(f"\nBlocked {refusals.total} time(s) by its cap.")

# ── Start the budget again ───────────────────────────────────────────────────
# Resetting clears the counter the cap is measured against. It refunds nothing,
# and it leaves the usage history intact.
client.reset_key_usage(key.id)
print("\nCounter reset. The key has its full budget again and its history is unchanged.")

# ── Remove the cap, or revoke the key ────────────────────────────────────────
# clear_spend_limit is a separate flag because passing None means "leave the cap
# as it is", not "remove it".
client.update_key(key.id, clear_spend_limit=True)
print("Cap removed; the key can now use the whole balance.")

client.revoke_key(key.id)
print("Key revoked. Its usage history is kept for audit.")

# EOF silkllm-sdks/packages/python/examples/key_budgets.py
