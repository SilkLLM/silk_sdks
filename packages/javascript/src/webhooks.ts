/**
 * webhooks.ts
 * Verifying an inbound webhook delivery.
 *
 * Deliberately free of any dependency on the client: the code that receives a
 * webhook is a request handler in your app, and it has a secret and some bytes,
 * not a configured SDK instance.
 *
 *   import { verifyWebhook } from "@silkllm/sdk";
 *
 *   app.post("/hooks/silkllm", express.raw({ type: "*./*" }), async (req, res) => {
 *     const ok = await verifyWebhook(SECRET, req.body, req.header("X-Silk-Signature"));
 *     if (!ok) return res.sendStatus(401);
 *     const event = JSON.parse(req.body.toString());
 *   });
 *
 * Note the raw body. Re-serialising a parsed object changes key order and
 * spacing, and the signature is over the exact bytes that were sent.
 */

// File: silkllm-sdks/packages/javascript/src/webhooks.ts

/** The header carrying the signature over the request body. */
export const SIGNATURE_HEADER = "X-Silk-Signature";
/** The header carrying the unix timestamp the delivery was sent at. */
export const TIMESTAMP_HEADER = "X-Silk-Timestamp";

function toBytes(body: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

/** Produce the signature for a body, in the same form the header carries. */
export async function sign(secret: string, body: string | Uint8Array | ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, toBytes(body) as BufferSource);
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

/**
 * Check that a delivery really came from SilkLLM.
 *
 * The comparison runs in constant time, so a rejection does not leak how much
 * of a forged signature was correct through how long it took to reject it.
 *
 * @param secret The signing secret shown once when the webhook was created.
 * @param body The exact bytes of the request body, not a re-serialised object.
 * @param signature The value of the X-Silk-Signature header.
 */
export async function verifyWebhook(
  secret: string,
  body: string | Uint8Array | ArrayBuffer,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const expected = await sign(secret, body);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// EOF silkllm-sdks/packages/javascript/src/webhooks.ts
