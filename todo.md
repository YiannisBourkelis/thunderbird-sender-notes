# TODO: Storage Optimization Options

## Current Implementation

The addon currently uses `messenger.storage.local` with a single `notes` key containing all notes as an object:

```javascript
{ notes: { noteId1: {...}, noteId2: {...}, ... } }
```

Every operation (`saveNote`, `findMatchingNote`, `deleteNote`, etc.) loads the **entire** notes object into memory.

## Potential Issue

For **typical usage** (10-500 notes), this is fine. But with **thousands of notes**, you'd see:
- Memory spikes on every operation
- Slower save times
- Potential UI lag

## Storage Options for Future Scalability

### Option 1: In-Memory Cache (Simple Optimization)

Keep notes cached in memory, only reload when storage changes.

**Pros:**
- Minimal code changes
- Reduces storage reads significantly
- Good for read-heavy operations (checking notes when viewing emails)

**Cons:**
- Still loads all notes at startup
- Memory usage grows with note count

**Implementation:**
```javascript
let notesCache = null;

async function getNotesFromCache() {
  if (notesCache === null) {
    const data = await messenger.storage.local.get("notes");
    notesCache = data.notes || {};
  }
  return notesCache;
}

// Invalidate cache on storage changes
messenger.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.notes) {
    notesCache = changes.notes.newValue || {};
  }
});
```

---

### Option 2: Sharding by Pattern Prefix

Store notes in multiple keys based on pattern characteristics.

**Pros:**
- Stays with storage API (no new dependencies)
- Loads only relevant subset of notes

**Cons:**
- More complex lookup logic
- Pattern matching across shards for wildcard matches

**Implementation:**
```javascript
// Instead of: { notes: { id1: {...}, id2: {...} } }
// Use: 
// { notes_exact: { id1: {...} } }
// { notes_endsWith_@gmail.com: { id2: {...} } }
// { notes_contains: { id3: {...} } }
```

---

### Option 3: IndexedDB (Best for Large Datasets)

Use IndexedDB for proper database capabilities.

**Pros:**
- Supports queries and indexes
- Partial reads (no need to load everything)
- Transactions for data integrity
- Scales to 10,000+ records easily

**Cons:**
- More complex implementation
- Need to handle IndexedDB API
- Migration needed for existing users

**Implementation sketch:**
```javascript
const dbName = 'SenderNotesDB';
const storeName = 'notes';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('pattern', 'pattern', { unique: false });
      store.createIndex('matchType', 'matchType', { unique: false });
    };
  });
}

async function findNotesByPattern(pattern) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('pattern');
    const request = index.getAll(pattern);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

---

### Option 4: Hybrid Approach

Keep current storage for small sets, migrate to IndexedDB if notes exceed a threshold (e.g., 500 notes).

---

## Recommendation

For now, **Option 1 (In-Memory Cache)** is the best quick win:
- Minimal changes
- Significant performance improvement for typical usage
- Can be implemented in ~20 lines of code

If users report issues with 1000+ notes, consider **Option 3 (IndexedDB)** for a proper long-term solution.

## Priority

- [ ] Low priority - most users won't have thousands of notes
- [ ] Consider implementing Option 1 as a quick optimization
- [ ] Monitor user feedback for performance issues
