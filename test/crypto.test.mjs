import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../src/core/crypto.js';

(async () => {
  // 1. Round trip
  const ct = await encrypt('{"lives":4,"coins":7}');
  assert.strictEqual(await decrypt(ct), '{"lives":4,"coins":7}');

  // 2. Not clear text
  assert.notStrictEqual(ct, '{"lives":4,"coins":7}');

  // 3. Tampered / invalid ciphertext must not decrypt
  assert.strictEqual(await decrypt(ct + 'AAAA'), null);
  assert.strictEqual(await decrypt('not-base64!!!'), null);

  // 4. Empty / null input decrypts to null
  assert.strictEqual(await decrypt(''), null);
  assert.strictEqual(await decrypt(null), null);
  assert.strictEqual(await decrypt(undefined), null);

  // 5. Same plaintext yields different ciphertext (random IV)
  const a = await encrypt('x');
  const b = await encrypt('x');
  assert.notStrictEqual(a, b);

  // 6. Ciphertext encrypted under one origin must not decrypt under another
  const crossCt = await encrypt('{"lives":1}', 'https://other.example');
  assert.strictEqual(await decrypt(crossCt, 'https://victim.example'), null);
  assert.strictEqual(await decrypt(crossCt, 'https://other.example'), '{"lives":1}');

  console.log('crypto: all tests passed');
})().catch((e) => { console.error('crypto test FAILED:', e.message); process.exit(1); });
