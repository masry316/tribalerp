import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHumanIdentity } from '../../src/core/engines/identityGenerator';

function makeSeededRng(seedStart: number) {
  let s = seedStart >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('generateHumanIdentity generates realistic Arabic identities with bare email username (no @)', () => {
  const rng = makeSeededRng(42);
  const seenNames = new Set<string>();

  for (let i = 0; i < 20; i++) {
    const id = generateHumanIdentity('ar', Array.from(seenNames), rng);
    assert.equal(id.lang, 'ar');
    assert.ok(id.emailUser.length >= 5, `emailUser too short: ${id.emailUser}`);
    assert.equal(id.emailUser.includes('@'), false, `emailUser must not contain @: ${id.emailUser}`);
    assert.match(id.emailUser, /^[a-z0-9._]+$/, `emailUser must be clean lowercase username: ${id.emailUser}`);
    assert.match(id.accountName, /[\u0600-\u06FF]/, `Arabic accountName expected: ${id.accountName}`);
    assert.ok(id.password.length >= 8, `password too short: ${id.password}`);
    assert.match(id.password, /[A-Z]/, 'password should contain capitalized root word');
    assert.match(id.password, /\d/, 'password should contain digits');
    assert.equal(seenNames.has(id.accountName.toLowerCase()), false, 'must avoid collisions with existing names');
    seenNames.add(id.accountName.toLowerCase());
  }
});

test('generateHumanIdentity generates realistic English identities with bare email username (no @)', () => {
  const rng = makeSeededRng(99);
  const seenNames = new Set<string>();

  for (let i = 0; i < 20; i++) {
    const id = generateHumanIdentity('en', Array.from(seenNames), rng);
    assert.equal(id.lang, 'en');
    assert.equal(id.emailUser.includes('@'), false, `emailUser must not contain @: ${id.emailUser}`);
    assert.match(id.emailUser, /^[a-z0-9._]+$/);
    assert.match(id.accountName, /^[A-Za-z0-9 ]+$/, `English accountName expected: ${id.accountName}`);
    assert.ok(id.password.length >= 8);
    assert.equal(seenNames.has(id.accountName.toLowerCase()), false);
    seenNames.add(id.accountName.toLowerCase());
  }
});
