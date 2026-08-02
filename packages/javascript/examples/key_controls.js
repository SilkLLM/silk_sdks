/**
 * key_controls.js
 * Scopes, rate limits, shared budgets and webhooks.
 *
 * A spend cap answers "how much". This example covers the rest: what a key may
 * call, how fast it may call it, whose budget it shares, and how you find out
 * before a customer does.
 *
 * The shape of the problem: you hand a key to a service that only needs one
 * cheap model, and you would rather a bug in that service could not empty the
 * account, could not reach an expensive model by accident, and could not hammer
 * the API in a loop. Each of those is one option.
 *
 * Usage:
 *   export SILKLLM_API_KEY=silk_your_key_here
 *   node key_controls.js
 */

// File: silkllm-sdks/packages/javascript/examples/key_controls.js

import SilkLLM, {
  KeyLimitExceeded, KeyRateLimited, KeyScopeError,
  PoolLimitExceeded, InsufficientBalanceError,
} from "silkllm";
import { writeFile } from "node:fs/promises";

const client = new SilkLLM();   // reads SILKLLM_API_KEY; the endpoint is built in

// ── A shared budget ────────────────────────────────────────────────────────
// One ceiling for a whole team, however many keys are handed out inside it.

const team = await client.createBudget("Mobile team", 200);
console.log(`Shared budget: ${team.name}, limit $${team.spend_limit_usd}`);

// ── A key with every control set ───────────────────────────────────────────

const key = await client.createKey({
  name: "CI pipeline",
  spendLimitUsd: 5.0,             // this key stops at $5
  alertAtPercent: 80,             // notify me at $4, before it stops
  allowedModels: ["gpt-4o-mini"], // anything else is refused
  rateLimitPerMin: 30,            // a runaway loop is slowed, not funded
  budgetPoolId: team.id,          // and it draws on the team budget too
});
console.log(`Key created: ${key.name}`);
console.log(`  cap        $${key.spend_limit_usd}`);
console.log(`  alert at   ${key.alert_at_percent}%`);
console.log(`  models     ${key.allowed_models}`);
console.log(`  rate       ${key.rate_limit_per_min}/min`);

// ── Using it, and reacting to whichever limit bites ────────────────────────
// Each limit throws its own error carrying the figures behind the message, so
// nothing here has to parse an English sentence to decide what to do.

const scoped = new SilkLLM({ apiKey: key.key });
try {
  const response = await scoped.generate({
    messages: [{ role: "user", content: "Say hello." }],
    model: "gpt-4o-mini",
  });
  console.log(`Served: ${response.content.slice(0, 60)}`);
} catch (e) {
  if (e instanceof KeyScopeError) {
    console.log(`This key may not call ${e.details.model}. Widen allowedModels.`);
  } else if (e instanceof KeyRateLimited) {
    console.log(`Too fast. Retry in ${e.details.retry_after}s.`);
  } else if (e instanceof KeyLimitExceeded) {
    console.log(`Key spent ${e.details.spent} of ${e.details.limit}. Raise it or reset it.`);
  } else if (e instanceof PoolLimitExceeded) {
    console.log(`The '${e.details.pool_name}' budget is used up. This key is fine.`);
  } else if (e instanceof InsufficientBalanceError) {
    console.log("The account itself is out of credit. Top up.");
  } else {
    throw e;
  }
}

// ── Webhooks ───────────────────────────────────────────────────────────────
// So you hear about a limit rather than discovering it from a failed request.

console.log("Subscribable events:", await client.webhookEvents());

const hook = await client.createWebhook(
  "https://your-app.example.com/hooks/silkllm",
  ["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
);
console.log(`Webhook secret (shown once): ${hook.secret.slice(0, 12)}...`);

// Waits for the delivery and reports what your endpoint answered, so the
// signature check can be proven to work before a real limit is reached.
const result = await client.testWebhook(hook.id);
console.log(`Test delivery: delivered=${result.delivered} status=${result.status_code}`);

// Verify one on the receiving end like this:
//
//   import { verifyWebhook } from "silkllm";
//
//   app.post("/hooks/silkllm", express.raw({ type: "*/*" }), async (req, res) => {
//     const ok = await verifyWebhook(SECRET, req.body, req.header("X-Silk-Signature"));
//     if (!ok) return res.sendStatus(401);
//     ...
//   });
//
// Note the raw body: re-serialising a parsed object changes key order and
// spacing, and the signature is over the exact bytes that were sent.

// ── Auditing ───────────────────────────────────────────────────────────────

const usage = await client.keyUsage(key.id, { pageSize: 10 });
console.log(`${usage.total_requests} requests, $${usage.total_cost_usd.toFixed(6)} spent`);
for (const entry of usage.entries.slice(0, 5)) {
  console.log(`  ${entry.created_at}  ${entry.status.padEnd(16)} ${entry.served_model ?? "n/a"}`);
}

await writeFile("audit.csv", await client.exportKeyUsage(key.id));
console.log("Full history written to audit.csv, refused attempts included.");

// ── Loosening a control again ──────────────────────────────────────────────
// Removal needs an explicit flag: an omitted field means "leave as is", so
// without the flags a call that only renamed a key could never take a limit off.

await client.updateKey(key.id, { clearRateLimit: true, clearScope: true });
console.log("Rate limit and model allowlist removed. The spend cap is still in place.");

// ── Tidying up ─────────────────────────────────────────────────────────────

await client.revokeKey(key.id);
await client.deleteWebhook(hook.id);
await client.deleteBudget(team.id);   // keys on it keep working, on their own caps
console.log("Cleaned up.");

// EOF silkllm-sdks/packages/javascript/examples/key_controls.js
