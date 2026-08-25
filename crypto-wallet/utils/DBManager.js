// utils/DBManager.js
// Single source of truth for the SQLite connection. Prevents multiple
// competing connections (sync + async on the same file) which cause
// NativeDatabase.prepareAsync → NullPointerException on Android.
import * as SQLite from 'expo-sqlite';
import { APP_CONFIG } from '../constants/Config';

let _db = null;
let _openPromise = null;

const isNullPtrError = (err) =>
  err?.message?.includes('NullPointerException') ||
  err?.message?.includes('NativeDatabase.prepareAsync');

/**
 * Returns the open database, opening it once if needed.
 * Concurrent callers during the first open all wait on the same Promise.
 */
export const getDB = async () => {
  if (_db) return _db;
  if (_openPromise) return _openPromise;

  _openPromise = SQLite.openDatabaseAsync(APP_CONFIG.DB_NAME)
    .then((conn) => {
      _db = conn;
      _openPromise = null;
      return _db;
    })
    .catch((err) => {
      _openPromise = null;
      throw err;
    });

  return _openPromise;
};

/**
 * Clears the cached connection so the next getDB() opens a fresh one.
 * Called automatically by withDB() on NullPointerException.
 */
export const invalidateDB = () => {
  _db = null;
  _openPromise = null;
};

/**
 * Runs fn(db) with automatic reconnect on Android NullPointerException.
 * Use this for any standalone DB operation that needs resilience.
 */
export const withDB = async (fn) => {
  try {
    return await fn(await getDB());
  } catch (err) {
    if (isNullPtrError(err)) {
      console.warn('[DBManager] Stale native handle — reconnecting...');
      invalidateDB();
      return await fn(await getDB());
    }
    throw err;
  }
};
