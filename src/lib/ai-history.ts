import { AI_HISTORY_DB, AI_HISTORY_LIMIT, AI_HISTORY_STORE } from "../config/constants";
import type { AiHistoryItem } from "../types/editor";

export function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function openAiHistoryDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AI_HISTORY_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AI_HISTORY_STORE)) {
        db.createObjectStore(AI_HISTORY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getStoredAiImages() {
  const db = await openAiHistoryDb();
  return new Promise<AiHistoryItem[]>((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readonly");
    const request = transaction.objectStore(AI_HISTORY_STORE).getAll();
    request.onsuccess = () => {
      resolve(
        request.result
          .sort((a: AiHistoryItem, b: AiHistoryItem) => b.createdAt - a.createdAt)
          .slice(0, AI_HISTORY_LIMIT),
      );
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveStoredAiImage(entry: AiHistoryItem) {
  const db = await openAiHistoryDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readwrite");
    const store = transaction.objectStore(AI_HISTORY_STORE);
    store.put(entry);
    const request = store.getAll();
    request.onsuccess = () => {
      const overflow = request.result
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(AI_HISTORY_LIMIT);
      overflow.forEach((item: AiHistoryItem) => store.delete(item.id));
    };
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function deleteStoredAiImage(id: string) {
  const db = await openAiHistoryDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(AI_HISTORY_STORE, "readwrite");
    transaction.objectStore(AI_HISTORY_STORE).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

