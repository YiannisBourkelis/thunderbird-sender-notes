# Thunderbird Mail Note Addon - Requirements

## Overview
A Thunderbird addon that allows users to attach notes to email senders. When an email from a noted sender is displayed, a banner shows the note at the top of the reading pane.

## Functional Requirements

### 1. Add/Edit Note to Sender
- **FR1.1**: User can right-click on an email and select "Add Note to Sender" from the context menu
- **FR1.2**: A dialog/popup appears allowing the user to enter or edit a note
- **FR1.3**: Notes are associated with sender email addresses using flexible matching
- **FR1.4**: User can edit existing notes for a sender
- **FR1.5**: User can delete notes for a sender

### 2. Email Matching Options
- **FR2.1**: User can choose from 4 matching types when creating a note:
  - **Exact Match**: Email must exactly match the pattern (e.g., `john.doe@example.com`)
  - **Starts With**: Email must start with the pattern (e.g., `john.` matches `john.doe@example.com`)
  - **Ends With**: Email must end with the pattern (e.g., `@example.com` matches all emails from that domain)
  - **Contains**: Email must contain the pattern anywhere (e.g., `example` matches any email containing "example")
- **FR2.2**: The match pattern must be validated against the current sender email before saving
- **FR2.3**: Notes cannot be saved with an empty note text
- **FR2.4**: Notes cannot be saved if the pattern doesn't match the current sender
- **FR2.5**: Notes cannot be saved if another note with the exact same pattern AND match type already exists. User should be notified under the pattern field that they need to update the existing note instead.

### 3. Display Note Banner
- **FR3.1**: When viewing an email, check all saved notes for matching patterns
- **FR3.2**: If matches are found, display one banner per matching note at the top of the message pane
- **FR3.3**: Multiple banners can be displayed for the same email (e.g., exact match + domain match)
- **FR3.4**: The banners should be visually distinct (e.g., colored background)
- **FR3.5**: Each banner displays its note text
- **FR3.6**: Each banner should include a way to edit or remove its specific note

### 4. Multiple Notes Per Email
- **FR4.1**: An email can match multiple notes with different patterns (e.g., exact: "user@domain.com" AND endsWith: "@domain.com")
- **FR4.2**: The message display action popup should list all matching notes for the current sender
- **FR4.3**: User can edit or delete individual notes from the list

### 5. Note Management
- **FR5.1**: Notes are persisted across Thunderbird sessions
- **FR5.2**: Notes are stored locally using Thunderbird's storage API
- **FR5.3**: User can view all saved notes (optional: settings page)

### 6. Quick Notes / Templates
- **FR6.1**: Predefined quick note templates for common scenarios
- **FR6.2**: User can add custom templates
- **FR6.3**: User can delete templates
- **FR6.4**: Templates persist across sessions

## Non-Functional Requirements

### 1. Compatibility
- **NFR1.1**: Compatible with Thunderbird 115+ (MailExtension WebExtension API)
- **NFR1.2**: Uses Manifest V3 format

### 2. Performance
- **NFR2.1**: Note lookup should be fast and not delay email display
- **NFR2.2**: Storage should handle hundreds of notes efficiently

### 3. User Experience
- **NFR3.1**: Intuitive UI that follows Thunderbird design patterns
- **NFR3.2**: Non-intrusive banner that doesn't obstruct email content

## Mozilla Add-on Review Requirements

When submitting to addons.thunderbird.net, the following requirements must be met:

### Icons
- All icons must be **square** (width = height)
- Common sizes: 48x48, 96x96 pixels

### Security Requirements
- **No inline scripts**: All JavaScript must be in external `.js` files, not inside `<script>` tags in HTML
- **No innerHTML with dynamic content**: Use DOM methods instead:
  ```javascript
  // BAD - triggers security warning
  element.innerHTML = `<span>${userInput}</span>`;
  
  // GOOD - safe DOM manipulation
  const span = document.createElement('span');
  span.textContent = userInput;
  element.appendChild(span);
  ```
- If `innerHTML` must be used, ensure all dynamic content is properly escaped

### Permissions
- Thunderbird-specific permissions like `messagesRead` and `accountsRead` may trigger warnings in the Mozilla validator (which is designed for Firefox), but these are valid for Thunderbird and can be ignored

### Content Security Policy (CSP)
- Default CSP rules prevent inline JavaScript
- Move all inline scripts to external files

## Technical Design

### Storage Structure
```json
{
  "notes": {
    "unique-id-1": {
      "pattern": "@example.com",
      "matchType": "endsWith",
      "note": "This is my note about this domain",
      "createdAt": "2026-01-02T10:00:00Z",
      "updatedAt": "2026-01-02T10:00:00Z"
    },
    "unique-id-2": {
      "pattern": "john.doe@example.com",
      "matchType": "exact",
      "note": "Important client",
      "createdAt": "2026-01-02T10:00:00Z",
      "updatedAt": "2026-01-02T10:00:00Z"
    }
  },
  "templates": [
    "Important client - always respond within 24 hours! 🔥",
    "VIP customer - handle with care ⭐"
  ]
}
```

### Match Types
| Type | Description | Example Pattern | Matches |
|------|-------------|-----------------|---------|
| `exact` | Full email match | `john@example.com` | Only `john@example.com` |
| `startsWith` | Email begins with | `john.` | `john.doe@example.com`, `john.smith@test.com` |
| `endsWith` | Email ends with | `@example.com` | All emails from example.com domain |
| `contains` | Email contains | `example` | Any email containing "example" |

### API Usage
- `messenger.storage.local` - For persisting notes
- `messenger.messageDisplay` - For detecting when messages are displayed
- `messenger.messageDisplayAction` - For banner/notification in message pane
- `messenger.menus` - For context menu integration
- `messenger.messages` - For getting sender information

### File Structure
```
thundirbird_mailnote/
├── manifest.json
├── background.js
├── messageDisplay/
│   ├── note-banner.html
│   ├── note-banner.js
│   └── note-banner.css
├── popup/
│   ├── add-note.html
│   ├── add-note.js
│   └── add-note.css
├── icons/
│   ├── icon-48.svg
│   └── icon-96.svg
├── preview.html
├── README.md
└── REQUIREMENTS.md
```

## Milestones

1. **M1**: Basic addon structure with manifest and background script ✅
2. **M2**: Context menu integration to add notes ✅
3. **M3**: Note storage and retrieval ✅
4. **M4**: Banner display in message pane ✅
5. **M5**: Edit and delete functionality ✅
6. **M6**: Quick notes / templates ✅
7. **M7**: Flexible email matching (exact, starts with, ends with, contains) ✅
8. **M8**: Polish and testing
