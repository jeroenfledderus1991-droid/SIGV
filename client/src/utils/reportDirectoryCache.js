const AUTH_STORAGE_KEY = "authUser";
const DIRECTORY_NAME_PREFIX = "wordbeeReport:lastDirectoryName:v1";
const DB_NAME = "sigv-wordbee-cache-v1";
const STORE_NAME = "report-directory-handles";

function safeParseJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getCurrentUserCacheSegment() {
  if (typeof window === "undefined") return "anonymous";
  const bootstrapUser = window.__BOOTSTRAP__?.user;
  const bootstrapId = bootstrapUser?.id ?? bootstrapUser?.user_id;
  if (bootstrapId !== undefined && bootstrapId !== null) return String(bootstrapId);

  const authUser = safeParseJson(window.localStorage.getItem(AUTH_STORAGE_KEY));
  const authId = authUser?.id ?? authUser?.user_id;
  if (authId !== undefined && authId !== null) return String(authId);
  if (authUser?.username) return String(authUser.username);
  if (authUser?.email) return String(authUser.email).toLowerCase();
  return "anonymous";
}

function getDirectoryNameStorageKey(userSegment) {
  return `${DIRECTORY_NAME_PREFIX}:${userSegment}`;
}

export function getCachedDirectoryName(userSegment) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(getDirectoryNameStorageKey(userSegment)) || "";
}

export function setCachedDirectoryName(userSegment, directoryName) {
  if (typeof window === "undefined") return;
  if (!directoryName) {
    window.localStorage.removeItem(getDirectoryNameStorageKey(userSegment));
    return;
  }
  window.localStorage.setItem(getDirectoryNameStorageKey(userSegment), String(directoryName));
}

function openDirectoryCacheDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDirectoryCacheDb().catch(() => null);
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let callbackResult = null;
    try {
      callbackResult = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }).finally(() => {
    db.close();
  });
}

export async function getCachedDirectoryHandle(userSegment) {
  if (typeof window === "undefined") return null;
  try {
    return await withStore("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(userSegment);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    return null;
  }
}

export async function setCachedDirectoryHandle(userSegment, handle) {
  if (typeof window === "undefined") return;
  try {
    await withStore("readwrite", (store) => {
      store.put(handle, userSegment);
    });
  } catch {
    return;
  }
}
