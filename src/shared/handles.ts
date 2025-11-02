const DB_NAME = "webclip-handles";
const STORE_NAME = "handles";
const ROOT_KEY = "root-directory";

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
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

async function putHandle(key: string, value: FileSystemHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHandle<T extends FileSystemHandle>(
  key: string,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      resolve(request.result as T | undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteHandle(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveRootDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await putHandle(ROOT_KEY, handle);
}

export async function loadRootDirectoryHandle(
  options: { requestAccess?: boolean } = {},
): Promise<FileSystemDirectoryHandle | undefined> {
  const { requestAccess = false } = options;
  const handle = await getHandle<FileSystemDirectoryHandle>(ROOT_KEY);
  if (!handle) {
    return undefined;
  }
  if (!handle.queryPermission || !handle.requestPermission) {
    return handle;
  }
  const permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission === "denied") {
    await deleteHandle(ROOT_KEY);
    return undefined;
  }
  if (permission === "prompt") {
    if (!requestAccess) {
      return undefined;
    }
    const result = await handle.requestPermission({ mode: "readwrite" });
    if (result !== "granted") {
      return undefined;
    }
  }
  return handle;
}

export async function clearRootDirectoryHandle(): Promise<void> {
  await deleteHandle(ROOT_KEY);
}
