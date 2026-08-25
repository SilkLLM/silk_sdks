# Metered agent key

Give an autonomous agent its own SilkLLM key that structurally cannot
overspend, rather than trusting the agent's own code to behave.

> A common ask here is a "cryptographic wallet" for an agent - SilkLLM
> doesn't have on-chain or wallet functionality, so that's not what this is.
> What it does have, and what actually solves the underlying problem (an
> agent that runs unattended shouldn't be able to drain your account), is a
> capped, scoped API key: a spend limit, a rate limit, and a model
> allowlist, enforced by SilkLLM before any provider is ever called - not by
> the agent choosing to respect a budget it was told about.

```
provision_agent_key.py        (you run this once)
        │
        ▼
   a silk_... key capped at, say, $5, 20 req/min, gpt-4o-mini only
        │
        ▼
agent_runtime.py               (the agent runs this, unattended)
        │
        ▼
   generates normally until the cap is hit, then stops itself cleanly
```

## Run it

```bash
pip install -e ../../packages/python
export SILKLLM_API_KEY=silk_your_account_key   # a key with no cap, used once to provision

python provision_agent_key.py "research-agent-01" --limit 5.00 --rate 20 --model gpt-4o-mini
# -> prints a new silk_... key. Give this one to the agent process instead.

SILKLLM_API_KEY=silk_the_new_scoped_key python agent_runtime.py
```

## What to look at

- `provision_agent_key.py` calls `client.create_key()` with `spend_limit_usd`,
  `rate_limit_per_min` and `allowed_models` - every control is optional and
  independent, so use only the ones a given agent needs.
- The cap is enforced server-side, before a provider is contacted - a
  refused request costs nothing, so a runaway agent loop is a contained,
  visible failure instead of a drained account.
- `agent_runtime.py` catches `silkllm.KeyLimitExceeded` specifically (not a
  generic exception) and reads `.limit` / `.spent` straight off it, which is
  how an agent tells "I'm out of budget" apart from "the account is out of
  money" ([`silkllm.InsufficientBalanceError`](../../packages/python/silkllm/exceptions.py))
  without parsing an error string.
