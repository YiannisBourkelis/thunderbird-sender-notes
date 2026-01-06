// Background script for Mail Note addon
// Uses Repository pattern for storage abstraction

// ==================== Storage Setup ====================

// Initialize the storage repository
let storage = null;
let migrationRunner = null;

async function initializeStorage() {
  if (storage) return storage;
  
  // Create IndexedDB adapter and repository
  const adapter = new IndexedDBAdapter();
  storage = new NotesRepository(adapter);
  
  // Set default templates provider
  storage.setDefaultTemplatesProvider(getDefaultTemplates);
  
  // Initialize and run migrations
  migrationRunner = new MigrationRunner(adapter);
  migrationRunner.registerAll(MIGRATIONS);
  
  const migrationResult = await migrationRunner.runPending();
  if (migrationResult.applied.length > 0) {
    console.log("Mail Note: Applied migrations:", migrationResult.applied);
  }
  if (migrationResult.errors.length > 0) {
    console.error("Mail Note: Migration errors:", migrationResult.errors);
  }
  
  return storage;
}

// Ensure storage is initialized before any operation
async function getStorage() {
  if (!storage) {
    await initializeStorage();
  }
  return storage;
}

// ==================== Track Open Windows ====================

const openNoteWindows = new Map(); // key: noteId or email, value: windowId

// ==================== Default Templates ====================

function getDefaultTemplates() {
  return [
    bgI18n("templateImportantClient"),
    bgI18n("templatePotentialSpam"),
    bgI18n("templateSpam"),
    bgI18n("templateComplaintHistory"),
    bgI18n("templateAggressiveCommunication"),
    bgI18n("templateOutstandingBalance"),
    bgI18n("templateSlowPayer"),
    bgI18n("templateOldColleague"),
    bgI18n("templateFriendlyInformal"),
    bgI18n("templateConfidentialClient"),
    bgI18n("templateAppointmentNoShow"),
    bgI18n("templateFrequentlyLate"),
    bgI18n("templateFrequentGuest"),
    bgI18n("templateNewsletter"),
    bgI18n("templateResearch")
  ];
}

// ==================== Installation ====================

messenger.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("Mail Note addon installed successfully");
    
    // Initialize storage (this will create the IndexedDB)
    await initializeStorage();
    
    // Open welcome page for language selection
    await messenger.tabs.create({
      url: messenger.runtime.getURL('welcome/welcome.html')
    });
  } else if (details.reason === "update") {
    // On update, ensure storage is initialized and migrated if needed
    await initializeStorage();
  }
});

// ==================== Background i18n ====================

// Cache for loaded translations (background script version)
let bgCustomMessages = null;
let bgCurrentLanguage = 'auto';

/**
 * Load messages for a specific language in background script
 * @param {string} lang - Language code or 'auto'
 */
async function bgLoadMessages(lang) {
  if (lang === 'auto') {
    bgCustomMessages = null;
    return;
  }
  
  try {
    const url = messenger.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    if (response.ok) {
      bgCustomMessages = await response.json();
    } else {
      bgCustomMessages = null;
    }
  } catch (error) {
    console.warn(`Error loading messages for ${lang}:`, error);
    bgCustomMessages = null;
  }
}

/**
 * Get translated message respecting user's language preference
 * @param {string} key - Message key
 * @param {string|string[]} [substitutions] - Optional substitutions
 * @returns {string} Translated message
 */
function bgI18n(key, substitutions) {
  // Use custom messages if loaded
  if (bgCustomMessages && bgCustomMessages[key] && bgCustomMessages[key].message) {
    let message = bgCustomMessages[key].message;
    
    // Handle substitutions
    if (substitutions) {
      const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
      subs.forEach((sub, index) => {
        message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
      });
    }
    
    return message;
  }
  
  // Fall back to messenger i18n
  return messenger.i18n.getMessage(key, substitutions) || key;
}

/**
 * Initialize background i18n from user settings
 */
async function initBgI18n() {
  const { settings = {} } = await messenger.storage.local.get('settings');
  bgCurrentLanguage = settings.language || 'auto';
  await bgLoadMessages(bgCurrentLanguage);
}

// ==================== Context Menus ====================

/**
 * Create or update context menus with current translations
 */
async function setupContextMenus() {
  await messenger.menus.removeAll();
  
  messenger.menus.create({
    id: "add-sender-note",
    title: bgI18n("contextMenuAddNote"),
    contexts: ["message_list"]
  });

  messenger.menus.create({
    id: "manage-all-notes",
    title: bgI18n("toolsMenuManage"),
    contexts: ["tools_menu"]
  });
}

// Listen for settings changes to update menus
messenger.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue || {};
    const newLang = newSettings.language || 'auto';
    
    if (newLang !== bgCurrentLanguage) {
      bgCurrentLanguage = newLang;
      await bgLoadMessages(newLang);
      await setupContextMenus();
    }
  }
});

messenger.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-sender-note") {
    const messageId = info.selectedMessages?.messages?.[0]?.id;
    if (messageId) {
      const message = await messenger.messages.get(messageId);
      const senderEmail = extractEmail(message.author);
      
      console.log("Menu click - sender email:", senderEmail);
      console.log("Menu click - message author:", message.author);
      
      // Check if sender is the user's own account
      const userEmails = await getUserEmailAddresses();
      console.log("User emails:", [...userEmails]);
      
      const isOwnEmail = await isSentByUser(senderEmail);
      console.log("Is own email?", isOwnEmail);
      
      if (isOwnEmail) {
        console.log("Showing own-email warning");
        await messenger.windows.create({
          type: "popup",
          url: "popup/alert.html?titleKey=ownEmailWarningTitle&messageKey=ownEmailWarningMessage&icon=warning",
          width: 420,
          height: 250
        });
        return;
      }
      
      const windowKey = `new-${senderEmail}`;
      const popupUrl = `popup/add-note.html?email=${encodeURIComponent(senderEmail)}&author=${encodeURIComponent(message.author)}`;
      await openOrFocusNoteWindow(windowKey, popupUrl);
    }
  } else if (info.menuItemId === "manage-all-notes") {
    await openManageNotesWindow();
  }
});

// ==================== Window Management ====================

async function openManageNotesWindow(tab = 'notes') {
  if (tab === 'templates') {
    await messenger.tabs.create({
      url: messenger.runtime.getURL('manage/manage-notes.html#templates')
    });
  } else {
    await messenger.runtime.openOptionsPage();
  }
}

async function openOrFocusNoteWindow(windowKey, url) {
  if (openNoteWindows.has(windowKey)) {
    const existingWindowId = openNoteWindows.get(windowKey);
    try {
      const win = await messenger.windows.get(existingWindowId);
      if (win) {
        await messenger.windows.update(existingWindowId, { focused: true });
        return { success: true, focused: true };
      }
    } catch (e) {
      openNoteWindows.delete(windowKey);
    }
  }
  
  const newWindow = await messenger.windows.create({
    type: "popup",
    url: url,
    width: 500,
    height: 500
  });
  
  if (newWindow && newWindow.id) {
    openNoteWindows.set(windowKey, newWindow.id);
  }
  
  return { success: true, created: true };
}

messenger.windows.onRemoved.addListener((windowId) => {
  for (const [key, id] of openNoteWindows.entries()) {
    if (id === windowId) {
      openNoteWindows.delete(key);
      break;
    }
  }
});

// ==================== Message Display Script ====================

async function registerMessageDisplayScript() {
  try {
    await messenger.scripting.messageDisplay.registerScripts([{
      id: "note-banner-script",
      js: ["messageDisplay/note-banner.js"],
      css: ["messageDisplay/note-banner.css"]
    }]);
    console.log("Mail Note: Banner script registered");
  } catch (e) {
    if (!e.message?.includes("already registered")) {
      console.log("Script registration:", e.message);
    }
  }
}

registerMessageDisplayScript();

// ==================== Message Handling ====================

messenger.runtime.onMessage.addListener(async (message, sender) => {
  // Ensure storage is initialized
  const repo = await getStorage();
  
  switch (message.action) {
    case "saveNote":
      return await repo.saveNote({
        id: message.noteId,
        pattern: message.pattern || message.email,
        matchType: message.matchType || 'exact',
        note: message.note,
        originalEmail: message.originalEmail
      });
    
    case "getNote":
      return await repo.findNoteByEmail(message.email);
    
    case "findMatchingNote":
      return await repo.findNoteByEmail(message.email);
    
    case "findAllMatchingNotes":
      return await repo.findNotesByEmail(message.email);
    
    case "checkDuplicatePattern":
      return await repo.checkDuplicate(message.pattern, message.matchType, message.excludeNoteId);
    
    case "deleteNote":
      if (message.noteId) {
        return await repo.deleteNote(message.noteId);
      } else if (message.email) {
        return await repo.deleteNoteByEmail(message.email);
      }
      return { success: false };
    
    case "getAllNotes":
      return await repo.getAllNotes();
    
    case "getNoteById":
      return await repo.getNoteById(message.noteId);
    
    case "getCurrentMessageSender":
      return await getCurrentMessageSender(sender.tab?.id);
    
    case "getTemplates":
      return await repo.getTemplates();
    
    case "getTemplatesAsStrings":
      return await repo.getTemplatesAsStrings();
    
    case "addTemplate":
      return await repo.addTemplate(message.text);
    
    case "initializeTemplates":
      // Initialize templates with translated strings (called from welcome page)
      // First clear any existing templates, then add new ones
      const existingTemplates = await repo.getTemplates();
      // Only initialize if no templates exist (or only defaults)
      if (existingTemplates.length === 0 || existingTemplates.every(t => t.isDefault)) {
        for (const text of message.templates) {
          await repo.addTemplate(text);
        }
        return { success: true, count: message.templates.length };
      }
      return { success: false, reason: 'templates_exist' };
    
    case "updateTemplate":
      return await repo.updateTemplate(message.id, message.text);
    
    case "deleteTemplate":
      return await repo.deleteTemplate(message.id);
    
    case "moveTemplate":
      return await repo.moveTemplate(message.id, message.afterId);
    
    case "validatePattern":
      return repo.validatePattern(message.email, message.pattern, message.matchType);
    
    case "isOwnEmail":
      return { isOwn: await isSentByUser(message.email) };
    
    case "openAddNotePopup":
      // Check if the email is the user's own account
      if (await isSentByUser(message.email)) {
        console.log("openAddNotePopup: Blocking - email is user's own account:", message.email);
        await messenger.windows.create({
          type: "popup",
          url: "popup/alert.html?titleKey=ownEmailWarningTitle&messageKey=ownEmailWarningMessage&icon=warning",
          width: 420,
          height: 250
        });
        return { success: false, error: 'own-email' };
      }
      
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
      return await checkCurrentMessageNote(sender.tab?.id);
    
    case "checkCurrentMessageNotes":
      return await checkCurrentMessageNotes(sender.tab?.id);
    
    case "editNoteFromBanner":
      try {
        const noteData = await repo.getNoteById(message.noteId);
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
      return await refreshBannerForEmail(message.email);
    
    // Settings operations
    case "getSettings":
      return await repo.getSettings();
    
    case "saveSettings":
      return await repo.saveSettings(message.settings);
    
    case "getSetting":
      return await repo.getSetting(message.key, message.defaultValue);
    
    case "setSetting":
      return await repo.setSetting(message.key, message.value);
      
    default:
      return null;
  }
});

// ==================== Banner Injection ====================

async function injectBannerScriptIntoTab(tabId) {
  try {
    await messenger.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["messageDisplay/note-banner.css"]
    });
    
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

async function sendMessageToTabWithInjection(tabId, message) {
  try {
    await messenger.tabs.sendMessage(tabId, message);
    return true;
  } catch (e) {
    console.log("Script not loaded, injecting...");
    const injected = await injectBannerScriptIntoTab(tabId);
    
    if (injected) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
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

async function refreshBannerForEmail(email) {
  const repo = await getStorage();
  
  try {
    const tabs = await messenger.tabs.query({});
    
    for (const tab of tabs) {
      try {
        if (messenger.messageDisplay && messenger.messageDisplay.getDisplayedMessages) {
          const messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
          const messages = messageList?.messages || [];
          
          for (const message of messages) {
            const msgEmail = extractEmail(message.author);
            
            const matchingNotes = await repo.findNotesByEmail(msgEmail);
            
            if (matchingNotes && matchingNotes.length > 0) {
              await sendMessageToTabWithInjection(tab.id, {
                action: "showNoteBanners",
                notes: matchingNotes,
                senderEmail: msgEmail
              });
            } else if (msgEmail.toLowerCase() === email.toLowerCase()) {
              try {
                await messenger.tabs.sendMessage(tab.id, {
                  action: "hideNoteBanner"
                });
              } catch (e) {
                // Tab might not have the script yet
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

// ==================== Helper Functions ====================

function extractEmail(author) {
  const match = author.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return author.toLowerCase().trim();
}

// ==================== User Email Cache ====================

// Cache of user's email addresses (to avoid repeated API calls)
let userEmailsCache = null;

/**
 * Get all email addresses belonging to the user's accounts (cached)
 * @returns {Promise<Set<string>>} Set of user's email addresses (lowercase)
 */
async function getUserEmailAddresses() {
  // Return cached value if available
  if (userEmailsCache) {
    return userEmailsCache;
  }
  
  userEmailsCache = new Set();
  
  try {
    const accounts = await messenger.accounts.list();
    
    for (const account of accounts) {
      // Each account can have multiple identities (email addresses)
      if (account.identities) {
        for (const identity of account.identities) {
          if (identity.email) {
            userEmailsCache.add(identity.email.toLowerCase());
          }
        }
      }
    }
    
    console.log("Mail Note: Cached", userEmailsCache.size, "user email addresses");
  } catch (e) {
    console.error("Error getting user email addresses:", e);
  }
  
  return userEmailsCache;
}

/**
 * Refresh the user emails cache (call when accounts change)
 */
function refreshUserEmailsCache() {
  userEmailsCache = null;
}

// Listen for account changes to refresh cache
if (messenger.accounts.onCreated) {
  messenger.accounts.onCreated.addListener(refreshUserEmailsCache);
}
if (messenger.accounts.onDeleted) {
  messenger.accounts.onDeleted.addListener(refreshUserEmailsCache);
}
if (messenger.accounts.onUpdated) {
  messenger.accounts.onUpdated.addListener(refreshUserEmailsCache);
}

/**
 * Check if a message was sent by the user (sender is one of user's accounts)
 * @param {string} senderEmail - The sender's email address
 * @returns {Promise<boolean>} True if the message was sent by the user
 */
async function isSentByUser(senderEmail) {
  if (!senderEmail) return false;
  
  const userEmails = await getUserEmailAddresses();
  return userEmails.has(senderEmail.toLowerCase());
}

async function getCurrentMessageSender(tabId) {
  try {
    console.log("getCurrentMessageSender called with tabId:", tabId);
    
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
              
              const senderEmail = extractEmail(message.author);
              
              // Skip messages sent by the user - only process received messages
              if (await isSentByUser(senderEmail)) {
                console.log("Skipping message sent by user:", senderEmail);
                return null;
              }
              
              return {
                email: senderEmail,
                author: message.author
              };
            }
          } catch (e) {
            // Tab doesn't support message display
          }
        }
      } catch (e) {
        console.log("messageDisplay.getDisplayedMessages failed:", e.message);
      }
    }
    
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
              
              const senderEmail = extractEmail(message.author);
              
              // Skip messages sent by the user - only process received messages
              if (await isSentByUser(senderEmail)) {
                console.log("Skipping message sent by user:", senderEmail);
                return null;
              }
              
              return {
                email: senderEmail,
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

async function checkCurrentMessageNote(tabId) {
  const repo = await getStorage();
  
  try {
    console.log("checkCurrentMessageNote called for tabId:", tabId);
    
    const sender = await getCurrentMessageSender(tabId);
    
    if (!sender || !sender.email) {
      console.log("checkCurrentMessageNote: No sender found");
      return { hasNote: false };
    }
    
    console.log("checkCurrentMessageNote: Checking note for", sender.email);
    
    const matchingNote = await repo.findNoteByEmail(sender.email);
    
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

async function checkCurrentMessageNotes(tabId) {
  const repo = await getStorage();
  
  try {
    console.log("checkCurrentMessageNotes called for tabId:", tabId);
    
    const sender = await getCurrentMessageSender(tabId);
    
    if (!sender || !sender.email) {
      console.log("checkCurrentMessageNotes: No sender found");
      return { hasNotes: false, notes: [] };
    }
    
    console.log("checkCurrentMessageNotes: Checking notes for", sender.email);
    
    const matchingNotes = await repo.findNotesByEmail(sender.email);
    
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

// ==================== Initialization ====================

// Initialize storage and i18n on script load
(async function initialize() {
  try {
    await initializeStorage();
    await initBgI18n();
    await setupContextMenus();
    console.log("Mail Note background script loaded with IndexedDB storage");
  } catch (e) {
    console.error("Failed to initialize:", e);
  }
})();
