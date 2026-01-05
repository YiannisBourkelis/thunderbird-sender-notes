/**
 * Migration Runner
 * Tracks and executes database migrations for the addon
 * 
 * Migrations are run in order and tracked in IndexedDB to ensure
 * each migration only runs once, even across addon updates.
 */

class MigrationRunner {
  constructor(adapter) {
    this.adapter = adapter;
    this.migrations = [];
  }
  
  /**
   * Register a migration
   * @param {Object} migration
   * @param {string} migration.id - Unique migration ID (use format: "001_description")
   * @param {string} migration.description - Human-readable description
   * @param {Function} migration.up - Async function to run the migration
   * @param {Function} [migration.down] - Optional async function to rollback
   */
  register(migration) {
    this.migrations.push(migration);
    // Keep migrations sorted by ID
    this.migrations.sort((a, b) => a.id.localeCompare(b.id));
  }
  
  /**
   * Register multiple migrations at once
   * @param {Object[]} migrations
   */
  registerAll(migrations) {
    for (const migration of migrations) {
      this.register(migration);
    }
  }
  
  /**
   * Get all applied migrations from the database
   * @returns {Promise<Object[]>}
   */
  async getAppliedMigrations() {
    const db = await this.adapter.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('migrations', 'readonly');
      const store = tx.objectStore('migrations');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Check if a migration has been applied
   * @param {string} migrationId
   * @returns {Promise<boolean>}
   */
  async isApplied(migrationId) {
    const db = await this.adapter.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('migrations', 'readonly');
      const store = tx.objectStore('migrations');
      const request = store.get(migrationId);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Mark a migration as applied
   * @param {string} migrationId
   * @param {string} description
   * @returns {Promise<void>}
   */
  async markAsApplied(migrationId, description = '') {
    const db = await this.adapter.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('migrations', 'readwrite');
      const store = tx.objectStore('migrations');
      const request = store.put({
        id: migrationId,
        description: description,
        appliedAt: new Date().toISOString()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Remove a migration record (for rollback)
   * @param {string} migrationId
   * @returns {Promise<void>}
   */
  async markAsNotApplied(migrationId) {
    const db = await this.adapter.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('migrations', 'readwrite');
      const store = tx.objectStore('migrations');
      const request = store.delete(migrationId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get pending migrations (registered but not yet applied)
   * @returns {Promise<Object[]>}
   */
  async getPendingMigrations() {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map(m => m.id));
    
    return this.migrations.filter(m => !appliedIds.has(m.id));
  }
  
  /**
   * Run all pending migrations
   * @returns {Promise<{success: boolean, applied: string[], errors: Object[]}>}
   */
  async runPending() {
    const pending = await this.getPendingMigrations();
    const applied = [];
    const errors = [];
    
    console.log(`MigrationRunner: ${pending.length} pending migrations`);
    
    for (const migration of pending) {
      try {
        console.log(`MigrationRunner: Running migration ${migration.id}...`);
        
        // Run the migration
        await migration.up(this.adapter);
        
        // Mark as applied
        await this.markAsApplied(migration.id, migration.description);
        
        applied.push(migration.id);
        console.log(`MigrationRunner: Migration ${migration.id} completed`);
      } catch (error) {
        console.error(`MigrationRunner: Migration ${migration.id} failed:`, error);
        errors.push({ id: migration.id, error: error.message });
        
        // Stop on first error to maintain consistency
        break;
      }
    }
    
    return {
      success: errors.length === 0,
      applied,
      errors
    };
  }
  
  /**
   * Rollback the last applied migration
   * @returns {Promise<{success: boolean, rolledBack: string|null, error?: string}>}
   */
  async rollbackLast() {
    const applied = await this.getAppliedMigrations();
    
    if (applied.length === 0) {
      return { success: true, rolledBack: null };
    }
    
    // Sort by appliedAt descending to get the last one
    applied.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
    const lastApplied = applied[0];
    
    // Find the migration definition
    const migration = this.migrations.find(m => m.id === lastApplied.id);
    
    if (!migration) {
      return { 
        success: false, 
        rolledBack: null, 
        error: `Migration ${lastApplied.id} not found in registered migrations` 
      };
    }
    
    if (!migration.down) {
      return { 
        success: false, 
        rolledBack: null, 
        error: `Migration ${lastApplied.id} does not have a rollback function` 
      };
    }
    
    try {
      console.log(`MigrationRunner: Rolling back migration ${migration.id}...`);
      
      // Run the rollback
      await migration.down(this.adapter);
      
      // Remove the migration record
      await this.markAsNotApplied(migration.id);
      
      console.log(`MigrationRunner: Rollback of ${migration.id} completed`);
      return { success: true, rolledBack: migration.id };
    } catch (error) {
      console.error(`MigrationRunner: Rollback of ${migration.id} failed:`, error);
      return { success: false, rolledBack: null, error: error.message };
    }
  }
  
  /**
   * Get migration status
   * @returns {Promise<Object>}
   */
  async getStatus() {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();
    
    return {
      total: this.migrations.length,
      applied: applied.length,
      pending: pending.length,
      appliedList: applied,
      pendingList: pending.map(m => ({ id: m.id, description: m.description }))
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MigrationRunner;
}
