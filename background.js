// Background script for Mail Note addon

// Track open note editor windows to avoid duplicates
const openNoteWindows = new Map(); // key: noteId or email, value: windowId

// Get default templates using i18n
function getDefaultTemplates() {
  return [
    messenger.i18n.getMessage("templateVipPrioritize"),
    messenger.i18n.getMessage("templateImportantClient"),
    messenger.i18n.getMessage("templatePotentialSpam"),
    messenger.i18n.getMessage("templateSpam"),
    messenger.i18n.getMessage("templateComplaintHistory"),
    messenger.i18n.getMessage("templateAggressiveCommunication"),
    messenger.i18n.getMessage("templateOutstandingBalance"),
    messenger.i18n.getMessage("templateSlowPayer"),
    messenger.i18n.getMessage("templateOldColleague"),
    messenger.i18n.getMessage("templateFriendlyInformal"),
    messenger.i18n.getMessage("templateConfidentialClient"),
    messenger.i18n.getMessage("templateAppointmentNoShow"),
    messenger.i18n.getMessage("templateFrequentlyLate"),
    messenger.i18n.getMessage("templateFrequentGuest"),
    messenger.i18n.getMessage("templateNewsletter"),
    messenger.i18n.getMessage("templateResearch")
  ];
}

// Initialize storage on first install
messenger.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // Only initialize notes storage - templates will be set after welcome page language selection
    await messenger.storage.local.set({ 
      notes: {}
    });
    console.log("Mail Note addon installed successfully");
    
    // Open welcome page for language selection
    await messenger.tabs.create({
      url: messenger.runtime.getURL('welcome/welcome.html')
    });
  }
});

// Create context menu item for adding notes
messenger.menus.create({
  id: "add-sender-note",
  title: messenger.i18n.getMessage("contextMenuAddNote"),
  contexts: ["message_list"]
});

// Create Tools menu item for managing all notes
messenger.menus.create({
  id: "manage-all-notes",
  title: messenger.i18n.getMessage("toolsMenuManage"),
  contexts: ["tools_menu"]
});

// Handle context menu clicks
messenger.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-sender-note") {
    const messageId = info.selectedMessages?.messages?.[0]?.id;
    if (messageId) {
      const message = await messenger.messages.get(messageId);
      const senderEmail = extractEmail(message.author);
      
      // Open or focus popup to add/edit note
      const windowKey = `new-${senderEmail}`;
      const popupUrl = `popup/add-note.html?email=${encodeURIComponent(senderEmail)}&author=${encodeURIComponent(message.author)}`;
      await openOrFocusNoteWindow(windowKey, popupUrl);
    }
  } else if (info.menuItemId === "manage-all-notes") {
    // Open manage notes window
    await openManageNotesWindow();
  }
});

// Open the manage notes page (options page)
async function openManageNotesWindow(tab = 'notes') {
  // Open options page with tab parameter
  if (tab === 'templates') {
    // Use tabs.create to open with hash for specific tab
    await messenger.tabs.create({
      url: messenger.runtime.getURL('manage/manage-notes.html#templates')
    });
  } else {
    await messenger.runtime.openOptionsPage();
  }
}

// Helper function to open or focus a note editor window
async function openOrFocusNoteWindow(windowKey, url) {
  // Check if window is already open
  if (openNoteWindows.has(windowKey)) {
    const existingWindowId = openNoteWindows.get(windowKey);
    try {
      // Check if window still exists
      const win = await messenger.windows.get(existingWindowId);
      if (win) {
        // Focus the existing window
        await messenger.windows.update(existingWindowId, { focused: true });
        return { success: true, focused: true };
      }
    } catch (e) {
      // Window no longer exists, remove from tracking
      openNoteWindows.delete(windowKey);
    }
  }
  
  // Create new window
  const newWindow = await messenger.windows.create({
    type: "popup",
    url: url,
    width: 500,
    height: 500
  });
  
  // Track the new window
  if (newWindow && newWindow.id) {
    openNoteWindows.set(windowKey, newWindow.id);
  }
  
  return { success: true, created: true };
}

// Clean up tracking when windows are closed
messenger.windows.onRemoved.addListener((windowId) => {
  // Remove closed window from tracking
  for (const [key, id] of openNoteWindows.entries()) {
    if (id === windowId) {
      openNoteWindows.delete(key);
      break;
    }
  }
});

// Register the message display script at startup
// The script will automatically check for notes when injected into a message display
async function registerMessageDisplayScript() {
  try {
    await messenger.scripting.messageDisplay.registerScripts([{
      id: "note-banner-script",
      js: ["messageDisplay/note-banner.js"],
      css: ["messageDisplay/note-banner.css"]
    }]);
    console.log("Mail Note: Banner script registered");
  } catch (e) {
    // Script might already be registered from a previous session
    if (!e.message?.includes("already registered")) {
      console.log("Script registration:", e.message);
    }
  }
}

// Initialize the script registration
registerMessageDisplayScript();

// Handle messages from popups and content scripts
messenger.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
    case "saveNote":
      return await saveNote(message.noteId, message.pattern || message.email, message.matchType || 'exact', message.note, message.originalEmail);
    
    case "getNote":
      return await getNote(message.email);
    
    case "findMatchingNote":
      return await findMatchingNote(message.email);
    
    case "findAllMatchingNotes":
      return await findAllMatchingNotes(message.email);
    
    case "checkDuplicatePattern":
      return await checkDuplicatePattern(message.pattern, message.matchType, message.excludeNoteId);
    
    case "deleteNote":
      return await deleteNote(message.noteId, message.email);
    
    case "getAllNotes":
      return await getAllNotes();
    
    case "getCurrentMessageSender":
      return await getCurrentMessageSender(sender.tab?.id);
    
    case "getTemplates":
      return await getTemplates();
    
    case "saveTemplates":
      return await saveTemplates(message.templates);
    
    case "addTemplate":
      return await addTemplate(message.template);
    
    case "updateTemplate":
      return await updateTemplate(message.index, message.template);
    
    case "deleteTemplate":
      return await deleteTemplate(message.index);
    
    case "validatePattern":
      return validatePattern(message.email, message.pattern, message.matchType);
    
    case "openAddNotePopup":
      const addNoteUrl = `popup/add-note.html?email=${encodeURIComponent(message.email)}&author=${encodeURIComponent(message.author)}${message.noteId ? `&noteId=${encodeURIComponent(message.noteId)}` : ''}`;
      const addWindowKey = message.noteId || `new-${message.email}`;
      return await openOrFocusNoteWindow(addWindowKey, addNoteUrl);
    
    case "openManageNotes":
      await openManageNotesWindow();
      return { success: true };
    
    case "openManageNotesTemplates":
      await openManageNotesWindow('templates');
      return { success: true };
    
    case "checkCurrentMessageNote":
      // Called by content script to check if current message sender has a note (single note - backward compat)
      return await checkCurrentMessageNote(sender.tab?.id);
    
    case "checkCurrentMessageNotes":
      // Called by content script to check if current message sender has notes (multiple notes)
      return await checkCurrentMessageNotes(sender.tab?.id);
    
    case "editNoteFromBanner":
      // Open or focus the edit popup for a note clicked in the banner
      try {
        const data = await messenger.storage.local.get('notes');
        const notes = data.notes || {};
        const noteData = notes[message.noteId];
        if (noteData) {
          const editUrl = `popup/add-note.html?email=${encodeURIComponent(noteData.pattern || message.noteId)}&author=${encodeURIComponent(noteData.pattern || message.noteId)}&noteId=${encodeURIComponent(message.noteId)}`;
          return await openOrFocusNoteWindow(message.noteId, editUrl);
        }
        return { success: false, error: 'Note not found' };
      } catch (e) {
        console.error("Error opening edit popup:", e);
        return { success: false, error: e.message };
      }
    
    case "refreshBanner":
      // Refresh banner in all tabs displaying messages from this sender
      return await refreshBannerForEmail(message.email);
      
    default:
      return null;
  }
});

// Helper function to inject banner script and CSS into a tab
async function injectBannerScriptIntoTab(tabId) {
  try {
    // First inject the CSS
    await messenger.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["messageDisplay/note-banner.css"]
    });
    
    // Then inject the JS
    await messenger.scripting.executeScript({
      target: { tabId: tabId },
      files: ["messageDisplay/note-banner.js"]
    });
    
    return true;
  } catch (e) {
    console.log("Could not inject script into tab:", e.message);
    return false;
  }
}

// Helper function to send message to tab, injecting script if needed
async function sendMessageToTabWithInjection(tabId, message) {
  // First try to send the message
  try {
    await messenger.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    // Script not loaded - inject it first
    console.log("Script not loaded, injecting...");
    const injected = await injectBannerScriptIntoTab(tabId);
    
    if (injected) {
      // Wait a moment for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try sending again
      try {
        await messenger.tabs.sendMessage(tabId, message);
        return true;
      } catch (e2) {
        console.log("Still could not send message after injection:", e2.message);
        return false;
      }
    }
    return false;
  }
}

// Refresh the note banner for a specific email in all tabs
async function refreshBannerForEmail(email) {
  try {
    // Get all tabs
    const tabs = await messenger.tabs.query({});
    
    for (const tab of tabs) {
      try {
        // Try to get displayed messages in this tab using MV3 API
        if (messenger.messageDisplay && messenger.messageDisplay.getDisplayedMessages) {
          const messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
          const messages = messageList?.messages || [];
          
          for (const message of messages) {
            const msgEmail = extractEmail(message.author);
            
            // Find all matching notes for this email
            const matchingNotes = await findAllMatchingNotes(msgEmail);
            
            if (matchingNotes && matchingNotes.length > 0) {
              // Send message to tab, injecting script if needed
              await sendMessageToTabWithInjection(tab.id, {
                action: "showNoteBanners",
                notes: matchingNotes,
                senderEmail: msgEmail
              });
            } else if (msgEmail.toLowerCase() === email.toLowerCase()) {
              // Hide banners if no notes exist
              try {
                await messenger.tabs.sendMessage(tab.id, {
                  action: "hideNoteBanner"
                });
              } catch (e) {
                // Tab might not have the script yet - that's OK for hide
              }
            }
          }
        }
      } catch (e) {
        // Tab might not support message display
      }
    }
    
    return { success: true };
  } catch (e) {
    console.error("refreshBannerForEmail error:", e);
    return { success: false, error: e.message };
  }
}

// Helper function to extract email from author string
function extractEmail(author) {
  const match = author.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return author.toLowerCase().trim();
}

// Generate unique ID for notes
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Validate if a pattern matches an email
function validatePattern(email, pattern, matchType) {
  const emailLower = email.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  switch (matchType) {
    case 'exact':
      return emailLower === patternLower;
    case 'startsWith':
      return emailLower.startsWith(patternLower);
    case 'endsWith':
      return emailLower.endsWith(patternLower);
    case 'contains':
      return emailLower.includes(patternLower);
    default:
      return false;
  }
}

// Find a matching note for an email
async function findMatchingNote(email) {
  const data = await messenger.storage.local.get("notes");
  const notes = data.notes || {};
  
  // Priority: exact > startsWith > endsWith > contains
  const priorities = ['exact', 'startsWith', 'endsWith', 'contains'];
  
  for (const matchType of priorities) {
    for (const [noteId, noteData] of Object.entries(notes)) {
      if (noteData.matchType === matchType && validatePattern(email, noteData.pattern, matchType)) {
        return { ...noteData, id: noteId };
      }
    }
  }
  
  return null;
}

// Find ALL matching notes for an email (returns array)
async function findAllMatchingNotes(email) {
  const data = await messenger.storage.local.get("notes");
  const notes = data.notes || {};
  const matchingNotes = [];
  
  // Order by priority: exact > startsWith > endsWith > contains
  const priorities = ['exact', 'startsWith', 'endsWith', 'contains'];
  
  for (const matchType of priorities) {
    for (const [noteId, noteData] of Object.entries(notes)) {
      if (noteData.matchType === matchType && validatePattern(email, noteData.pattern, matchType)) {
        matchingNotes.push({ ...noteData, id: noteId });
      }
    }
  }
  
  return matchingNotes;
}

// Check if a duplicate pattern+matchType exists (excluding a specific note ID)
async function checkDuplicatePattern(pattern, matchType, excludeNoteId = null) {
  const data = await messenger.storage.local.get("notes");
  const notes = data.notes || {};
  
  for (const [noteId, noteData] of Object.entries(notes)) {
    if (noteId === excludeNoteId) continue;
    if (noteData.pattern.toLowerCase() === pattern.toLowerCase() && noteData.matchType === matchType) {
      return { exists: true, noteId, note: noteData };
    }
  }
  
  return { exists: false };
}

// Save a note
async function saveNote(existingNoteId, pattern, matchType, note, originalEmail) {
  const data = await messenger.storage.local.get("notes");
  const notes = data.notes || {};
  
  // Check if a note with this exact pattern and matchType already exists (excluding current note)
  const duplicate = await checkDuplicatePattern(pattern, matchType, existingNoteId);
  if (duplicate.exists) {
    return { 
      success: false, 
      error: 'duplicate', 
      message: `A note with this exact pattern and match type already exists. Please edit the existing note instead.`,
      existingNoteId: duplicate.noteId
    };
  }
  
  // Preserve the original createdAt date and originalEmail if updating an existing note
  let originalCreatedAt = null;
  let preservedOriginalEmail = null;
  if (existingNoteId && notes[existingNoteId]) {
    originalCreatedAt = notes[existingNoteId].createdAt;
    preservedOriginalEmail = notes[existingNoteId].originalEmail;
    delete notes[existingNoteId];
  }
  
  const now = new Date().toISOString();
  const noteId = existingNoteId || generateId();
  
  notes[noteId] = {
    pattern: pattern.toLowerCase(),
    matchType: matchType,
    note: note,
    originalEmail: preservedOriginalEmail || originalEmail || pattern,
    createdAt: originalCreatedAt || now,
    updatedAt: now
  };
  
  await messenger.storage.local.set({ notes });
  return { success: true, noteId };
}

// Get a note for a specific email (finds matching note)
async function getNote(email) {
  return await findMatchingNote(email);
}

// Delete a note by ID or email
async function deleteNote(noteId, email) {
  const data = await messenger.storage.local.get("notes");
  const notes = data.notes || {};
  
  if (noteId && notes[noteId]) {
    delete notes[noteId];
  } else if (email) {
    // Find and delete by matching email
    const match = await findMatchingNote(email);
    if (match && match.id) {
      delete notes[match.id];
    }
  }
  
  await messenger.storage.local.set({ notes });
  return { success: true };
}

// Get all notes
async function getAllNotes() {
  const data = await messenger.storage.local.get("notes");
  return data.notes || {};
}

// Get the sender of the currently displayed message
async function getCurrentMessageSender(tabId) {
  try {
    console.log("getCurrentMessageSender called with tabId:", tabId);
    
    // Method 1: Try messageDisplay.getDisplayedMessages() - MV3 API for message tabs
    if (messenger.messageDisplay && messenger.messageDisplay.getDisplayedMessages) {
      try {
        const tabs = await messenger.tabs.query({});
        console.log("Checking", tabs.length, "tabs for displayed messages");
        
        for (const tab of tabs) {
          try {
            const messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
            if (messageList && messageList.messages && messageList.messages.length > 0) {
              const message = messageList.messages[0];
              console.log("Found displayed message in tab", tab.id, ":", message.author);
              return {
                email: extractEmail(message.author),
                author: message.author
              };
            }
          } catch (e) {
            // Tab doesn't support message display, continue
          }
        }
      } catch (e) {
        console.log("messageDisplay.getDisplayedMessages failed:", e.message);
      }
    }
    
    // Method 2: Try mailTabs.getSelectedMessages() - for 3-pane mail tabs
    if (messenger.mailTabs) {
      try {
        const mailTabs = await messenger.mailTabs.query({});
        console.log("Found mail tabs:", mailTabs.length);
        
        for (const tab of mailTabs) {
          try {
            const messageList = await messenger.mailTabs.getSelectedMessages(tab.id);
            if (messageList && messageList.messages && messageList.messages.length > 0) {
              const message = messageList.messages[0];
              console.log("Found selected message in tab", tab.id, ":", message.author);
              return {
                email: extractEmail(message.author),
                author: message.author
              };
            }
          } catch (e) {
            // Continue to next tab
          }
        }
      } catch (e) {
        console.log("mailTabs.query failed:", e.message);
      }
    }
    
    console.error("No message found in any tab");
  } catch (e) {
    console.error("Error getting current message sender:", e);
  }
  return null;
}

// Get note templates
async function getTemplates() {
  const data = await messenger.storage.local.get("templates");
  return data.templates || getDefaultTemplates();
}

// Save all templates
async function saveTemplates(templates) {
  await messenger.storage.local.set({ templates });
  return { success: true };
}

// Add a new template
async function addTemplate(template) {
  const templates = await getTemplates();
  if (!templates.includes(template)) {
    templates.push(template);
    await messenger.storage.local.set({ templates });
  }
  return { success: true, templates };
}

// Delete a template by index
async function deleteTemplate(index) {
  const templates = await getTemplates();
  if (index >= 0 && index < templates.length) {
    templates.splice(index, 1);
    await messenger.storage.local.set({ templates });
  }
  return { success: true, templates };
}

// Update a template by index
async function updateTemplate(index, newText) {
  const templates = await getTemplates();
  if (index >= 0 && index < templates.length) {
    templates[index] = newText;
    await messenger.storage.local.set({ templates });
  }
  return { success: true, templates };
}

// Check if the current message sender has a note (called by content script)
async function checkCurrentMessageNote(tabId) {
  try {
    console.log("checkCurrentMessageNote called for tabId:", tabId);
    
    // Get the sender of the currently displayed message
    const sender = await getCurrentMessageSender(tabId);
    
    if (!sender || !sender.email) {
      console.log("checkCurrentMessageNote: No sender found");
      return { hasNote: false };
    }
    
    console.log("checkCurrentMessageNote: Checking note for", sender.email);
    
    // Find matching note
    const matchingNote = await findMatchingNote(sender.email);
    
    if (matchingNote) {
      console.log("checkCurrentMessageNote: Found note:", matchingNote.note);
      return {
        hasNote: true,
        note: matchingNote.note,
        pattern: matchingNote.pattern,
        matchType: matchingNote.matchType,
        senderEmail: sender.email
      };
    }
    
    console.log("checkCurrentMessageNote: No matching note found");
    return { hasNote: false };
  } catch (e) {
    console.error("checkCurrentMessageNote error:", e);
    return { hasNote: false };
  }
}

// Check if the current message sender has notes (returns ALL matching notes)
async function checkCurrentMessageNotes(tabId) {
  try {
    console.log("checkCurrentMessageNotes called for tabId:", tabId);
    
    // Get the sender of the currently displayed message
    const sender = await getCurrentMessageSender(tabId);
    
    if (!sender || !sender.email) {
      console.log("checkCurrentMessageNotes: No sender found");
      return { hasNotes: false, notes: [] };
    }
    
    console.log("checkCurrentMessageNotes: Checking notes for", sender.email);
    
    // Find ALL matching notes
    const matchingNotes = await findAllMatchingNotes(sender.email);
    
    if (matchingNotes && matchingNotes.length > 0) {
      console.log("checkCurrentMessageNotes: Found", matchingNotes.length, "notes");
      return {
        hasNotes: true,
        notes: matchingNotes,
        senderEmail: sender.email
      };
    }
    
    console.log("checkCurrentMessageNotes: No matching notes found");
    return { hasNotes: false, notes: [] };
  } catch (e) {
    console.error("checkCurrentMessageNotes error:", e);
    return { hasNotes: false, notes: [] };
  }
}

console.log("Mail Note background script loaded");
