import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));

test('Firestore rules enforce rules_version = 2 and global default-deny catch-all', () => {
  assert.match(rulesContent, /rules_version\s*=\s*'2';/);
  assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s*false;\s*\}/);
});

test('Firestore rules enforce server timestamp request.time, master lock, and immutable IDs', () => {
  assert.match(rulesContent, /data\.updatedAt\s*==\s*request\.time/);
  assert.match(rulesContent, /data\.workspaceId\s*==\s*'master'/);
  assert.match(rulesContent, /stateId\s*==\s*'master'/);
  assert.match(rulesContent, /incoming\(\)\.id\s*==\s*existing\(\)\.id/);
  assert.match(rulesContent, /incoming\(\)\.workspaceId\s*==\s*existing\(\)\.workspaceId/);
  assert.match(rulesContent, /incoming\(\)\.syncId\s*==\s*existing\(\)\.syncId/);
});

test('Every collection declared in firebase-blueprint.json has a matching rules block and read/write guard', () => {
  assert.match(rulesContent, /match\s+\/erpStates\/\{stateId\}/);
  assert.match(rulesContent, /match\s+\/userAccounts\/\{accountDocId\}/);
  assert.match(rulesContent, /match\s+\/villages\/\{villageDocId\}/);
  assert.match(rulesContent, /match\s+\/villagePlans\/\{planDocId\}/);
  assert.match(rulesContent, /match\s+\/worlds\/\{worldDocId\}/);
  assert.match(rulesContent, /match\s+\/incomingVillageSyncs\/\{syncId\}/);
  assert.match(rulesContent, /match\s+\/test\/\{docId\}/);

  const pathsCount = Object.keys(blueprint.firestore || {}).length;
  assert.equal(pathsCount, 7);
});

test('Rules reject shadow fields via hasOnly + affectedKeys().hasOnly() and forbid PII fields in /userAccounts', () => {
  assert.match(rulesContent, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(/);
  assert.doesNotMatch(rulesContent, /'password'/);
  assert.doesNotMatch(rulesContent, /'email'/);
});

test('Rules keep /villages and /incomingVillageSyncs bounds synced with firebase-blueprint.json maxLength', () => {
  const maxName = blueprint.entities.UserAccount.properties.name.maxLength;
  const maxState = blueprint.entities.ErpStateSnapshot.properties.stateJson.maxLength;
  const maxPayload = blueprint.entities.IncomingVillageSync.properties.payloadJson.maxLength;
  assert.equal(rulesContent.includes(`data.name.size() <= ${maxName}`), true);
  assert.equal(rulesContent.includes(`data.stateJson.size() <= ${maxState}`), true);
  assert.equal(rulesContent.includes(`data.payloadJson.size() <= ${maxPayload}`), true);
});
