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

let allNotes = [];
let allTemplates = [];
let sortColumn = 'updatedAt';
let sortDirection = 'desc';

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
  const names = {
    'exact': 'Exact',
    'startsWith': 'Starts With',
    'endsWith': 'Ends With',
    'contains': 'Contains'
  };
  return names[matchType] || matchType;
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
    notesCount.textContent = `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''}`;
  } else {
    notesCount.textContent = `${filteredNotes.length} of ${allNotes.length} notes`;
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
    row.innerHTML = '<td colspan="6" style="text-align: center; color: #737373; padding: 20px;">No notes match your search.</td>';
    notesTbody.appendChild(row);
    return;
  }
  
  sortedNotes.forEach(note => {
    const row = document.createElement('tr');
    row.dataset.noteId = note.id;
    
    row.innerHTML = `
      <td><span class="note-pattern">${escapeHtml(note.pattern)}</span></td>
      <td><span class="${getMatchTypeBadgeClass(note.matchType)}">${getMatchTypeDisplay(note.matchType)}</span></td>
      <td><div class="note-preview" title="${escapeHtml(note.note)}">${escapeHtml(note.note)}</div></td>
      <td class="date-cell">${formatDate(note.createdAt)}</td>
      <td class="date-cell">${formatDate(note.updatedAt)}</td>
      <td class="action-buttons">
        <button class="btn-small primary edit-btn">Edit</button>
        <button class="btn-small danger delete-btn">Delete</button>
      </td>
    `;
    
    // Add event listeners
    row.querySelector('.edit-btn').addEventListener('click', () => editNote(note));
    row.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note));
    
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
  if (!confirm(`Are you sure you want to delete the note for "${note.pattern}"?`)) {
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
    
    showStatus('Note deleted successfully!', 'success');
    
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
  templatesCount.textContent = `${allTemplates.length} template${allTemplates.length !== 1 ? 's' : ''}`;
  
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
    
    const text = document.createElement('div');
    text.className = 'template-text';
    text.textContent = template;
    
    const actions = document.createElement('div');
    actions.className = 'template-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small primary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEditTemplate(index, template, item));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteTemplate(index));
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(text);
    item.appendChild(actions);
    templatesList.appendChild(item);
  });
}

// Start editing a template
function startEditTemplate(index, currentText, itemElement) {
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
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => saveEditTemplate(index, textarea.value));
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-small';
  cancelBtn.textContent = 'Cancel';
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
async function saveEditTemplate(index, newText) {
  const text = newText.trim();
  if (!text) {
    showStatus('Template text cannot be empty.', 'error');
    return;
  }
  
  try {
    await messenger.runtime.sendMessage({
      action: 'updateTemplate',
      index: index,
      template: text
    });
    
    showStatus('Template updated successfully!', 'success');
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
    showStatus('Please enter template text.', 'error');
    return;
  }
  
  try {
    await messenger.runtime.sendMessage({
      action: 'addTemplate',
      template: text
    });
    
    newTemplateInput.value = '';
    showStatus('Template added successfully!', 'success');
    await loadTemplates();
  } catch (error) {
    console.error('Error adding template:', error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Delete template
async function deleteTemplate(index) {
  if (!confirm('Are you sure you want to delete this template?')) {
    return;
  }
  
  try {
    await messenger.runtime.sendMessage({
      action: 'deleteTemplate',
      index: index
    });
    
    showStatus('Template deleted successfully!', 'success');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load notes
  loadNotes();
  
  // Load templates
  loadTemplates();
  
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
});

// Listen for storage changes to refresh the list
messenger.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.notes) {
      loadNotes();
    }
    if (changes.templates) {
      loadTemplates();
    }
  }
});
