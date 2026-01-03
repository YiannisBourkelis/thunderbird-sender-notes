// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const senderEmail = urlParams.get('email');
const senderAuthor = urlParams.get('author');
const noteIdParam = urlParams.get('noteId');

// DOM elements
const senderEmailSpan = document.getElementById('sender-email');
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
const templateModal = document.getElementById('template-modal');
const templateList = document.getElementById('template-list');
const newTemplateInput = document.getElementById('new-template');
const addTemplateBtn = document.getElementById('add-template-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const noteDatesDiv = document.getElementById('note-dates');
const dateCreatedSpan = document.getElementById('date-created');
const dateUpdatedSpan = document.getElementById('date-updated');

let templates = [];
let existingNoteId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  senderEmailSpan.textContent = senderEmail;
  
  // Set default pattern to the full email
  matchPatternInput.value = senderEmail;
  
  // Load templates
  await loadTemplates();
  
  // Load existing note - by ID if provided, otherwise find matching
  let existingNote = null;
  
  if (noteIdParam) {
    // Load specific note by ID
    const allNotes = await messenger.runtime.sendMessage({ action: 'getAllNotes' });
    if (allNotes && allNotes[noteIdParam]) {
      existingNote = { ...allNotes[noteIdParam], id: noteIdParam };
    }
  } else {
    // Find first matching note
    existingNote = await messenger.runtime.sendMessage({
      action: 'findMatchingNote',
      email: senderEmail
    });
  }
  
  if (existingNote) {
    matchTypeSelect.value = existingNote.matchType;
    matchPatternInput.value = existingNote.pattern;
    noteTextarea.value = existingNote.note;
    existingNoteId = existingNote.id;
    deleteBtn.style.display = 'inline-block';
    
    // Display dates
    if (existingNote.createdAt || existingNote.updatedAt) {
      noteDatesDiv.style.display = 'block';
      if (existingNote.createdAt) {
        dateCreatedSpan.textContent = `Created: ${formatDateTime(existingNote.createdAt)}`;
      }
      if (existingNote.updatedAt) {
        dateUpdatedSpan.textContent = `Updated: ${formatDateTime(existingNote.updatedAt)}`;
      }
    }
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

// Update match preview
async function updateMatchPreview() {
  const matchType = matchTypeSelect.value;
  const pattern = matchPatternInput.value.trim();
  
  if (!pattern) {
    matchPreview.innerHTML = '<span class="preview-error">⚠️ Pattern cannot be empty</span>';
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
      matchPreview.innerHTML = `<span class="preview-error">⚠️ A note with this exact pattern and match type already exists. Please edit the existing note instead.</span>`;
      return;
    }
    
    let description = '';
    switch (matchType) {
      case 'exact':
        description = `Will match only: <strong>${pattern}</strong>`;
        break;
      case 'startsWith':
        description = `Will match emails starting with: <strong>${pattern}</strong>*`;
        break;
      case 'endsWith':
        description = `Will match emails ending with: *<strong>${pattern}</strong>`;
        break;
      case 'contains':
        description = `Will match emails containing: *<strong>${pattern}</strong>*`;
        break;
    }
    matchPreview.innerHTML = `<span class="preview-valid">✓ ${description}</span>`;
  } else {
    matchPreview.innerHTML = `<span class="preview-error">✗ Pattern "${pattern}" does not match current sender "${senderEmail}"</span>`;
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
    const displayText = template.length > 40 ? template.substring(0, 40) + '...' : template;
    tag.textContent = displayText;
    tag.title = template;
    tag.addEventListener('click', () => {
      insertAtCursor(noteTextarea, template);
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
    item.textContent = template;
    item.title = template;
    item.addEventListener('click', () => {
      insertAtCursor(noteTextarea, template);
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
  manageItem.addEventListener('click', () => {
    quickNoteDropdown.classList.remove('show');
    openManageModal();
  });
  quickNoteDropdown.appendChild(manageItem);
}

// Open manage modal
function openManageModal() {
  renderTemplateList();
  templateModal.style.display = 'flex';
}

// Render template list in modal
function renderTemplateList() {
  templateList.innerHTML = '';
  
  templates.forEach((template, index) => {
    const li = document.createElement('li');
    li.className = 'template-item';
    
    const text = document.createElement('span');
    text.className = 'template-text';
    text.textContent = template;
    text.title = template;
    
    const delBtn = document.createElement('button');
    delBtn.className = 'template-delete';
    delBtn.textContent = '×';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', async () => {
      await messenger.runtime.sendMessage({ action: 'deleteTemplate', index });
      await loadTemplates();
      renderTemplateList();
    });
    
    li.appendChild(text);
    li.appendChild(delBtn);
    templateList.appendChild(li);
  });
}

// Save note
saveBtn.addEventListener('click', async () => {
  const matchType = matchTypeSelect.value;
  const pattern = matchPatternInput.value.trim();
  const note = noteTextarea.value.trim();
  
  // Validation
  if (!pattern) {
    showStatus('Pattern cannot be empty.', 'error');
    return;
  }
  
  if (!note) {
    showStatus('Note cannot be empty.', 'error');
    return;
  }
  
  if (!validatePattern(senderEmail, pattern, matchType)) {
    showStatus(`Pattern "${pattern}" does not match the current sender email.`, 'error');
    return;
  }
  
  try {
    const result = await messenger.runtime.sendMessage({
      action: 'saveNote',
      noteId: existingNoteId,
      pattern: pattern,
      matchType: matchType,
      note: note
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
    
    showStatus('Note saved successfully!', 'success');
    setTimeout(() => window.close(), 1000);
  } catch (error) {
    showStatus('Error saving note: ' + error.message, 'error');
  }
});

// Delete note
deleteBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete this note?')) {
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
      
      showStatus('Note deleted!', 'success');
      setTimeout(() => window.close(), 1000);
    } catch (error) {
      showStatus('Error deleting note: ' + error.message, 'error');
    }
  }
});

// Cancel
cancelBtn.addEventListener('click', () => {
  window.close();
});

// Close modal
closeModalBtn.addEventListener('click', () => {
  templateModal.style.display = 'none';
});

// Add new template
addTemplateBtn.addEventListener('click', async () => {
  const newTemplate = newTemplateInput.value.trim();
  if (newTemplate) {
    await messenger.runtime.sendMessage({ action: 'addTemplate', template: newTemplate });
    newTemplateInput.value = '';
    await loadTemplates();
    renderTemplateList();
  }
});

newTemplateInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTemplateBtn.click();
  }
});

// Close modal on outside click
templateModal.addEventListener('click', (e) => {
  if (e.target === templateModal) {
    templateModal.style.display = 'none';
  }
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
