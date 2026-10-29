import assert from 'node:assert/strict';
import { Save, DEFAULT_SAVE } from '../src/core/save.js';

/* Shim localStorage so this module can run in Node. */
const store = new Map();
globalThis.localStorage = {
  getItem(k) { return store.has(k) ? String(store.get(k)) : null; },
  setItem(k, v) { store.set(k, String(v)); },
  removeItem(k) { store.delete(k); },
};
/* Origin is needed by the crypto key derivation. */
globalThis.location = { origin: 'https://kaasuvoima.test' };

async function roundTrip(state) {
  await Save.write(state);
  const raw = globalThis.localStorage.getItem('sfb3.save.v2');
  const loaded = await Save.load();
  return { raw, loaded };
}

(async () => {
  // 1. Round trip preserves state
  const want = { lives: 3, coins: 9, score: 4200, mode: 'hard', secrets: { '1-1': ['a'] } };
  const { raw, loaded } = await roundTrip({ ...DEFAULT_SAVE(), ...want });
  assert.strictEqual(loaded.lives, 3);
  assert.strictEqual(loaded.coins, 9);
  assert.strictEqual(loaded.score, 4200);
  assert.strictEqual(loaded.mode, 'hard');
  assert.deepStrictEqual(loaded.secrets, { '1-1': ['a'] });
  assert.deepStrictEqual(loaded.power, { type: null, level: 0 });

  // 2. Stored value is ciphertext, not clear text
  const json = JSON.stringify({ lives: 3 });
  assert.notStrictEqual(raw, json, 'save must not be clear text');
  const { decrypt } = await import('../src/core/crypto.js');
  const dec = await decrypt(raw);
  assert.strictEqual(JSON.parse(dec).lives, 3);

  // 3. Migration: an old clear-text save still loads
  store.clear();
  globalThis.localStorage.setItem('sfb3.save.v2', JSON.stringify({ lives: 3, coins: 7, score: 4200 }));
  const migrated = await Save.load();
  assert.strictEqual(migrated.lives, 3);
  assert.strictEqual(migrated.coins, 7);
  assert.strictEqual(migrated.score, 4200);
  assert.deepStrictEqual(migrated.secrets, {}); // DEFAULT_SAVE fills missing

  // 4. Next write re-encrypts the migrated save
  await Save.write(migrated);
  const again = globalThis.localStorage.getItem('sfb3.save.v2');
  assert.notStrictEqual(again, JSON.stringify(migrated));

  // 5. Empty storage yields DEFAULT_SAVE
  store.clear();
  assert.deepStrictEqual(await Save.load(), DEFAULT_SAVE());

  // 6. Corrupt storage yields DEFAULT_SAVE
  store.clear();
  globalThis.localStorage.setItem('sfb3.save.v2', 'not valid json or ciphertext');
  assert.deepStrictEqual(await Save.load(), DEFAULT_SAVE());

  // 7. exists() / clear() unaffected
  store.clear();
  assert.strictEqual(Save.exists(), false);
  await Save.write({ ...DEFAULT_SAVE(), lives: 1 });
  assert.strictEqual(Save.exists(), true);
  Save.clear();
  assert.strictEqual(Save.exists(), false);

  console.log('save: all tests passed');
})().catch((e) => { console.error('save test FAILED:', e); process.exit(1); });
