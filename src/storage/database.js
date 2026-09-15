const DB_NAME = "local-ai-chrome";
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase> | null} */
let opening = null;
/** @type {IDBDatabase | null} */
let dbInstance = null;

function upgrade(db) {
  if (!db.objectStoreNames.contains("conversations")) {
    const store = db.createObjectStore("conversations", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("pinned", "pinned");
  }
  if (!db.objectStoreNames.contains("messages")) {
    const store = db.createObjectStore("messages", { keyPath: "id" });
    store.createIndex("conversationId", "conversationId");
    store.createIndex("createdAt", "createdAt");
  }
  if (!db.objectStoreNames.contains("attachments")) {
    const store = db.createObjectStore("attachments", { keyPath: "id" });
    store.createIndex("conversationId", "conversationId");
    store.createIndex("messageId", "messageId");
  }
  if (!db.objectStoreNames.contains("memories")) {
    const store = db.createObjectStore("memories", { keyPath: "id" });
    store.createIndex("status", "status");
    store.createIndex("updatedAt", "updatedAt");
  }
  if (!db.objectStoreNames.contains("notes")) {
    const store = db.createObjectStore("notes", { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("pinned", "pinned");
  }
  if (!db.objectStoreNames.contains("settings")) {
    db.createObjectStore("settings", { keyPath: "key" });
  }
}

export function openDatabase() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        opening = null;
      };
      resolve(dbInstance);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function withStore(storeName, mode, fn) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const txDone = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
  const result = await fn(store, tx);
  await txDone;
  return result;
}

export async function withStores(storeNames, mode, fn) {
  const db = await openDatabase();
  const tx = db.transaction(storeNames, mode);
  const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
  const txDone = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
  const result = await fn(stores, tx);
  await txDone;
  return result;
}

export function getAllFromIndex(store, indexName, query) {
  const index = store.index(indexName);
  return requestToPromise(query === undefined ? index.getAll() : index.getAll(query));
}

export async function clearDatabaseForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  opening = null;
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
