// Uses i18n() from shared/i18n.js

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const senderEmail = urlParams.get('email');
const senderAuthor = urlParams.get('author');
const noteIdParam = urlParams.get('noteId');

// DOM elements
const senderInfoNew = document.getElementById('sender-info-new');
const senderInfoEdit = document.getElementById('sender-info-edit');
const senderEmailNewSpan = document.getElementById('sender-email-new');
const senderEmailEditSpan = document.getElementById('sender-email-edit');
const matchTypeSelect = document.getElementById('match-type');
const matchPatternInput = document.getElementById('match-pattern');
const matchPreview = document.getElementById('match-preview');
const noteTextarea = document.getElementById('note-text');
const quickNotesTagsContainer = document.getElementById('quick-notes-tags');
const quickNoteDropdownBtn = document.getElementById('quick-note-dropdown-btn');
const quickNoteDropdown = document.getElementById('quick-note-dropdown');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const cancelBtn = document.getElementById('cancel-btn');
const statusMessage = document.getElementById('status-message');
const noteDatesDiv = document.getElementById('note-dates');
const dateCreatedSpan = document.getElementById('date-created');
const dateUpdatedSpan = document.getElementById('date-updated');

let templates = [];
let existingNoteId = null;
let originalEmailForNote = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for i18n to load custom messages
  await i18nReady;
  
  // Set default pattern to the full email
  matchPatternInput.value = senderEmail;
  
  // Load templates
  await loadTemplates();
  
  // Load existing note - only by ID if provided
  let existingNote = null;
  
  if (noteIdParam) {
    // Load specific note by ID (convert string param to number)
    const noteId = parseInt(noteIdParam, 10);
    existingNote = await messenger.runtime.sendMessage({ action: 'getNoteById', noteId });
  }
  
  if (existingNote) {
    // Editing an existing note - show original sender info
    matchTypeSelect.value = existingNote.matchType;
    matchPatternInput.value = existingNote.pattern;
    noteTextarea.value = existingNote.note;
    existingNoteId = existingNote.id;
    originalEmailForNote = existingNote.originalEmail;
    deleteBtn.style.display = 'inline-block';
    
    // Show the original email (or pattern if originalEmail not set)
    const displayEmail = existingNote.originalEmail || existingNote.pattern;
    senderInfoNew.style.display = 'none';
    senderInfoEdit.style.display = 'flex';
    senderEmailEditSpan.textContent = displayEmail;
    
    // Display dates
    if (existingNote.createdAt || existingNote.updatedAt) {
      noteDatesDiv.style.display = 'block';
      if (existingNote.createdAt) {
        dateCreatedSpan.textContent = `${i18n('created')} ${formatDateTime(existingNote.createdAt)}`;
      }
      if (existingNote.updatedAt) {
        dateUpdatedSpan.textContent = `${i18n('updated')} ${formatDateTime(existingNote.updatedAt)}`;
      }
    }
  } else {
    // Creating a new note - show current sender
    senderInfoNew.style.display = 'flex';
    senderInfoEdit.style.display = 'none';
    senderEmailNewSpan.textContent = senderEmail;
    originalEmailForNote = senderEmail;
  }
  
  // Update preview initially
  updateMatchPreview();
  
  // Setup event listeners
  matchTypeSelect.addEventListener('change', () => {
    updateMatchPreview();
    suggestPattern();
  });
  
  matchPatternInput.addEventListener('input', updateMatchPreview);
  
  // Setup dropdown toggle
  quickNoteDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    quickNoteDropdown.classList.toggle('show');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    quickNoteDropdown.classList.remove('show');
  });
  
  noteTextarea.focus();
});

// Format date/time for display
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Suggest pattern based on match type
function suggestPattern() {
  const matchType = matchTypeSelect.value;
  
  switch (matchType) {
    case 'exact':
      matchPatternInput.value = senderEmail;
      break;
    case 'startsWith':
      // Suggest the local part (before @)
      const localPart = senderEmail.split('@')[0];
      matchPatternInput.value = localPart;
      break;
    case 'endsWith':
      // Suggest the domain
      const domain = '@' + senderEmail.split('@')[1];
      matchPatternInput.value = domain;
      break;
    case 'contains':
      // Suggest the domain name without TLD
      const domainPart = senderEmail.split('@')[1]?.split('.')[0] || '';
      matchPatternInput.value = domainPart;
      break;
  }
  
  updateMatchPreview();
}

// Validate if pattern matches email
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

// Helper to set preview content safely
function setPreviewContent(className, icon, text, boldText = null, suffix = '') {
  matchPreview.textContent = '';
  const span = document.createElement('span');
  span.className = className;
  span.textContent = icon + ' ' + text;
  if (boldText) {
    const strong = document.createElement('strong');
    strong.textContent = boldText;
    span.appendChild(strong);
    if (suffix) {
      span.appendChild(document.createTextNode(suffix));
    }
  }
  matchPreview.appendChild(span);
}

// Update match preview
async function updateMatchPreview() {
  const matchType = matchTypeSelect.value;
  const pattern = matchPatternInput.value.trim();
  
  if (!pattern) {
    setPreviewContent('preview-error', '⚠️', i18n('emptyPattern') || 'Pattern cannot be empty');
    return;
  }
  
  const isValid = validatePattern(senderEmail, pattern, matchType);
  
  if (isValid) {
    // Check for duplicate pattern
    const duplicate = await messenger.runtime.sendMessage({
      action: 'checkDuplicatePattern',
      pattern: pattern,
      matchType: matchType,
      excludeNoteId: existingNoteId
    });
    
    if (duplicate && duplicate.exists) {
      setPreviewContent('preview-error', '⚠️', i18n('duplicatePattern'));
      return;
    }
    
    let prefix = '';
    let suffix = '';
    switch (matchType) {
      case 'exact':
        prefix = i18n('willMatchOnly') + ' ';
        break;
      case 'startsWith':
        prefix = i18n('willMatchStarting') + ' ';
        suffix = '*';
        break;
      case 'endsWith':
        prefix = i18n('willMatchEnding') + ' *';
        break;
      case 'contains':
        prefix = i18n('willMatchContaining') + ' *';
        suffix = '*';
        break;
    }
    setPreviewContent('preview-valid', '✓', prefix, pattern, suffix);
  } else {
    setPreviewContent('preview-error', '✗', i18n('patternNoMatch'));
  }
}

// Load and render quick note templates
async function loadTemplates() {
  templates = await messenger.runtime.sendMessage({ action: 'getTemplates' });
  renderQuickNotesTags();
  renderDropdown();
}

// Render horizontal scrolling tag cloud
function renderQuickNotesTags() {
  quickNotesTagsContainer.innerHTML = '';
  
  if (templates.length === 0) {
    quickNotesTagsContainer.innerHTML = '<span class="no-templates">No quick notes available</span>';
    return;
  }
  
  templates.forEach((template, index) => {
    const tag = document.createElement('button');
    tag.className = 'quick-note-tag';
    const text = template.text;
    const displayText = text.length > 40 ? text.substring(0, 40) + '...' : text;
    tag.textContent = displayText;
    tag.title = text;
    tag.addEventListener('click', () => {
      insertAtCursor(noteTextarea, text);
    });
    quickNotesTagsContainer.appendChild(tag);
  });
}

// Insert text at cursor position in textarea
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  
  textarea.value = before + text + after;
  
  // Move cursor to end of inserted text
  const newPosition = start + text.length;
  textarea.setSelectionRange(newPosition, newPosition);
  textarea.focus();
}

// Render dropdown menu
function renderDropdown() {
  quickNoteDropdown.innerHTML = '';
  
  templates.forEach((template, index) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    const text = template.text;
    item.textContent = text;
    item.title = text;
    item.addEventListener('click', () => {
      insertAtCursor(noteTextarea, text);
      quickNoteDropdown.classList.remove('show');
    });
    quickNoteDropdown.appendChild(item);
  });
  
  if (templates.length > 0) {
    const separator = document.createElement('div');
    separator.className = 'dropdown-separator';
    quickNoteDropdown.appendChild(separator);
  }
  
  const manageItem = document.createElement('div');
  manageItem.className = 'dropdown-item manage-item';
  manageItem.innerHTML = '⚙️ Manage Quick Notes';
  manageItem.addEventListener('click', async () => {
    quickNoteDropdown.classList.remove('show');
    // Open the settings page (templates tab)
    await messenger.runtime.sendMessage({ action: 'openManageNotesTemplates' });
  });
  quickNoteDropdown.appendChild(manageItem);
}

// Save note
saveBtn.addEventListener('click', async () => {
  const matchType = matchTypeSelect.value;
  const pattern = matchPatternInput.value.trim();
  const note = noteTextarea.value.trim();
  
  // Validation
  if (!pattern) {
    showStatus(i18n('emptyPattern'), 'error');
    return;
  }
  
  if (!note) {
    showStatus(i18n('emptyNote'), 'error');
    return;
  }
  
  if (!validatePattern(senderEmail, pattern, matchType)) {
    showStatus(i18n('patternNoMatch'), 'error');
    return;
  }
  
  try {
    const result = await messenger.runtime.sendMessage({
      action: 'saveNote',
      noteId: existingNoteId,
      pattern: pattern,
      matchType: matchType,
      note: note,
      originalEmail: originalEmailForNote
    });
    
    // Check if save was successful
    if (result && result.success === false) {
      if (result.error === 'duplicate') {
        showStatus(result.message, 'error');
        return;
      }
      showStatus('Error saving note: ' + (result.message || 'Unknown error'), 'error');
      return;
    }
    
    // Refresh the banner in any open message tabs
    await messenger.runtime.sendMessage({
      action: 'refreshBanner',
      email: senderEmail
    });
    
    showStatus(i18n('noteSaved'), 'success');
    setTimeout(() => window.close(), 400);
  } catch (error) {
    showStatus('Error saving note: ' + error.message, 'error');
  }
});

// Delete note
deleteBtn.addEventListener('click', async () => {
  if (confirm(i18n('confirmDelete'))) {
    try {
      await messenger.runtime.sendMessage({
        action: 'deleteNote',
        noteId: existingNoteId
      });
      
      // Refresh the banner in any open message tabs (will hide it)
      await messenger.runtime.sendMessage({
        action: 'refreshBanner',
        email: senderEmail
      });
      
      showStatus(i18n('noteDeleted'), 'success');
      setTimeout(() => window.close(), 400);
    } catch (error) {
      showStatus('Error deleting note: ' + error.message, 'error');
    }
  }
});

// Cancel
cancelBtn.addEventListener('click', () => {
  window.close();
});

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';
  
  if (type === 'error') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }
}

// Listen for storage changes to refresh templates
function onStorageChanged(changes, areaName) {
  if (areaName === 'local' && changes.templates) {
    loadTemplates();
  }
}

messenger.storage.onChanged.addListener(onStorageChanged);

// Clean up listener when popup closes
window.addEventListener('beforeunload', () => {
  messenger.storage.onChanged.removeListener(onStorageChanged);
});
