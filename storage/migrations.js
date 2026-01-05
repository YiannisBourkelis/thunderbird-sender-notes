/**
 * Migration Definitions
 * All database migrations for the Sender Notes addon
 * 
 * Migration ID format: "XXX_description" where XXX is a 3-digit number
 * Migrations are run in order by ID.
 * 
 * Each migration must have:
 *   - id: Unique identifier
 *   - description: Human-readable description
 *   - up: Async function to apply the migration
 *   - down: (Optional) Async function to rollback the migration
 */

const MIGRATIONS = [
  // Future migrations will be added here as the addon evolves
  // 
  // Example:
  // {
  //   id: '001_add_color_field_to_notes',
  //   description: 'Add default color field to all notes',
  //   up: async (adapter) => {
  //     const notes = await adapter.getAllNotes();
  //     for (const [id, note] of Object.entries(notes)) {
  //       if (!note.color) {
  //         await adapter.saveNote({ ...note, id, color: 'default' });
  //       }
  //     }
  //   },
  //   down: async (adapter) => {
  //     const notes = await adapter.getAllNotes();
  //     for (const [id, note] of Object.entries(notes)) {
  //       const { color, ...noteWithoutColor } = note;
  //       await adapter.saveNote({ ...noteWithoutColor, id });
  //     }
  //   }
  // }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MIGRATIONS;
}
