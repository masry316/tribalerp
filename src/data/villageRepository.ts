import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import type { AssignedPlan, ErpVillage } from '../core';
import { prepareVillagePlanDoc, sanitizeDocId } from './blueprintConstraints';
import { OperationType, handleFirestoreError, initFirebaseClient } from './firebaseClient';

export async function deleteVillageFromCloud(vil: Partial<ErpVillage>): Promise<void> {
  const client = initFirebaseClient();
  if (!client) return;

  if (vil.id) {
    const vilDocId = sanitizeDocId(vil.id);
    const planDocId = sanitizeDocId(`plan_${vil.id}`);
    try {
      await deleteDoc(doc(client.db, 'villages', vilDocId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `villages/${vilDocId}`);
    }
    try {
      await deleteDoc(doc(client.db, 'villagePlans', planDocId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `villagePlans/${planDocId}`);
    }
  }

  if (vil.villageId) {
    const cleanGid = String(vil.villageId).replace(/[^a-zA-Z0-9_\-]/g, '');
    if (cleanGid) {
      const gamePlanId = sanitizeDocId(`game_${cleanGid}`);
      try {
        await deleteDoc(doc(client.db, 'villagePlans', gamePlanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `villagePlans/${gamePlanId}`);
      }
    }
  }
}

export async function deleteWorldFromCloud(worldId: string): Promise<void> {
  const client = initFirebaseClient();
  if (!client || !worldId) return;
  const worldDocId = sanitizeDocId(worldId);
  try {
    await deleteDoc(doc(client.db, 'worlds', worldDocId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `worlds/${worldDocId}`);
  }
}

export async function syncAssignedPlanToCloud(
  vil: ErpVillage,
  plan: AssignedPlan | null,
  simType: string = 'virtual26'
): Promise<void> {
  const client = initFirebaseClient();
  if (!client) return;

  const erpPlanId = sanitizeDocId(`plan_${vil.id}`);
  const cleanGameVillageId = String(vil.villageId || vil.id || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  const gamePlanId = cleanGameVillageId ? sanitizeDocId(`game_${cleanGameVillageId}`) : null;

  if (!plan) {
    try {
      await deleteDoc(doc(client.db, 'villagePlans', erpPlanId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `villagePlans/${erpPlanId}`);
    }
    if (gamePlanId) {
      try {
        await deleteDoc(doc(client.db, 'villagePlans', gamePlanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `villagePlans/${gamePlanId}`);
      }
    }
    return;
  }

  const erpDoc = prepareVillagePlanDoc(erpPlanId, vil.id, vil, plan, simType);
  try {
    await setDoc(doc(client.db, 'villagePlans', erpPlanId), erpDoc, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `villagePlans/${erpPlanId}`);
  }

  if (gamePlanId) {
    const gameDoc = prepareVillagePlanDoc(gamePlanId, cleanGameVillageId, vil, plan, simType);
    try {
      await setDoc(doc(client.db, 'villagePlans', gamePlanId), gameDoc, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `villagePlans/${gamePlanId}`);
    }
  }
}
