"""
metered-agent-key/agent_runtime.py

A minimal autonomous loop, run with a key produced by provision_agent_key.py.
It doesn't know or care what its own cap is - it just keeps working until
SilkLLM refuses a request, then stops itself cleanly instead of retrying into
an error loop.

Usage:
    SILKLLM_API_KEY=silk_the_scoped_key python agent_runtime.py
"""

import itertools

import silkllm

TASKS = itertools.count(1)  # stand-in for a real task queue


def next_task() -> str:
    n = next(TASKS)
    return f"Summarize why request #{n} matters in one sentence."


def main() -> None:
    client = silkllm.Client()
    completed = 0

    while True:
        task = next_task()
        try:
            res = client.generate(
                messages=[{"role": "user", "content": task}],
                model="gpt-4o-mini",
                max_tokens=100,
            )
        except silkllm.KeyLimitExceeded as e:
            print(f"\nStopping: this key has spent ${e.spent:.4f} of its ${e.limit:.2f} cap.")
            print(f"Completed {completed} task(s) before hitting the limit.")
            break
        except silkllm.InsufficientBalanceError:
            # Different problem: the account itself is out of credit, not
            # just this key's cap. An agent can't fix that on its own.
            print("\nStopping: the account has no credit left (not this key's cap).")
            break
        except silkllm.KeyScopeError as e:
            print(f"\nStopping: this key isn't allowed to call {e.details.get('model')}.")
            break

        completed += 1
        print(f"[{completed}] {res.content}  (${res.cost_usd:.6f})")

        if completed >= 500:  # a real agent would have its own real stop condition
            print("\nReached the task-loop safety limit, not the SilkLLM cap.")
            break


if __name__ == "__main__":
    main()
