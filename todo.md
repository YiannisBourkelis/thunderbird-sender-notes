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

---

## Recommended Architecture: Repository Pattern with Storage Adapters

To support both **local IndexedDB** (free version) and **remote REST API** (Pro version), use an abstraction layer that allows easy backend switching.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Business Logic                        │
│           (background.js, popups, etc.)                  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  NotesRepository                         │
│         (Single API for all note operations)             │
│                                                          │
│   - getAll()                                             │
│   - getById(id)                                          │
│   - findByEmail(email)                                   │
│   - save(note)                                           │
│   - delete(id)                                           │
│   - findDuplicate(pattern, matchType)                    │
└─────────────────────────┬───────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│  IndexedDBAdapter     │   │   RestApiAdapter      │
│  (Free version)       │   │   (Pro version)       │
│                       │   │                       │
│  - Local storage      │   │  - Cloud sync         │
│  - Offline-first      │   │  - Authentication     │
│  - No account needed  │   │  - Cross-device sync  │
└───────────────────────┘   └───────────────────────┘
```

### Storage Adapter Interface

All adapters must implement this interface:

```javascript
// storage/StorageAdapter.js

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} pattern
 * @property {string} matchType - 'exact' | 'startsWith' | 'endsWith' | 'contains'
 * @property {string} note
 * @property {string} originalEmail
 * @property {string} createdAt - ISO date string
 * @property {string} updatedAt - ISO date string
 */

/**
 * Storage Adapter Interface
 * All storage backends must implement these methods
 */
class StorageAdapter {
  /** @returns {Promise<Object<string, Note>>} */
  async getAllNotes() { throw new Error('Not implemented'); }
  
  /** @returns {Promise<Note|null>} */
  async getNoteById(id) { throw new Error('Not implemented'); }
  
  /** @returns {Promise<Note>} */
  async saveNote(note) { throw new Error('Not implemented'); }
  
  /** @returns {Promise<void>} */
  async deleteNote(id) { throw new Error('Not implemented'); }
  
  /** @returns {Promise<Note[]>} All notes matching the email */
  async findNotesByEmail(email) { throw new Error('Not implemented'); }
  
  /** @returns {Promise<Note|null>} */
  async findDuplicate(pattern, matchType, excludeId) { throw new Error('Not implemented'); }
  
  // Templates
  /** @returns {Promise<string[]>} */
  async getTemplates() { throw new Error('Not implemented'); }
  
  /** @returns {Promise<void>} */
  async saveTemplates(templates) { throw new Error('Not implemented'); }
  
  // Settings
  /** @returns {Promise<Object>} */
  async getSettings() { throw new Error('Not implemented'); }
  
  /** @returns {Promise<void>} */
  async saveSettings(settings) { throw new Error('Not implemented'); }
}
```

---

### IndexedDB Adapter (Free Version)

```javascript
// storage/IndexedDBAdapter.js

class IndexedDBAdapter extends StorageAdapter {
  constructor() {
    super();
    this.dbName = 'SenderNotesDB';
    this.dbVersion = 1;
    this.db = null;
  }
  
  async openDB() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('pattern', 'pattern', { unique: false });
          notesStore.createIndex('matchType', 'matchType', { unique: false });
          notesStore.createIndex('pattern_matchType', ['pattern', 'matchType'], { unique: true });
        }
        
        // Templates store
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
    });
  }
  
  async getAllNotes() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Convert array to object keyed by id
        const notes = {};
        for (const note of request.result) {
          notes[note.id] = note;
        }
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  async getNoteById(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveNote(note) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.put(note);
      
      request.onsuccess = () => resolve(note);
      request.onerror = () => reject(request.error);
    });
  }
  
  async deleteNote(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async findNotesByEmail(email) {
    const notes = await this.getAllNotes();
    const emailLower = email.toLowerCase();
    const matching = [];
    
    // Check each note for pattern match
    const priorities = ['exact', 'startsWith', 'endsWith', 'contains'];
    
    for (const matchType of priorities) {
      for (const note of Object.values(notes)) {
        if (note.matchType === matchType && this._validatePattern(emailLower, note.pattern, matchType)) {
          matching.push(note);
        }
      }
    }
    
    return matching;
  }
  
  async findDuplicate(pattern, matchType, excludeId = null) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const index = store.index('pattern_matchType');
      const request = index.get([pattern.toLowerCase(), matchType]);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.id !== excludeId) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  _validatePattern(email, pattern, matchType) {
    const patternLower = pattern.toLowerCase();
    switch (matchType) {
      case 'exact': return email === patternLower;
      case 'startsWith': return email.startsWith(patternLower);
      case 'endsWith': return email.endsWith(patternLower);
      case 'contains': return email.includes(patternLower);
      default: return false;
    }
  }
  
  // Templates
  async getTemplates() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('templates', 'readonly');
      const store = tx.objectStore('templates');
      const request = store.get('default');
      
      request.onsuccess = () => {
        resolve(request.result?.templates || []);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveTemplates(templates) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('templates', 'readwrite');
      const store = tx.objectStore('templates');
      const request = store.put({ id: 'default', templates });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  // Settings
  async getSettings() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get('default');
      
      request.onsuccess = () => {
        resolve(request.result?.settings || {});
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  async saveSettings(settings) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ id: 'default', settings });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

### REST API Adapter (Pro Version - Future)

```javascript
// storage/RestApiAdapter.js

class RestApiAdapter extends StorageAdapter {
  constructor(baseUrl, authToken) {
    super();
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }
  
  async _fetch(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
  
  async getAllNotes() {
    const notes = await this._fetch('/notes');
    // Convert array to object keyed by id
    const result = {};
    for (const note of notes) {
      result[note.id] = note;
    }
    return result;
  }
  
  async getNoteById(id) {
    try {
      return await this._fetch(`/notes/${id}`);
    } catch (e) {
      return null;
    }
  }
  
  async saveNote(note) {
    if (note.id) {
      return await this._fetch(`/notes/${note.id}`, {
        method: 'PUT',
        body: JSON.stringify(note)
      });
    } else {
      return await this._fetch('/notes', {
        method: 'POST',
        body: JSON.stringify(note)
      });
    }
  }
  
  async deleteNote(id) {
    await this._fetch(`/notes/${id}`, { method: 'DELETE' });
  }
  
  async findNotesByEmail(email) {
    return await this._fetch(`/notes/search?email=${encodeURIComponent(email)}`);
  }
  
  async findDuplicate(pattern, matchType, excludeId = null) {
    const params = new URLSearchParams({ pattern, matchType });
    if (excludeId) params.append('excludeId', excludeId);
    
    try {
      return await this._fetch(`/notes/duplicate?${params}`);
    } catch (e) {
      return null;
    }
  }
  
  // Templates
  async getTemplates() {
    return await this._fetch('/templates');
  }
  
  async saveTemplates(templates) {
    await this._fetch('/templates', {
      method: 'PUT',
      body: JSON.stringify(templates)
    });
  }
  
  // Settings
  async getSettings() {
    return await this._fetch('/settings');
  }
  
  async saveSettings(settings) {
    await this._fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }
}
```

---

### Repository (Single Entry Point)

```javascript
// storage/NotesRepository.js

class NotesRepository {
  constructor(adapter) {
    this.adapter = adapter;
  }
  
  // Switch storage backend at runtime
  setAdapter(adapter) {
    this.adapter = adapter;
  }
  
  // Notes
  getAllNotes() { return this.adapter.getAllNotes(); }
  getNoteById(id) { return this.adapter.getNoteById(id); }
  saveNote(note) { return this.adapter.saveNote(note); }
  deleteNote(id) { return this.adapter.deleteNote(id); }
  findNotesByEmail(email) { return this.adapter.findNotesByEmail(email); }
  findDuplicate(pattern, matchType, excludeId) { 
    return this.adapter.findDuplicate(pattern, matchType, excludeId); 
  }
  
  // Templates
  getTemplates() { return this.adapter.getTemplates(); }
  saveTemplates(templates) { return this.adapter.saveTemplates(templates); }
  
  // Settings
  getSettings() { return this.adapter.getSettings(); }
  saveSettings(settings) { return this.adapter.saveSettings(settings); }
}

// Global instance - start with IndexedDB
const storage = new NotesRepository(new IndexedDBAdapter());

// To switch to Pro (REST API):
// storage.setAdapter(new RestApiAdapter('https://api.sendernotes.com', userToken));
```

---

### Usage in background.js

```javascript
// Before (current):
const data = await messenger.storage.local.get("notes");
const notes = data.notes || {};

// After (with repository):
const notes = await storage.getAllNotes();

// Before:
await messenger.storage.local.set({ notes });

// After:
await storage.saveNote(noteData);
```

---

### Migration Strategy

1. **Phase 1**: Implement IndexedDBAdapter + Repository pattern
2. **Phase 2**: Migrate existing data from `messenger.storage.local` to IndexedDB
3. **Phase 3**: Update all background.js functions to use Repository
4. **Phase 4 (Pro)**: Implement RestApiAdapter with authentication
5. **Phase 5 (Pro)**: Add offline-first sync (save to IndexedDB, sync to cloud)

---

### Pro Version Considerations

For the Pro version with cloud sync:

1. **Authentication**: Store auth token in secure storage
2. **Offline-first**: Always write to IndexedDB first, then sync to cloud
3. **Conflict resolution**: Use `updatedAt` timestamps for last-write-wins
4. **Sync status**: Track sync state per note (synced, pending, conflict)
5. **Rate limiting**: Queue API calls to avoid hitting rate limits

```javascript
// Hybrid adapter for offline-first Pro version
class OfflineFirstAdapter extends StorageAdapter {
  constructor(localAdapter, remoteAdapter) {
    super();
    this.local = localAdapter;
    this.remote = remoteAdapter;
  }
  
  async saveNote(note) {
    // Always save locally first
    await this.local.saveNote({ ...note, syncStatus: 'pending' });
    
    // Try to sync to cloud
    try {
      await this.remote.saveNote(note);
      await this.local.saveNote({ ...note, syncStatus: 'synced' });
    } catch (e) {
      console.log('Will sync later:', e.message);
    }
    
    return note;
  }
}
```

---

## Priority

- [ ] **High**: Implement IndexedDBAdapter and Repository pattern
- [ ] **High**: Migrate existing data from storage.local to IndexedDB  
- [ ] **Medium**: Update background.js to use Repository
- [ ] **Low**: Implement RestApiAdapter (for Pro version)
- [ ] **Low**: Add offline-first sync capabilities
