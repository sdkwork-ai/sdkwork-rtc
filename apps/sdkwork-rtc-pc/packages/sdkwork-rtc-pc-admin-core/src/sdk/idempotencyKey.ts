/**
 * Client-generated retry idempotency key (API_SPEC section 15.4/17): every
 * mutating SDK call carries a unique Idempotency-Key so retried requests are
 * deduplicated server-side by tenant, organization, method, and path.
 */
export function newIdempotencyKey(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
