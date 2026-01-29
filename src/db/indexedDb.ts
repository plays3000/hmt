import { log } from "../log/logUtil.js";
import { ulid } from "ulid";
import { loggingToGcp } from "../log/gcpLog.js";
import { HmtTracker, HmtFeature, HmtCropImg } from "../types.js";

const hmtTrackerStoreName = "hmtTracker";
const hmtFeatureStoreName = "hmtFeature";
const cropImgStoreName = "hmtCropImg";

export let db: IDBDatabase;

export async function initIndexedDB() {
  try {
    const DBRequest = window.indexedDB.open("HMT", 1);
    await initDB(DBRequest);
    return true;
  } catch (error) {
    console.error(error);
    loggingToGcp("ERROR", `Error during init db: ${error}`);
    return false;
  }
}

export function initDB(DBRequest: IDBOpenDBRequest) {
  return new Promise<void>((resolve, reject) => {
    DBRequest.addEventListener("success", (event) => {
      log("indexedDB success");
      const request = event.target as IDBOpenDBRequest;
      db = request.result;
      if (!db.objectStoreNames.contains("gcpLog")) {
        createObjectStore("gcpLog", db);
      }
      if (!db.objectStoreNames.contains(hmtTrackerStoreName)) {
        createObjectStore(hmtTrackerStoreName, db);
      }
      if (!db.objectStoreNames.contains(hmtFeatureStoreName)) {
        createObjectStore(hmtFeatureStoreName, db);
      }
      if (!db.objectStoreNames.contains(cropImgStoreName)) {
        createObjectStore(cropImgStoreName, db);
      }
      resolve();
    });

    DBRequest.addEventListener("upgradeneeded", (event) => {
      log("indexedDB upgradeneeded");
      const request = event.target as IDBOpenDBRequest;
      db = request.result;
      let oldVersion = event.oldVersion;
      if (oldVersion < 1) {
        createObjectStore("gcpLog", db);
        createObjectStore(hmtTrackerStoreName, db);
        createObjectStore(hmtFeatureStoreName, db);
        createObjectStore(cropImgStoreName, db);
      }
    });

    DBRequest.addEventListener("error", (event) => {
      const request = event.target as IDBOpenDBRequest;
      log(`indexedDB error: ${request.error?.message}`);
      reject(request.error);
    });
  });
}

function createObjectStore(name: string, db: IDBDatabase) {
  if (!db.objectStoreNames.contains(name)) {
    db.createObjectStore(name, {
      keyPath: "id",
      autoIncrement: false,
    });
    log(`Object store ${name} created`);
  } else {
    log(`Object store ${name} already exists`);
  }
}

export async function readIndex(objectStoreName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(objectStoreName, "readonly");
    const objectStore = transaction.objectStore(objectStoreName);
    const data: any[] = [];

    const cursorRequest = objectStore.openCursor();

    cursorRequest.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        data.push(cursor.value);
        cursor.continue();
      } else {
        resolve(data);
      }
    };

    cursorRequest.onerror = (event) => {
      const request = event.target as IDBRequest;
      console.error("Cursor error:", request.error);
      reject(request.error);
    };
  });
}

export async function deleteIndex(objectStoreName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(objectStoreName, "readwrite");
    const objectStore = transaction.objectStore(objectStoreName);
    const deletedData: any[] = [];

    const cursorRequest = objectStore.openCursor();

    cursorRequest.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        deletedData.push(cursor.value);
        const deleteRequest = cursor.delete();

        deleteRequest.onsuccess = () => cursor.continue();
        deleteRequest.onerror = (event: any) => {
          const request = event.target as IDBRequest;
          console.error("Delete error:", request.error);
          reject(request.error);
        };
      } else {
        resolve(deletedData);
      }
    };

    cursorRequest.onerror = (event: any) => {
      const request = event.target as IDBRequest;
      console.error("Cursor error:", request.error);
      reject(request.error);
    };
  });
}

export function deleteIndexByPeriod(
  objectStoreName: string,
  retentionPeriodTime: number
) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(objectStoreName, "readwrite");
    const objectStore = transaction.objectStore(objectStoreName);
    const deletedKeys: any[] = [];

    const cursorRequest = objectStore.openCursor();

    cursorRequest.onerror = (event) => {
      const request = event.target as IDBRequest;
      console.error("Cursor error:", request.error);
      reject(request.error);
    };

    cursorRequest.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const record = cursor.value;
        const recordTimestamp = record.createdAt.getTime();
        if (recordTimestamp <= retentionPeriodTime) {
          const deleteRequest = cursor.delete();

          deleteRequest.onerror = (event: any) => {
            const request = event.target as IDBRequest;
            console.error("Delete error:", request.error);
            reject(request.error);
          };

          deleteRequest.onsuccess = () => {
            deletedKeys.push(cursor.key);
            cursor.continue();
          };
        } else {
          cursor.continue();
        }
      } else {
        resolve(deletedKeys);
      }
    };
  });
}

export function putIndex(
  record: any,
  id: IDBValidKey,
  objectStoreName: string
) {
  try {
    const transaction = db.transaction(objectStoreName, "readwrite");
    const objectStore = transaction.objectStore(objectStoreName);
    objectStore.put({ ...record, id });
  } catch (e) {
    log(`Error during addIndex ${objectStoreName}, ${e}`);
  }
}

export function addGcpLogIndex(
  severity: string,
  storeId: string,
  message: string
) {
  const record = { severity, storeId, message };
  const id = ulid();
  putIndex(record, id, "gcpLog");
}

export function saveHmtTracker(track: HmtTracker) {
  const id = ulid();
  putIndex(track, id, hmtTrackerStoreName);
}

export function saveHmtTrackers(hmtTrackers: HmtTracker[]) {
  for (const tracker of hmtTrackers) {
    const id = tracker.id ? tracker.id : ulid();
    putIndex(tracker, id, hmtTrackerStoreName);
  }
}

export async function saveHmtFeature(hmtFeature: HmtFeature) {
  putIndex(hmtFeature, hmtFeature.id!, hmtFeatureStoreName);
}

export async function saveHmtCropImg(cropImg: HmtCropImg) {
  putIndex(cropImg, cropImg.id!, cropImgStoreName);
}

export function clearObjectStore(name: string) {
  db.transaction(name, "readwrite").objectStore(name).clear();
}
