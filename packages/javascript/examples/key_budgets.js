/**
 * key_budgets.js
 * Capping what an API key can spend, and auditing what it did.
 *
 * The problem this solves: you want to hand a key to a side project, a
 * contractor, or a CI pipeline without risking your whole balance. Give that
 * key a cap. It stops working at that amount; every other key carries on.
 *
 * The cap is a ceiling on the shared balance, not a separate wallet. Three keys
 * capped at $10 do not reserve $30 between them; they each simply stop at $10.
 *
 * Run:
 *   export SILKLLM_API_KEY=silk_your_key
 *   node key_budgets.js
 */

// File: silkllm-sdks/packages/javascript/examples/key_budgets.js

import SilkLLM, { InsufficientBalanceError } from "silkllm";

const client = new SilkLLM();

// ── Create a capped key ──────────────────────────────────────────────────────
// The plaintext key is on `.key` and is never retrievable again.
const key = await client.createKey({ name: "Side project", spendLimitUsd: 5.0 });
console.log(`Created ${key.name}`);
console.log(`  secret : ${key.key}   <- store this now, it is not shown again`);
console.log(`  cap    : $${key.spend_limit_usd.toFixed(2)}`);

// ── See where every key stands ───────────────────────────────────────────────
console.log("\nYour keys:");
for (const k of await client.listKeys()) {
  const budget = k.spend_limit_usd === null
    ? "uncapped"
    : `$${k.spent_usd.toFixed(4)} of $${k.spend_limit_usd.toFixed(2)}` +
      (k.is_exhausted ? "  (AT LIMIT)" : "");
  console.log(`  ${k.name.padEnd(20)} ${budget}`);
}

// ── Handle the cap being reached ─────────────────────────────────────────────
// A spent key answers 402 with the code `key_limit_exceeded`, which is distinct
// from an empty account balance, so you can tell the two apart and react
// differently: raise a cap, or top up.
const scoped = new SilkLLM({ apiKey: key.key });
try {
  await scoped.generate({
    messages: [{ role: "user", content: "Hello" }],
    model: "gpt-4o",
  });
} catch (err) {
  if (err instanceof InsufficientBalanceError && err.code === "key_limit_exceeded") {
    console.log("\nThis key is out of budget. Raising its cap instead of topping up.");
    await client.updateKey(key.id, { spendLimitUsd: 20.0 });
  } else if (err instanceof InsufficientBalanceError) {
    console.log("\nThe account itself is out of credit; add funds.");
  } else {
    throw err;
  }
}

// ── Audit what the key actually did ──────────────────────────────────────────
// Refused attempts are in here too, which is what makes this useful when a
// deployment stops working: a run of limit_exceeded rows says why.
const history = await client.keyUsage(key.id, { pageSize: 10 });
console.log(
  `\n${history.key_name}: ${history.total_requests} requests, ` +
  `$${history.total_cost_usd.toFixed(6)} spent in total`,
);
for (const e of history.entries) {
  const marker = e.status === "ok" ? "ok " : "REFUSED";
  const what = (e.served_model || e.endpoint).padEnd(24);
  console.log(`  ${e.created_at.slice(0, 19)}  ${marker}  ${what} $${e.cost_usd.toFixed(6)}`);
}

// Only the refusals, to see exactly when it ran out.
const refusals = await client.keyUsage(key.id, { status: "limit_exceeded" });
console.log(`\nBlocked ${refusals.total} time(s) by its cap.`);

// ── Start the budget again ───────────────────────────────────────────────────
// Resetting clears the counter the cap is measured against. It refunds nothing,
// and it leaves the usage history intact.
await client.resetKeyUsage(key.id);
console.log("\nCounter reset. Full budget again, history unchanged.");

// ── Remove the cap, or revoke the key ────────────────────────────────────────
// clearSpendLimit is a separate flag because omitting spendLimitUsd means
// "leave the cap as it is", not "remove it".
await client.updateKey(key.id, { clearSpendLimit: true });
console.log("Cap removed; the key can now use the whole balance.");

await client.revokeKey(key.id);
console.log("Key revoked. Its usage history is kept for audit.");

// EOF silkllm-sdks/packages/javascript/examples/key_budgets.js
