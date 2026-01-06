// Uses i18n() from shared/i18n.js

// DOM elements - Notes tab
const searchInput = document.getElementById('search-input');
const notesCount = document.getElementById('notes-count');
const notesTableContainer = document.getElementById('notes-table-container');
const notesTbody = document.getElementById('notes-tbody');
const noNotesDiv = document.getElementById('no-notes');
const statusMessage = document.getElementById('status-message');

// DOM elements - Templates tab
const templatesCount = document.getElementById('templates-count');
const templatesList = document.getElementById('templates-list');
const noTemplatesDiv = document.getElementById('no-templates');
const newTemplateInput = document.getElementById('new-template-input');
const addTemplateBtn = document.getElementById('add-template-btn');

// DOM elements - Settings tab
const languageSelect = document.getElementById('language-select');

let allNotes = [];
let allTemplates = [];
let sortColumn = 'updatedAt';
let sortDirection = 'desc';

// Load settings from storage
async function loadSettings() {
  const { settings = {} } = await messenger.storage.local.get('settings');
  if (languageSelect) {
    languageSelect.value = settings.language || 'auto';
  }
}

// Save settings to storage and reload to apply language
async function saveSettings() {
  const settings = {
    language: languageSelect ? languageSelect.value : 'auto'
  };
  await messenger.storage.local.set({ settings });
  // Reload page to apply new language
  window.location.reload();
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Get match type badge class
function getMatchTypeBadgeClass(matchType) {
  return `match-type-badge match-type-${matchType}`;
}

// Get match type display name
function getMatchTypeDisplay(matchType) {
  const keys = {
    'exact': 'matchTypeExact',
    'startsWith': 'matchTypeStartsWith',
    'endsWith': 'matchTypeEndsWith',
    'contains': 'matchTypeContains'
  };
  const translated = i18n(keys[matchType]);
  // Fallback to English names if translation fails
  if (translated === keys[matchType]) {
    const names = {
      'exact': 'Exact',
      'startsWith': 'Starts With',
      'endsWith': 'Ends With',
      'contains': 'Contains'
    };
    return names[matchType] || matchType;
  }
  return translated;
}

// Load all notes
async function loadNotes() {
  try {
    const notesData = await messenger.runtime.sendMessage({ action: 'getAllNotes' });
    
    // Convert object to array with IDs
    allNotes = Object.entries(notesData || {}).map(([id, note]) => ({
      id,
      ...note
    }));
    
    renderNotes();
  } catch (error) {
    console.error('Error loading notes:', error);
    showStatus('Error loading notes: ' + error.message, 'error');
  }
}

// Filter notes based on search
function filterNotes(notes) {
  const searchTerm = searchInput.value.toLowerCase().trim();
  if (!searchTerm) return notes;
  
  return notes.filter(note => 
    note.pattern.toLowerCase().includes(searchTerm) ||
    note.note.toLowerCase().includes(searchTerm) ||
    note.matchType.toLowerCase().includes(searchTerm)
  );
}

// Sort notes
function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    
    // Handle dates
    if (sortColumn === 'createdAt' || sortColumn === 'updatedAt') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

// Render notes table
function renderNotes() {
  const filteredNotes = filterNotes(allNotes);
  const sortedNotes = sortNotes(filteredNotes);
  
  // Update count
  if (allNotes.length === 0) {
    notesCount.textContent = '';
  } else if (filteredNotes.length === allNotes.length) {
    if (allNotes.length === 1) {
      notesCount.textContent = i18n('noteCountSingular');
    } else {
      notesCount.textContent = i18n('noteCount', [allNotes.length.toString()]);
    }
  } else {
    notesCount.textContent = i18n('noteCountFiltered', [filteredNotes.length.toString(), allNotes.length.toString()]);
  }
  
  // Show/hide table vs empty state
  if (allNotes.length === 0) {
    notesTableContainer.style.display = 'none';
    noNotesDiv.style.display = 'block';
    return;
  }
  
  notesTableContainer.style.display = 'block';
  noNotesDiv.style.display = 'none';
  
  // Update sort indicators
  document.querySelectorAll('.notes-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
  
  // Render rows
  notesTbody.innerHTML = '';
  
  if (sortedNotes.length === 0) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.textAlign = 'center';
    td.style.color = '#737373';
    td.style.padding = '20px';
    td.textContent = 'No notes match your search.';
    row.appendChild(td);
    notesTbody.appendChild(row);
    return;
  }
  
  sortedNotes.forEach(note => {
    const row = document.createElement('tr');
    row.dataset.noteId = note.id;
    
    // Pattern cell
    const patternTd = document.createElement('td');
    const patternSpan = document.createElement('span');
    patternSpan.className = 'note-pattern';
    patternSpan.textContent = note.pattern;
    patternTd.appendChild(patternSpan);
    row.appendChild(patternTd);
    
    // Match type cell
    const matchTypeTd = document.createElement('td');
    const matchTypeSpan = document.createElement('span');
    matchTypeSpan.className = getMatchTypeBadgeClass(note.matchType);
    matchTypeSpan.textContent = getMatchTypeDisplay(note.matchType);
    matchTypeTd.appendChild(matchTypeSpan);
    row.appendChild(matchTypeTd);
    
    // Note preview cell
    const noteTd = document.createElement('td');
    const noteDiv = document.createElement('div');
    noteDiv.className = 'note-preview';
    noteDiv.title = note.note;
    noteDiv.textContent = note.note;
    noteTd.appendChild(noteDiv);
    row.appendChild(noteTd);
    
    // Created date cell
    const createdTd = document.createElement('td');
    createdTd.className = 'date-cell';
    createdTd.textContent = formatDate(note.createdAt);
    row.appendChild(createdTd);
    
    // Updated date cell
    const updatedTd = document.createElement('td');
    updatedTd.className = 'date-cell';
    updatedTd.textContent = formatDate(note.updatedAt);
    row.appendChild(updatedTd);
    
    // Action buttons cell
    const actionsTd = document.createElement('td');
    actionsTd.className = 'action-buttons';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small primary edit-btn';
    editBtn.textContent = i18n('edit');
    editBtn.addEventListener('click', () => editNote(note));
    actionsTd.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small danger delete-btn';
    deleteBtn.textContent = i18n('delete');
    deleteBtn.addEventListener('click', () => deleteNote(note));
    actionsTd.appendChild(deleteBtn);
    
    row.appendChild(actionsTd);
    
    notesTbody.appendChild(row);
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Edit note
async function editNote(note) {
  try {
    const result = await messenger.runtime.sendMessage({
      action: 'openAddNotePopup',
      email: note.pattern,
      author: note.pattern,
      noteId: note.id
    });
    
    if (result && result.success) {
      // Reload notes after a short delay to allow edit window to save
      setTimeout(loadNotes, 500);
    }
  } catch (error) {
    console.error('Error opening edit popup:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Delete note
async function deleteNote(note) {
  if (!confirm(i18n('confirmDelete'))) {
    return;
  }
  
  try {
    await messenger.runtime.sendMessage({
      action: 'deleteNote',
      noteId: note.id
    });
    
    // Refresh banner in message display
    await messenger.runtime.sendMessage({
      action: 'refreshBanner',
      email: note.pattern
    });
    
    showStatus(i18n('noteDeleted'), 'success');
    
    // Reload notes
    await loadNotes();
    
    // Hide status after a moment
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('Error deleting note:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  
  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
      statusMessage.className = 'status-message';
    }, 2000);
  }
}

// =============== TEMPLATES MANAGEMENT ===============

// Load all templates
async function loadTemplates() {
  try {
    allTemplates = await messenger.runtime.sendMessage({ action: 'getTemplates' }) || [];
    renderTemplates();
  } catch (error) {
    console.error('Error loading templates:', error);
    showStatus('Error loading templates: ' + error.message, 'error');
  }
}

// Render templates list
function renderTemplates() {
  // Update count
  if (allTemplates.length === 1) {
    templatesCount.textContent = i18n('templateCountSingular');
  } else {
    templatesCount.textContent = i18n('templateCount', [allTemplates.length.toString()]);
  }
  
  // Show/hide empty state
  if (allTemplates.length === 0) {
    templatesList.style.display = 'none';
    noTemplatesDiv.style.display = 'block';
    return;
  }
  
  templatesList.style.display = 'flex';
  noTemplatesDiv.style.display = 'none';
  
  templatesList.innerHTML = '';
  
  allTemplates.forEach((template, index) => {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.dataset.index = index;
    if (template.id) {
      item.dataset.id = template.id;
    }
    item.draggable = true;
    
    // Drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '⠿';
    dragHandle.title = 'Drag to reorder';
    
    const text = document.createElement('div');
    text.className = 'template-text';
    text.textContent = template.text;
    
    const actions = document.createElement('div');
    actions.className = 'template-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small primary';
    editBtn.textContent = i18n('edit');
    editBtn.addEventListener('click', () => startEditTemplate(template, item));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small danger';
    deleteBtn.textContent = i18n('delete');
    deleteBtn.addEventListener('click', () => deleteTemplate(template));
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(dragHandle);
    item.appendChild(text);
    item.appendChild(actions);
    templatesList.appendChild(item);
    
    // Drag events
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
  });
}

// Drag and drop state
let draggedItem = null;
let draggedIndex = null;

function handleDragStart(e) {
  draggedItem = this;
  draggedIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.template-item').forEach(item => {
    item.classList.remove('drag-over');
  });
  draggedItem = null;
  draggedIndex = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this !== draggedItem) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  
  const targetIndex = parseInt(this.dataset.index);
  
  if (draggedIndex !== null && draggedIndex !== targetIndex) {
    const movedTemplate = allTemplates[draggedIndex];
    
    // Check if we're working with unsaved defaults
    if (movedTemplate.isDefault) {
      // Convert defaults to saved templates - save them all with addTemplate
      for (let i = 0; i < allTemplates.length; i++) {
        const t = allTemplates[i];
        if (t.isDefault) {
          await messenger.runtime.sendMessage({
            action: 'addTemplate',
            text: t.text
          });
        }
      }
      // Reload to get real IDs, then call handleDrop logic again
      await loadTemplates();
      // Now reorder with real IDs - find the template by matching text
      const freshTemplates = allTemplates;
      const movedText = movedTemplate.text;
      const movedFresh = freshTemplates.find(t => t.text === movedText);
      if (movedFresh) {
        const afterId = targetIndex === 0 ? null : freshTemplates[targetIndex - 1]?.id || null;
        await messenger.runtime.sendMessage({
          action: 'moveTemplate',
          id: movedFresh.id,
          afterId: afterId
        });
        await loadTemplates();
      }
      showStatus(i18n('templateOrderUpdated'), 'success');
      return;
    }
    
    // Calculate afterId based on drop position
    // When dropping ON an item, we want to insert at that position
    // afterId is the ID of the item that should be directly BEFORE us after the move
    let afterId;
    if (targetIndex === 0) {
      // Moving to first position
      afterId = null;
    } else if (draggedIndex < targetIndex) {
      // Dragging DOWN: after we remove the dragged item, target shifts up by 1
      // So we want to be after the item currently AT targetIndex
      afterId = allTemplates[targetIndex].id;
    } else {
      // Dragging UP: positions don't shift, we want to be after item at targetIndex-1
      afterId = allTemplates[targetIndex - 1].id;
    }
    
    await messenger.runtime.sendMessage({
      action: 'moveTemplate',
      id: movedTemplate.id,
      afterId: afterId
    });
    
    // Reload to get fresh data
    await loadTemplates();
    showStatus(i18n('templateOrderUpdated'), 'success');
  }
}

// Start editing a template
function startEditTemplate(template, itemElement) {
  const currentText = template.text;
  itemElement.classList.add('editing');
  itemElement.innerHTML = '';
  
  const textarea = document.createElement('textarea');
  textarea.className = 'template-edit-input';
  textarea.value = currentText;
  textarea.rows = 2;
  
  const actions = document.createElement('div');
  actions.className = 'template-actions';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-small primary';
  saveBtn.textContent = i18n('save');
  saveBtn.addEventListener('click', () => saveEditTemplate(template, textarea.value));
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-small';
  cancelBtn.textContent = i18n('cancel');
  cancelBtn.style.background = '#6c757d';
  cancelBtn.style.color = 'white';
  cancelBtn.addEventListener('click', () => renderTemplates());
  
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  itemElement.appendChild(textarea);
  itemElement.appendChild(actions);
  
  textarea.focus();
}

// Save edited template
async function saveEditTemplate(template, newText) {
  const text = newText.trim();
  if (!text) {
    showStatus(i18n('templateEmpty'), 'error');
    return;
  }
  
  try {
    // Check if this is a default (unsaved) template
    if (template.isDefault) {
      // Need to save as new template first
      await messenger.runtime.sendMessage({
        action: 'addTemplate',
        text: text
      });
    } else {
      await messenger.runtime.sendMessage({
        action: 'updateTemplate',
        id: template.id,
        text: text
      });
    }
    
    showStatus(i18n('templateUpdated'), 'success');
    await loadTemplates();
  } catch (error) {
    console.error('Error updating template:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Add new template
async function addTemplate() {
  const text = newTemplateInput.value.trim();
  if (!text) {
    showStatus(i18n('templateEmpty'), 'error');
    return;
  }
  
  try {
    await messenger.runtime.sendMessage({
      action: 'addTemplate',
      text: text
    });
    
    newTemplateInput.value = '';
    showStatus(i18n('templateAdded'), 'success');
    await loadTemplates();
  } catch (error) {
    console.error('Error adding template:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Delete template
async function deleteTemplate(template) {
  if (!confirm(i18n('confirmDelete'))) {
    return;
  }
  
  try {
    // Check if this is a default (unsaved) template
    if (template.isDefault) {
      // For default templates, save all EXCEPT the one being deleted
      const remaining = allTemplates.filter(t => t !== template);
      for (const t of remaining) {
        if (t.isDefault) {
          await messenger.runtime.sendMessage({
            action: 'addTemplate',
            text: t.text
          });
        }
      }
    } else {
      await messenger.runtime.sendMessage({
        action: 'deleteTemplate',
        id: template.id
      });
    }
    
    showStatus(i18n('templateDeleted'), 'success');
    await loadTemplates();
  } catch (error) {
    console.error('Error deleting template:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// =============== TAB SWITCHING ===============

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// =============== INITIALIZATION ===============

// Initialize - wait for i18n to be ready first
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for i18n to load custom messages
  await i18nReady;
  
  // Load version from manifest
  const manifest = messenger.runtime.getManifest();
  const versionEl = document.getElementById('about-version');
  if (versionEl && manifest.version) {
    versionEl.textContent = `v${manifest.version}`;
  }
  
  // Load notes
  loadNotes();
  
  // Load templates
  loadTemplates();
  
  // Check for hash to switch tab
  if (window.location.hash === '#templates') {
    switchTab('templates');
  } else if (window.location.hash === '#about') {
    switchTab('about');
  }
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
  
  // Search handler
  searchInput.addEventListener('input', () => {
    renderNotes();
  });
  
  // Sort handlers
  document.querySelectorAll('.notes-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }
      renderNotes();
    });
  });
  
  // Add template handlers
  addTemplateBtn.addEventListener('click', addTemplate);
  newTemplateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTemplate();
    }
  });
  
  // Settings handlers
  if (languageSelect) {
    loadSettings();
    languageSelect.addEventListener('change', saveSettings);
  }
});

// Listen for notes/templates changes from background script
messenger.runtime.onMessage.addListener((message) => {
  if (message.action === 'notesChanged') {
    loadNotes();
  } else if (message.action === 'templatesChanged') {
    loadTemplates();
  }
});
