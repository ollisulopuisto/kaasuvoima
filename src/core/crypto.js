const ALG = 'AES-GCM';
const IV_LEN = 12;
const PEPPER = 'kaasuvoima-save-v2';

function getOrigin() {
  return typeof location !== 'undefined' && location.origin
    ? location.origin
    : 'kaasuvoima-test';
}

async function keyFor(origin) {
  const material = new TextEncoder().encode(PEPPER + '\0' + origin);
  const raw = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey('raw', raw, { name: ALG }, false, ['encrypt', 'decrypt']);
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/* Symmetric encryption for data written to localStorage so it is never stored
 * in clear text. The key is derived from a fixed pepper plus the origin, so it
 * is stable across sessions without keeping any key material in localStorage
 * alongside the ciphertext. */
export async function encrypt(plaintext, origin) {
  const key = await keyFor(origin ?? getOrigin());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = await crypto.subtle.encrypt({ name: ALG, iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(IV_LEN + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), IV_LEN);
  return toBase64(out);
}

export async function decrypt(ciphertext, origin) {
  if (ciphertext == null) return null;
  let bytes;
  try {
    bytes = fromBase64(ciphertext);
  } catch {
    return null;
  }
  if (bytes.length < IV_LEN + 1) return null;
  const key = await keyFor(origin ?? getOrigin());
  const iv = bytes.slice(0, IV_LEN);
  const ct = bytes.slice(IV_LEN);
  try {
    const pt = await crypto.subtle.decrypt({ name: ALG, iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
