/**
 * Notes Repository
 * Single entry point for all storage operations
 * Abstracts the storage backend (IndexedDB, REST API, etc.)
 */

// Import the IndexedDB adapter
// In background.js context, these will be loaded via script tags

class NotesRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this._defaultTemplatesProvider = null;
  }
  
  /**
   * Switch storage backend at runtime
   * @param {StorageAdapter} adapter 
   */
  setAdapter(adapter) {
    this.adapter = adapter;
  }
  
  /**
   * Set the default templates provider function
   * @param {Function} provider - Function that returns default templates array
   */
  setDefaultTemplatesProvider(provider) {
    this._defaultTemplatesProvider = provider;
  }
  
  // ==================== Notes ====================
  
  /**
   * Get all notes
   * @returns {Promise<Object<string, Note>>}
   */
  async getAllNotes() {
    return this.adapter.getAllNotes();
  }
  
  /**
   * Get a single note by ID
   * @param {string} id 
   * @returns {Promise<Note|null>}
   */
  async getNoteById(id) {
    return this.adapter.getNoteById(id);
  }
  
  /**
   * Save a note (handles ID generation and timestamps)
   * @param {Object} noteData - Note data (may or may not have id)
   * @returns {Promise<{success: boolean, noteId?: string, error?: string, message?: string}>}
   */
  async saveNote(noteData) {
    const { id, pattern, matchType, note, originalEmail } = noteData;
    
    // Check for duplicates
    const duplicate = await this.adapter.findDuplicate(pattern, matchType, id);
    if (duplicate) {
      return {
        success: false,
        error: 'duplicate',
        message: 'A note with this exact pattern and match type already exists.',
        existingNoteId: duplicate.id
      };
    }
    
    // Get existing note to preserve createdAt and originalEmail
    let existingNote = null;
    if (id) {
      existingNote = await this.adapter.getNoteById(id);
    }
    
    const now = new Date().toISOString();
    const noteId = id || this._generateId();
    
    const noteToSave = {
      id: noteId,
      pattern: pattern.toLowerCase(),
      matchType: matchType,
      note: note,
      originalEmail: existingNote?.originalEmail || originalEmail || pattern,
      createdAt: existingNote?.createdAt || now,
      updatedAt: now
    };
    
    await this.adapter.saveNote(noteToSave);
    return { success: true, noteId };
  }
  
  /**
   * Delete a note by ID
   * @param {string} id 
   * @returns {Promise<{success: boolean}>}
   */
  async deleteNote(id) {
    await this.adapter.deleteNote(id);
    return { success: true };
  }
  
  /**
   * Delete a note by email (finds matching note first)
   * @param {string} email 
   * @returns {Promise<{success: boolean}>}
   */
  async deleteNoteByEmail(email) {
    const note = await this.findNoteByEmail(email);
    if (note) {
      await this.adapter.deleteNote(note.id);
    }
    return { success: true };
  }
  
  /**
   * Find all notes that match an email
   * @param {string} email 
   * @returns {Promise<Note[]>}
   */
  async findNotesByEmail(email) {
    return this.adapter.findNotesByEmail(email);
  }
  
  /**
   * Find a single matching note (first by priority)
   * @param {string} email 
   * @returns {Promise<Note|null>}
   */
  async findNoteByEmail(email) {
    const notes = await this.adapter.findNotesByEmail(email);
    return notes.length > 0 ? notes[0] : null;
  }
  
  /**
   * Check for duplicate pattern+matchType
   * @param {string} pattern 
   * @param {string} matchType 
   * @param {string|null} excludeId 
   * @returns {Promise<{exists: boolean, noteId?: string, note?: Note}>}
   */
  async checkDuplicate(pattern, matchType, excludeId = null) {
    const duplicate = await this.adapter.findDuplicate(pattern, matchType, excludeId);
    if (duplicate) {
      return { exists: true, noteId: duplicate.id, note: duplicate };
    }
    return { exists: false };
  }
  
  /**
   * Validate if a pattern matches an email
   * @param {string} email 
   * @param {string} pattern 
   * @param {string} matchType 
   * @returns {boolean}
   */
  validatePattern(email, pattern, matchType) {
    const emailLower = email.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    switch (matchType) {
      case 'exact': return emailLower === patternLower;
      case 'startsWith': return emailLower.startsWith(patternLower);
      case 'endsWith': return emailLower.endsWith(patternLower);
      case 'contains': return emailLower.includes(patternLower);
      default: return false;
    }
  }
  
  // ==================== Templates ====================
  
  /**
   * Get templates (returns defaults if none saved)
   * @returns {Promise<string[]>}
   */
  async getTemplates() {
    const templates = await this.adapter.getTemplates();
    if (templates.length === 0 && this._defaultTemplatesProvider) {
      return this._defaultTemplatesProvider();
    }
    return templates;
  }
  
  /**
   * Save all templates
   * @param {string[]} templates 
   * @returns {Promise<{success: boolean}>}
   */
  async saveTemplates(templates) {
    await this.adapter.saveTemplates(templates);
    return { success: true };
  }
  
  /**
   * Add a new template
   * @param {string} template 
   * @returns {Promise<{success: boolean, templates: string[]}>}
   */
  async addTemplate(template) {
    const templates = await this.getTemplates();
    if (!templates.includes(template)) {
      templates.push(template);
      await this.adapter.saveTemplates(templates);
    }
    return { success: true, templates };
  }
  
  /**
   * Update a template by index
   * @param {number} index 
   * @param {string} newText 
   * @returns {Promise<{success: boolean, templates: string[]}>}
   */
  async updateTemplate(index, newText) {
    const templates = await this.getTemplates();
    if (index >= 0 && index < templates.length) {
      templates[index] = newText;
      await this.adapter.saveTemplates(templates);
    }
    return { success: true, templates };
  }
  
  /**
   * Delete a template by index
   * @param {number} index 
   * @returns {Promise<{success: boolean, templates: string[]}>}
   */
  async deleteTemplate(index) {
    const templates = await this.getTemplates();
    if (index >= 0 && index < templates.length) {
      templates.splice(index, 1);
      await this.adapter.saveTemplates(templates);
    }
    return { success: true, templates };
  }
  
  // ==================== Settings ====================
  
  /**
   * Get settings
   * @returns {Promise<Object>}
   */
  async getSettings() {
    return this.adapter.getSettings();
  }
  
  /**
   * Save settings
   * @param {Object} settings 
   * @returns {Promise<{success: boolean}>}
   */
  async saveSettings(settings) {
    await this.adapter.saveSettings(settings);
    return { success: true };
  }
  
  /**
   * Get a single setting value
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {Promise<*>}
   */
  async getSetting(key, defaultValue = null) {
    const settings = await this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }
  
  /**
   * Set a single setting value
   * @param {string} key 
   * @param {*} value 
   * @returns {Promise<{success: boolean}>}
   */
  async setSetting(key, value) {
    const settings = await this.getSettings();
    settings[key] = value;
    return this.saveSettings(settings);
  }
  
  // ==================== Helpers ====================
  
  /**
   * Generate a unique ID
   * @private
   * @returns {string}
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  /**
   * Get the underlying adapter (for migration runner)
   * @returns {StorageAdapter}
   */
  getAdapter() {
    return this.adapter;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotesRepository;
}
