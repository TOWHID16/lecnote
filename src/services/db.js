import { openDB } from 'idb';

const DB_NAME = 'lecnote_ai_db';
const DB_VERSION = 1;
const STORE_LECTURES = 'lectures';
const STORE_SETTINGS = 'settings';

let dbPromise = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_LECTURES)) {
          const lectureStore = db.createObjectStore(STORE_LECTURES, { keyPath: 'id' });
          lectureStore.createIndex('createdAt', 'createdAt');
          lectureStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get all lectures sorted by createdAt descending
 */
export async function getAllLectures() {
  const db = await getDB();
  const tx = db.transaction(STORE_LECTURES, 'readonly');
  const store = tx.objectStore(STORE_LECTURES);
  const index = store.index('createdAt');
  const list = await index.getAll();
  return list.reverse();
}

/**
 * Get a single lecture by ID
 */
export async function getLectureById(id) {
  const db = await getDB();
  return await db.get(STORE_LECTURES, id);
}

/**
 * Save or update a lecture
 */
export async function saveLecture(lecture) {
  const db = await getDB();
  const now = new Date().toISOString();
  const toSave = {
    ...lecture,
    updatedAt: now,
    createdAt: lecture.createdAt || now,
  };
  await db.put(STORE_LECTURES, toSave);
  return toSave;
}

/**
 * Update only words (highlight, edit spelling, timestamps)
 */
export async function updateLectureWords(id, words) {
  const db = await getDB();
  const tx = db.transaction(STORE_LECTURES, 'readwrite');
  const store = tx.objectStore(STORE_LECTURES);
  const lecture = await store.get(id);
  if (lecture) {
    lecture.words = words;
    lecture.updatedAt = new Date().toISOString();
    await store.put(lecture);
  }
  await tx.done;
  return lecture;
}

/**
 * Update only summary
 */
export async function updateLectureSummary(id, summary) {
  const db = await getDB();
  const tx = db.transaction(STORE_LECTURES, 'readwrite');
  const store = tx.objectStore(STORE_LECTURES);
  const lecture = await store.get(id);
  if (lecture) {
    lecture.summary = summary;
    lecture.updatedAt = new Date().toISOString();
    await store.put(lecture);
  }
  await tx.done;
  return lecture;
}

/**
 * Delete lecture
 */
export async function deleteLecture(id) {
  const db = await getDB();
  return await db.delete(STORE_LECTURES, id);
}

/**
 * Settings helpers
 */
export async function getSetting(key, defaultValue = null) {
  const db = await getDB();
  const row = await db.get(STORE_SETTINGS, key);
  return row ? row.value : defaultValue;
}

export async function setSetting(key, value) {
  const db = await getDB();
  await db.put(STORE_SETTINGS, { key, value });
}
