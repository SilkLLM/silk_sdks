"""
byok_marketplace.py
Deposit and manage your own provider keys (BYOK marketplace).

Run:
    export SILKLLM_API_KEY=silk_your_key
    python byok_marketplace.py
"""

# File: silkllm-sdks/packages/python/examples/byok_marketplace.py

import os
import silkllm

client = silkllm.Client(
    api_key=os.environ.get("SILKLLM_API_KEY", "silk_your_key"),
)

# Deposit a public key: SilkLLM may serve other users with it, and you earn
# platform credits (75% of provider cost) when they do. Never shown to others.
key = client.deposit_provider_key(
    provider_id="openai",
    api_key="sk-replace-with-your-real-openai-key",
    label="shared openai",
    is_public=True,
    declared_budget_usd=25.0,   # we never spend past this
)
print(f"Deposited: {key.id}  status={key.status}  public={key.is_public}")

# See your keys, earnings, and how many requests each has served.
for k in client.list_provider_keys():
    print(f"- {k.label} [{k.provider_id}] public={k.is_public} "
          f"earned=${k.earned_credits_total:.4f} served={k.requests_served}")

# Prefer to keep your own traffic off your own key while still sharing it.
client.update_provider_key(key.id, serve_owner_with_own_key=False)

# Revoke when you are done. It stops being used immediately.
client.revoke_provider_key(key.id)
print("Revoked.")

# EOF silkllm-sdks/packages/python/examples/byok_marketplace.py
