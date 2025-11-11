import type { Character } from '../types';

const DB_NAME = 'ai_chat_db';
const DB_VERSION = 2; // Incremented version to trigger onupgradeneeded
const AVATAR_STORE_NAME = 'avatars';
const CHAR_DATA_STORE_NAME = 'character_data';

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
                    db.createObjectStore(AVATAR_STORE_NAME);
                }
                if (!db.objectStoreNames.contains(CHAR_DATA_STORE_NAME)) {
                    db.createObjectStore(CHAR_DATA_STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };
        });
    }
    return dbPromise;
};

// --- Avatar Store Functions ---

export const saveAvatar = async (key: string, avatarData: string): Promise<void> => {
    try {
        const db = await getDb();
        const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
        const store = tx.objectStore(AVATAR_STORE_NAME);
        store.put(avatarData, key);
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error(`Failed to save avatar '${key}' to IndexedDB`, error);
        throw error;
    }
};

export const getAvatar = async (key: string): Promise<string | null> => {
    try {
        const db = await getDb();
        const tx = db.transaction(AVATAR_STORE_NAME, 'readonly');
        const store = tx.objectStore(AVATAR_STORE_NAME);
        const request = store.get(key);
        
        return await new Promise<string | null>((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result || null);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Failed to get avatar '${key}' from IndexedDB`, error);
        return null;
    }
};

export const deleteAvatar = async (key: string): Promise<void> => {
    try {
        const db = await getDb();
        const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
        const store = tx.objectStore(AVATAR_STORE_NAME);
        store.delete(key);
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error(`Failed to delete avatar '${key}' from IndexedDB`, error);
    }
};

// --- Character Data Store Functions ---

export const saveCharacter = async (character: Character): Promise<void> => {
    try {
        const db = await getDb();
        const tx = db.transaction(CHAR_DATA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CHAR_DATA_STORE_NAME);
        store.put(character); // The key is extracted via keyPath 'id'
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error(`Failed to save character '${character.id}' to IndexedDB`, error);
        throw error;
    }
};

export const getCharacter = async (id: string): Promise<Character | null> => {
    try {
        const db = await getDb();
        const tx = db.transaction(CHAR_DATA_STORE_NAME, 'readonly');
        const store = tx.objectStore(CHAR_DATA_STORE_NAME);
        const request = store.get(id);

        return await new Promise<Character | null>((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result || null);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error(`Failed to get character '${id}' from IndexedDB`, error);
        return null;
    }
};

export const deleteCharacter = async (id: string): Promise<void> => {
    try {
        const db = await getDb();
        const tx = db.transaction(CHAR_DATA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(CHAR_DATA_STORE_NAME);
        store.delete(id);
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error(`Failed to delete character '${id}' from IndexedDB`, error);
    }
};
