# Security Specification — [اسم المشروع] Cloud Firestore

## 1. Architecture Context (Single-Workspace, No Login)
- `[اسم المشروع]` runs as a single-workspace (`workspaceId == 'master'`) operations console without a login screen (`بدون تسجيل دخول`), paired with direct REST `:commit` ingestion from in-game bookmarklet and Tampermonkey scripts into `/incomingVillageSyncs/{syncId}` and read-only plan fetching from `/villagePlans/{planDocId}`.
- **PII & Secret Isolation**: User account `password` and `email` fields are stripped by `sanitizeStateForFirestore` before cloud persistence and NEVER appear in `/userAccounts/{accountDocId}` or `ErpStateSnapshot`.

## 2. Data Invariants
1. **Global Default Deny**: The first block inside `/databases/{database}/documents` rejects all unmatched paths (`match /{document=**} { allow read, write: if false; }`).
2. **Path Variable Hardening (ID Poisoning Guard)**: Single-document operations (`get`, `create`, `update`, `delete`) enforce `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length `1..128`). List rules never invoke `isValidId()` on the collection wildcard or `get()`/`exists()` lookups.
3. **Master Workspace Lock**: `/erpStates/{stateId}` restricts document ID and `workspaceId` strictly to `'master'`, ensuring no orphaned state shards can be created.
4. **Anti-Update-Gap Schema Blueprints**: Every `create` and `update` invokes `isValid[Entity](incoming())`:
   - `create` validates exact required + allowed keys via `data.keys().hasAll([...]) && data.keys().hasOnly([...])` and path-to-field identity match (`docId == incoming().id` or `syncId`).
   - `update` enforces `incoming().id == existing().id` (or `workspaceId` / `syncId`) and whitelists mutable fields with `incoming().diff(existing()).affectedKeys().hasOnly([...])`.
5. **Temporal Integrity**: All writes require `data.updatedAt == request.time`, preventing client-spoofed timestamps.
6. **Type & Volumetric Constraints**: Every string validates `.size()` against its `maxLength` in `firebase-blueprint.json`, every integer/number validates finite non-negative bounds (`>= 0` and domain max), and `buildingsJson`/`unitsJson`/`stepsJson`/`stateJson` are strictly capped.
7. **Boot Connection Probe Isolation**: `/test/{docId}` permits only `allow get: if docId == 'connection';` and denies `list`, `create`, `update`, and `delete`.

## 3. The "Dirty Dozen" Adversarial Payloads
1. **Unmatched Subcollection Write**: Writing to `/arbitraryCollection/doc1` -> `PERMISSION_DENIED` (blocked by default deny).
2. **Non-Master ERP State Shard**: Creating `/erpStates/rogue_shard` with `workspaceId: 'rogue_shard'` -> `PERMISSION_DENIED` (`workspaceId == 'master'` required).
3. **Shadow/Ghost Field Injection on Create**: Creating `/userAccounts/u1` with extra key `isAdmin: true` -> `PERMISSION_DENIED` (`hasOnly` rejects).
4. **Shadow/Ghost Field Injection on Update**: Updating `/villages/v1` with extra field `hacked: 1` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)` + `isValidVillage` reject).
5. **Document ID / Field Mismatch**: Creating `/villages/vil_a` with `id: 'vil_b'` -> `PERMISSION_DENIED` (`villageDocId == incoming().id` rejects).
6. **Immutable Primary Key Reassignment**: Updating `/userAccounts/u1` changing `id` from `'u1'` to `'u2'` -> `PERMISSION_DENIED`.
7. **Client-Spoofed Timestamp**: Writing `/incomingVillageSyncs/s1` with hardcoded ISO string `updatedAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: Writing `/worlds/bad$id!@#` or 200-char doc ID -> `PERMISSION_DENIED` (`isValidId` rejects).
9. **Oversized Payload / Denial of Wallet**: Creating `/userAccounts/u1` with `name` of 500 characters (`> 120`) or `stateJson` > 950,000 bytes -> `PERMISSION_DENIED`.
10. **Numeric / Value Poisoning**: Updating `/villages/v1` with `spearsTotal: -5` or `"not_an_int"`, or `world.speed: -1` -> `PERMISSION_DENIED`.
11. **PII / Password Leakage Attempt**: Writing `/userAccounts/u1` including `password` or `email` field -> `PERMISSION_DENIED` (`hasOnly` rejects).
12. **Mutating Boot Probe Document**: Attempting `create`, `update`, `delete`, or `list` on `/test/connection` -> `PERMISSION_DENIED`.
