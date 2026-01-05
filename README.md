# Sender Notes for Thunderbird

**Persistent per-sender notes that surface automatically when you open an email.**

![Thunderbird](https://img.shields.io/badge/Thunderbird-128.0+-blue?logo=thunderbird)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## The Problem

Many Thunderbird users:

- 📧 Handle repeat conversations with the same people
- 🧠 Rely on mental context ("this client is important", "slow to pay", "VIP", "legal risk", etc.)
- ⏰ Lose that context over time or across team members

## The Solution

**Sender Notes** lets you attach notes to email senders. When you open an email, your note appears automatically as a banner at the top of the message.

✅ Simple  
✅ High-signal  
✅ Immediately useful  
✅ No external services or accounts required

---

## Features

### 📝 Flexible Note Matching

Create notes that match emails in different ways:

| Match Type | Example Pattern | Matches |
|------------|-----------------|---------|
| **Exact** | `john@example.com` | Only that specific email |
| **Starts With** | `john.` | `john.doe@example.com`, `john.smith@test.com` |
| **Ends With** | `@example.com` | All emails from that domain |
| **Contains** | `acme` | Any email containing "acme" |

### 🏷️ Multiple Notes Per Sender

Apply multiple notes to the same email. For example:
- An exact match note: "Primary contact for Project X"
- A domain note: "Acme Corp - Net 30 payment terms"

Both banners display when viewing emails from that sender.

### ⚡ Quick Notes / Templates

Speed up your workflow with pre-defined templates:
- "VIP - Respond within 24 hours 🔥"
- "Slow payer - Follow up on invoices"
- Create your own custom templates

### 🎨 Visual Banners

Notes appear as non-intrusive banners at the top of the message pane:
- Distinct yellow background (adapts to dark mode)
- Shows the match type and pattern
- Click any banner to edit the note
- Supports multi-line formatting

### 🔒 Privacy First

- All notes stored locally in Thunderbird
- No external servers or accounts
- Your data stays on your machine

---

## Installation

### From Thunderbird Add-ons (Recommended)

1. Open Thunderbird
2. Go to **Tools** → **Add-ons and Themes**
3. Search for "Sender Notes"
4. Click **Add to Thunderbird**

### Manual Installation

1. Download the latest `.xpi` file from [Releases](https://github.com/YiannisBourkelis/thunderbird-sender-notes/releases)
2. Open Thunderbird
3. Go to **Tools** → **Add-ons and Themes**
4. Click the gear icon ⚙️ → **Install Add-on From File...**
5. Select the downloaded `.xpi` file

### For Development

```bash
git clone https://github.com/YiannisBourkelis/thunderbird-sender-notes.git
cd thunderbird-sender-notes
```

Then in Thunderbird:
1. Go to **Tools** → **Developer Tools** → **Debug Add-ons**
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file

---

## Usage

### Adding a Note

1. **Right-click** on any email in your inbox
2. Select **"Add Note to Sender"** from the context menu
3. Choose a match type (exact, starts with, ends with, contains)
4. Enter your note
5. Click **Save**

### Viewing Notes

When you open an email from a sender with notes:
- Yellow banners appear at the top of the message
- Each banner shows the note text and match pattern
- Multiple notes display as multiple banners

### Editing Notes

**Option 1:** Click directly on the note banner in the message view

**Option 2:** 
1. Click the **Sender Notes** button in the message toolbar
2. View all matching notes for the current sender
3. Click **Edit** on any note

### Managing Templates

1. Open the Add Note dialog (right-click → Add Note to Sender)
2. Scroll down to the **Quick Notes** section
3. Click any template to insert it
4. Add new templates with the **+** button
5. Delete templates with the **×** button

---

## Requirements

- **Thunderbird 128.0** or later
- Manifest V3 compatible

---

## Technical Details

### Permissions Used

This extension requests only the minimum permissions needed to function. Here's exactly what each permission does and why it's required:

| Permission | Why It's Needed | Where It's Used |
|------------|-----------------|-----------------|
| `storage` | Store your notes and templates locally on your computer | All notes are saved in IndexedDB, never sent to external servers |
| `messagesRead` | Read the sender's email address from messages you view | Used to match notes to senders and display relevant banners |
| `accountsRead` | Read your configured email account addresses | Used to detect messages you sent (so notes only appear on received emails) |
| `menus` | Add the "Add Note to Sender" option to right-click menus | Creates the context menu entry for adding notes |
| `scripting` | Inject the note banner into the message display | Displays the yellow note banners at the top of emails |

**Privacy Commitment:**
- ✅ No data is ever sent to external servers
- ✅ No tracking or analytics
- ✅ All data stays on your local machine
- ✅ Open source - you can verify the code yourself

### Data Storage

Notes are stored locally using IndexedDB:

```json
{
  "notes": {
    "note-id-1": {
      "pattern": "@example.com",
      "matchType": "endsWith",
      "note": "Important domain - handle with care",
      "createdAt": "2026-01-02T10:00:00Z",
      "updatedAt": "2026-01-03T15:30:00Z"
    }
  },
  "templates": [
    "VIP customer ⭐",
    "Follow up required 📞"
  ]
}
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contributing Translations

Help make Sender Notes available in more languages! Here's how:

1. **Copy an existing translation folder**
   - Navigate to `_locales/en/` (English) as a template
   - Create a new folder with your language code (e.g., `_locales/fr/` for French)

2. **Translate the messages.json file**
   - Copy `messages.json` from the `en` folder to your new folder
   - Translate only the `"message"` values, not the keys
   - Keep placeholders like `$1`, `$COUNT$` unchanged

3. **Example structure:**
   ```
   _locales/
   ├── en/
   │   └── messages.json  (English - default)
   ├── el/
   │   └── messages.json  (Greek)
   └── fr/
       └── messages.json  (French - your new translation)
   ```

4. **Test your translation**
   - Load the addon in Thunderbird
   - Go to Settings and select your language
   - Verify all UI elements display correctly

5. **Submit a Pull Request**
   - Include your new `_locales/[lang]/messages.json` file
   - We'll review and merge your contribution!

**Currently supported languages:**
- English (default)
- Greek (Ελληνικά)

---

## Disclaimer

⚠️ This addon is provided as-is, without warranty. While every effort has been made to ensure reliability, please back up important notes elsewhere. Use at your own risk.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with ❤️ for the Thunderbird community
- Inspired by the need for simple, effective email context management

---

**Made by [Yiannis](https://github.com/YiannisBourkelis)**
