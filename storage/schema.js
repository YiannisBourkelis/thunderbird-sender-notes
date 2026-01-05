/**
 * IndexedDB Schema Definitions
 * 
 * Schema changes are versioned and applied in onupgradeneeded.
 * Each version describes the changes to apply when upgrading from the previous version.
 * 
 * Note: IndexedDB only allows creating/modifying object stores inside onupgradeneeded,
 * so schema changes must be defined here, not in migrations.js (which is for data migrations).
 */

const DB_SCHEMA = {
  // Current schema version - bump this when adding new schema changes
  version: 1,
  
  // Schema changes by version
  // Each version's changes are applied when upgrading TO that version
  versions: {
    1: {
      description: 'Initial schema - create all object stores',
      stores: [
        {
          name: 'migrations',
          keyPath: 'id',
          indexes: [
            { name: 'appliedAt', keyPath: 'appliedAt', unique: false }
          ]
        },
        {
          name: 'notes',
          keyPath: 'id',
          indexes: [
            { name: 'pattern', keyPath: 'pattern', unique: false },
            { name: 'matchType', keyPath: 'matchType', unique: false },
            { name: 'pattern_matchType', keyPath: ['pattern', 'matchType'], unique: false }
          ]
        },
        {
          name: 'templates',
          keyPath: 'id',
          indexes: []
        },
        {
          name: 'settings',
          keyPath: 'id',
          indexes: []
        }
      ]
    }
    
    // Future schema changes:
    // 2: {
    //   description: 'Add categories store',
    //   stores: [
    //     { name: 'categories', keyPath: 'id', indexes: [] }
    //   ],
    //   // Optional: modify existing stores
    //   modifications: [
    //     { store: 'notes', addIndex: { name: 'categoryId', keyPath: 'categoryId', unique: false } }
    //   ]
    // }
  }
};

/**
 * Apply schema changes for a specific version
 * @param {IDBDatabase} db 
 * @param {IDBTransaction} tx - The versionchange transaction
 * @param {number} version 
 */
function applySchemaVersion(db, tx, version) {
  const schema = DB_SCHEMA.versions[version];
  if (!schema) return;
  
  console.log(`Applying schema version ${version}: ${schema.description}`);
  
  // Create new stores
  if (schema.stores) {
    for (const storeDef of schema.stores) {
      if (!db.objectStoreNames.contains(storeDef.name)) {
        const store = db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });
        
        // Create indexes
        for (const indexDef of storeDef.indexes || []) {
          store.createIndex(indexDef.name, indexDef.keyPath, { unique: indexDef.unique });
        }
        
        console.log(`  Created store: ${storeDef.name}`);
      }
    }
  }
  
  // Apply modifications to existing stores
  if (schema.modifications) {
    for (const mod of schema.modifications) {
      if (db.objectStoreNames.contains(mod.store)) {
        const store = tx.objectStore(mod.store);
        
        if (mod.addIndex && !store.indexNames.contains(mod.addIndex.name)) {
          store.createIndex(mod.addIndex.name, mod.addIndex.keyPath, { unique: mod.addIndex.unique });
          console.log(`  Added index ${mod.addIndex.name} to ${mod.store}`);
        }
        
        if (mod.deleteIndex && store.indexNames.contains(mod.deleteIndex)) {
          store.deleteIndex(mod.deleteIndex);
          console.log(`  Deleted index ${mod.deleteIndex} from ${mod.store}`);
        }
      }
    }
  }
}

/**
 * Apply all schema changes from oldVersion to newVersion
 * @param {IDBDatabase} db 
 * @param {IDBTransaction} tx 
 * @param {number} oldVersion 
 * @param {number} newVersion 
 */
function applySchemaUpgrade(db, tx, oldVersion, newVersion) {
  console.log(`Upgrading IndexedDB schema from version ${oldVersion} to ${newVersion}`);
  
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    applySchemaVersion(db, tx, v);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DB_SCHEMA, applySchemaUpgrade };
}
