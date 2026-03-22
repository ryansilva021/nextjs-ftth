'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'ftth_offline'
const STORE_NAME = 'queue'
const DB_VERSION = 1

/** Open (or upgrade) the IndexedDB database. Returns a Promise<IDBDatabase>. */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

/** Run a single transaction against the queue store. */
function withStore(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = fn(store)

    if (result && typeof result.onsuccess !== 'undefined') {
      result.onsuccess = (e) => resolve(e.target.result)
      result.onerror = (e) => reject(e.target.error)
    } else {
      tx.oncomplete = () => resolve(result)
      tx.onerror = (e) => reject(e.target.error)
    }
  })
}

async function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

async function idbPut(db, item) {
  return withStore(db, 'readwrite', (store) => store.put(item))
}

async function idbDelete(db, id) {
  return withStore(db, 'readwrite', (store) => store.delete(id))
}

// ---------------------------------------------------------------------------
// LocalStorage fallback (when IndexedDB is unavailable)
// ---------------------------------------------------------------------------

const LS_KEY = 'ftth_offline_queue'

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

function lsWrite(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items))
  } catch (_) {
    // quota exceeded – ignore
  }
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages an offline operation queue backed by IndexedDB (with a localStorage
 * fallback). Each item tracks its sync status: 'pendente' | 'enviado' | 'erro'.
 *
 * @param {((item: object) => Promise<void>) | null} [syncHandler]
 *   Async function that processes a single queue item during flush.
 *
 * @returns {{
 *   isOnline:   boolean,
 *   queueSize:  number,
 *   pendentes:  object[],
 *   enqueue:    (payload: object, type?: string) => Promise<void>,
 *   flush:      () => Promise<void>,
 *   clearErros: () => Promise<void>,
 *   status:     'idle'|'syncing'|'error',
 * }}
 */
export function useAgentOffline(syncHandler = null) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendentes, setPendentes] = useState([])
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle'|'syncing'|'error'

  const dbRef = useRef(null)           // IDBDatabase | null
  const useIDB = useRef(true)          // false if IDB unavailable
  const syncingRef = useRef(false)
  const syncHandlerRef = useRef(syncHandler)

  useEffect(() => {
    syncHandlerRef.current = syncHandler
  }, [syncHandler])

  // ---- Initialise DB and load initial state ----
  useEffect(() => {
    let cancelled = false

    async function init() {
      if (typeof indexedDB === 'undefined') {
        useIDB.current = false
        const items = lsRead().filter((i) => i.status === 'pendente')
        if (!cancelled) setPendentes(items)
        return
      }

      try {
        const db = await openDB()
        if (cancelled) return
        dbRef.current = db
        const all = await idbGetAll(db)
        if (!cancelled) {
          setPendentes(all.filter((i) => i.status === 'pendente'))
        }
      } catch (_) {
        useIDB.current = false
        const items = lsRead().filter((i) => i.status === 'pendente')
        if (!cancelled) setPendentes(items)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // ---- Refresh pendentes from storage ----
  const refreshPendentes = useCallback(async () => {
    if (useIDB.current && dbRef.current) {
      const all = await idbGetAll(dbRef.current)
      setPendentes(all.filter((i) => i.status === 'pendente'))
    } else {
      setPendentes(lsRead().filter((i) => i.status === 'pendente'))
    }
  }, [])

  // ---- enqueue ----
  const enqueue = useCallback(async (payload, type = 'generic') => {
    const item = {
      id: generateId(),
      type,
      payload,
      status: 'pendente',
      _enqueuedAt: Date.now(),
    }

    if (useIDB.current && dbRef.current) {
      await idbPut(dbRef.current, item)
    } else {
      const all = lsRead()
      all.push(item)
      lsWrite(all)
    }

    setPendentes((prev) => [...prev, item])
  }, [])

  // ---- flush ----
  const flush = useCallback(async () => {
    if (syncingRef.current) return
    if (!syncHandlerRef.current) return

    let items

    if (useIDB.current && dbRef.current) {
      const all = await idbGetAll(dbRef.current)
      items = all.filter((i) => i.status === 'pendente')
    } else {
      items = lsRead().filter((i) => i.status === 'pendente')
    }

    if (items.length === 0) return

    syncingRef.current = true
    setSyncStatus('syncing')

    let anyError = false

    for (const item of items) {
      try {
        await syncHandlerRef.current(item)
        const updated = { ...item, status: 'enviado' }

        if (useIDB.current && dbRef.current) {
          await idbPut(dbRef.current, updated)
        } else {
          const all = lsRead().map((i) => (i.id === item.id ? updated : i))
          lsWrite(all)
        }
      } catch (err) {
        anyError = true
        const updated = {
          ...item,
          status: 'erro',
          _lastError: err?.message ?? String(err),
        }

        if (useIDB.current && dbRef.current) {
          await idbPut(dbRef.current, updated)
        } else {
          const all = lsRead().map((i) => (i.id === item.id ? updated : i))
          lsWrite(all)
        }
      }
    }

    await refreshPendentes()
    setSyncStatus(anyError ? 'error' : 'idle')
    syncingRef.current = false
  }, [refreshPendentes])

  // ---- clearErros ----
  const clearErros = useCallback(async () => {
    if (useIDB.current && dbRef.current) {
      const all = await idbGetAll(dbRef.current)
      const erros = all.filter((i) => i.status === 'erro')
      await Promise.all(erros.map((i) => idbDelete(dbRef.current, i.id)))
    } else {
      const remaining = lsRead().filter((i) => i.status !== 'erro')
      lsWrite(remaining)
    }
    // pendentes list is unaffected; no re-render needed unless we expose erros
  }, [])

  // ---- Network event listeners ----
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      flush()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush])

  return {
    isOnline,
    queueSize: pendentes.length,
    pendentes,
    enqueue,
    flush,
    clearErros,
    status: syncStatus,
  }
}
