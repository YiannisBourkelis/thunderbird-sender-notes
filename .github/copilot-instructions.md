# Copilot Instructions for Sender Notes

Thunderbird WebExtension (Manifest V3) that attaches persistent notes to email senders, displayed as yellow banners when viewing emails. Requires **Thunderbird 128.0+**.

## Architecture

**Message-passing architecture** with `background.js` as the central hub:
- Background script handles all business logic, data access, and coordinates between components
- UI components (popups, content scripts) communicate via `messenger.runtime.sendMessage({ action: '...' })`
- Storage uses **Repository Pattern**: `NotesRepository` → `StorageAdapter` interface → `IndexedDBAdapter`

Key data flow: UI → `sendMessage()` → `background.js` → `NotesRepository` → `IndexedDBAdapter` → IndexedDB

### Background Script Loading Order
Scripts load in manifest order (dependencies first):
```
StorageAdapter.js → schema.js → IndexedDBAdapter.js → NotesRepository.js → MigrationRunner.js → migrations.js → background.js
```

## File Organization

| Directory | Purpose |
|-----------|---------|
| `storage/` | Data layer: `NotesRepository.js`, `IndexedDBAdapter.js`, `schema.js`, migrations |
| `popup/` | Popup windows: `add-note.js`, `view-note.js`, `alert.js` with matching HTML/CSS |
| `messageDisplay/` | Content script injected into message pane via `messenger.scripting.messageDisplay` |
| `manage/` | Full-page settings UI (opens in tab via `options_ui`) |
| `welcome/` | First-run onboarding page (language selection, template init) |
| `shared/` | Shared utilities (`i18n.js` for translations) |
| `_locales/` | i18n strings in `en/` and `el/` |

## Critical Patterns

### Message Passing
All popup/content scripts communicate with background via actions:
```javascript
// Sending from popup/content script
const result = await messenger.runtime.sendMessage({ action: 'saveNote', ... });

// Handling in background.js - search for "messenger.runtime.onMessage"
messenger.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'saveNote') { ... }
});
```

Key actions: `saveNote`, `deleteNote`, `getAllNotes`, `getNoteById`, `findAllMatchingNotes`, `getTemplates`, `addTemplate`, `updateTemplate`, `deleteTemplate`, `getCurrentMessageSender`, `checkCurrentMessageNotes`, `isOwnEmail`, `getSettings`, `saveSettings`

### Internationalization (i18n)
- HTML: Use `data-i18n="messageKey"` attributes, auto-translated by `shared/i18n.js`
- JS in popups: Use `i18n('messageKey')` after awaiting `i18nReady`
- JS in background: Use `bgI18n('messageKey')` 
- All strings defined in `_locales/{lang}/messages.json`

### Storage Layer
- Never access IndexedDB directly; always use `NotesRepository` via background script
- Schema versioning in `storage/schema.js` (declarative); migrations in `storage/migrations.js`
- IndexedDB stores: `notes`, `templates`, `settings`, `migrations`
- To add new fields: update schema version, add migration, update adapter methods

### Note Matching Logic
Notes match emails via `matchType`: `exact`, `startsWith`, `endsWith`, `contains`
Pattern matching logic is in `background.js` function `findAllMatchingNotes()`
- Patterns stored **lowercase**; matching is **case-insensitive**
- Notes only shown for **received emails** (own-email detection via `accountsRead` permission)

### Security Requirements (Mozilla Add-on Review)
- **No inline scripts**: All JS in external `.js` files
- **No innerHTML with dynamic content**: Use DOM methods (`createElement`, `textContent`, `appendChild`)
- **No eval or dynamic code execution**

## Build & Development

### Build XPI
```bash
cd /home/yiannis/projects/thunderbird_sender_notes
zip -r sender-notes.xpi manifest.json background.js LICENSE README.md \
  _locales icons manage messageDisplay popup shared storage welcome \
  -x "*.DS_Store" -x "*.log"
```

### Testing
1. Open Thunderbird → Tools → Developer Tools → Debug Add-ons
2. Load Temporary Add-on → select `manifest.json`
3. Console logs appear in the extension's debugging console

### Key Files for Common Changes
- **Add new message action**: `background.js` (handler) + calling popup JS
- **New storage field**: `storage/schema.js`, `storage/migrations.js`, `storage/IndexedDBAdapter.js`
- **New UI string**: `_locales/en/messages.json` (and `el/messages.json`)
- **Banner appearance**: `messageDisplay/note-banner.css`

## Conventions

- Use `messenger.*` API (Thunderbird's namespaced WebExtension API), not `browser.*` or `chrome.*`
- Popup windows pass data via URL query params (see `add-note.js` lines 4-7)
- Background script manages `openNoteWindows` Map to prevent duplicate popups
- No external dependencies (no npm/node_modules) - pure vanilla JS

## Detailed Documentation

For deeper context, consult these architecture documents:
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Complete app architecture, lifecycles, data flows, all message handlers
- [STORAGE_ARCHITECTURE.md](../STORAGE_ARCHITECTURE.md) - Repository pattern, IndexedDB schema, migration system
- [REQUIREMENTS.md](../REQUIREMENTS.md) - Functional requirements, Mozilla review requirements
- [README.md](../README.md) - User-facing features, permissions explained, installation
