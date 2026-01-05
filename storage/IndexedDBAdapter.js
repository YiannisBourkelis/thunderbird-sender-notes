/**
 * IndexedDB Storage Adapter
 * Implements StorageAdapter interface using IndexedDB for local storage
 */

class IndexedDBAdapter {
  constructor() {
    this.dbName = 'SenderNotesDB';
    this.dbVersion = DB_SCHEMA.version; // Use schema version
    this.db = null;
  }
  
  /**
   * Open the database connection
   * @returns {Promise<IDBDatabase>}
   */
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
        const tx = event.target.transaction;
        
        // Apply schema changes from the declarative schema definition
        applySchemaUpgrade(db, tx, event.oldVersion, event.newVersion);
      };
    });
  }
  
  /**
   * Close the database connection
   */
  closeDB() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  // ==================== Notes ====================
  
  /**
   * Get all notes
   * @returns {Promise<Object<string, Note>>}
   */
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
  
  /**
   * Get a single note by ID
   * @param {string} id 
   * @returns {Promise<Note|null>}
   */
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
  
  /**
   * Save a note (create or update)
   * @param {Note} note 
   * @returns {Promise<Note>}
   */
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
  
  /**
   * Delete a note by ID
   * @param {string} id 
   * @returns {Promise<void>}
   */
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
  
  /**
   * Find all notes that match an email address
   * @param {string} email 
   * @returns {Promise<Note[]>}
   */
  async findNotesByEmail(email) {
    const notes = await this.getAllNotes();
    const emailLower = email.toLowerCase();
    const matching = [];
    
    // Check each note for pattern match, ordered by priority
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
  
  /**
   * Find a single matching note (first match by priority)
   * @param {string} email 
   * @returns {Promise<Note|null>}
   */
  async findNoteByEmail(email) {
    const matching = await this.findNotesByEmail(email);
    return matching.length > 0 ? matching[0] : null;
  }
  
  /**
   * Check if a duplicate pattern+matchType exists
   * @param {string} pattern 
   * @param {string} matchType 
   * @param {string|null} excludeId 
   * @returns {Promise<Note|null>}
   */
  async findDuplicate(pattern, matchType, excludeId = null) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const index = store.index('pattern_matchType');
      const request = index.getAll([pattern.toLowerCase(), matchType]);
      
      request.onsuccess = () => {
        const results = request.result;
        for (const note of results) {
          if (note.id !== excludeId) {
            resolve(note);
            return;
          }
        }
        resolve(null);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Validate if a pattern matches an email
   * @private
   */
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
  
  // ==================== Templates ====================
  
  /**
   * Get all templates
   * @returns {Promise<string[]>}
   */
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
  
  /**
   * Save templates
   * @param {string[]} templates 
   * @returns {Promise<void>}
   */
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
  
  // ==================== Settings ====================
  
  /**
   * Get settings object
   * @returns {Promise<Object>}
   */
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
  
  /**
   * Save settings object
   * @param {Object} settings 
   * @returns {Promise<void>}
   */
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
  
  // ==================== Migration ====================
  
  /**
   * Import notes from an object (used for migration)
   * @param {Object<string, Note>} notesObject 
   * @returns {Promise<number>} Number of notes imported
   */
  async importNotes(notesObject) {
    const db = await this.openDB();
    let count = 0;
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
      
      for (const [id, note] of Object.entries(notesObject)) {
        store.put({ ...note, id });
        count++;
      }
    });
  }
  
  /**
   * Clear all data (use with caution!)
   * @returns {Promise<void>}
   */
  async clearAll() {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['notes', 'templates', 'settings'], 'readwrite');
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      tx.objectStore('notes').clear();
      tx.objectStore('templates').clear();
      tx.objectStore('settings').clear();
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IndexedDBAdapter;
}
