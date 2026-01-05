// Uses i18n() from shared/i18n.js

let currentSender = null;
let currentNotes = [];

// DOM elements
const noNotesDiv = document.getElementById('no-notes');
const hasNotesDiv = document.getElementById('has-notes');
const senderHeaderDiv = document.querySelector('.sender-header');
const senderEmailSpan = document.getElementById('sender-email');
const notesList = document.getElementById('notes-list');
const addNoteBtn = document.getElementById('add-note-btn');
const addAnotherNoteBtn = document.getElementById('add-another-note-btn');
const manageNotesBtn = document.getElementById('manage-notes-btn');
const manageNotesBtnEmpty = document.getElementById('manage-notes-btn-empty');
const statusMessage = document.getElementById('status-message');

// Helper function to extract email from author string
function extractEmail(author) {
  const match = author.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return author.toLowerCase().trim();
}

// Get current message sender using multiple methods
async function getCurrentSenderFromPopup() {
  console.log("Mail Note: Getting current sender...");
  console.log("Mail Note: Available APIs - mailTabs:", !!messenger.mailTabs, 
              "messageDisplay:", !!messenger.messageDisplay,
              "messages:", !!messenger.messages);
  
  try {
    // Method 1: Try messageDisplay.getDisplayedMessages() - works for message tabs (MV3)
    if (messenger.messageDisplay && messenger.messageDisplay.getDisplayedMessages) {
      try {
        const tabs = await messenger.tabs.query({});
        console.log("Mail Note: Checking", tabs.length, "tabs for displayed messages");
        
        for (const tab of tabs) {
          try {
            const messageList = await messenger.messageDisplay.getDisplayedMessages(tab.id);
            console.log("Mail Note: Tab", tab.id, "displayed messages:", messageList);
            
            if (messageList && messageList.messages && messageList.messages.length > 0) {
              const message = messageList.messages[0];
              console.log("Mail Note: Found displayed message in tab", tab.id, ":", message.author);
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
        console.log("Mail Note: messageDisplay.getDisplayedMessages failed:", e.message);
      }
    }
    
    // Method 2: Try mailTabs.getSelectedMessages() - works for mail tabs (3-pane view)
    if (messenger.mailTabs) {
      try {
        // Get all mail tabs
        const mailTabs = await messenger.mailTabs.query({});
        console.log("Mail Note: Found mail tabs:", mailTabs.length);
        
        for (const tab of mailTabs) {
          try {
            const messageList = await messenger.mailTabs.getSelectedMessages(tab.id);
            console.log("Mail Note: Selected messages in tab", tab.id, ":", messageList);
            
            if (messageList && messageList.messages && messageList.messages.length > 0) {
              const message = messageList.messages[0];
              console.log("Mail Note: Found selected message:", message.author);
              return {
                email: extractEmail(message.author),
                author: message.author
              };
            }
          } catch (e) {
            console.log("Mail Note: Could not get messages from tab", tab.id, ":", e.message);
          }
        }
      } catch (e) {
        console.log("Mail Note: mailTabs.query failed:", e.message);
      }
    }
    
    // Method 3: Fallback to background script
    console.log("Mail Note: Trying background script fallback...");
    const result = await messenger.runtime.sendMessage({
      action: 'getCurrentMessageSender'
    });
    if (result) {
      console.log("Mail Note: Got sender from background:", result);
      return result;
    }
    
  } catch (e) {
    console.error("Mail Note: Error getting sender:", e);
  }
  
  console.log("Mail Note: Could not find any message");
  return null;
}

// Render the list of notes
function renderNotesList(notes) {
  notesList.innerHTML = '';
  
  notes.forEach((note, index) => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.noteId = note.id;
    
    const noteHeader = document.createElement('div');
    noteHeader.className = 'note-item-header';
    
    const matchInfo = document.createElement('span');
    matchInfo.className = 'note-match-info';
    matchInfo.textContent = `${i18n('matchType' + note.matchType.charAt(0).toUpperCase() + note.matchType.slice(1))}: ${note.pattern}`;
    
    const noteActions = document.createElement('div');
    noteActions.className = 'note-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small primary';
    editBtn.textContent = i18n('edit');
    editBtn.addEventListener('click', () => editNote(note));
    
    noteActions.appendChild(editBtn);
    
    noteHeader.appendChild(matchInfo);
    noteHeader.appendChild(noteActions);
    
    const noteText = document.createElement('div');
    noteText.className = 'note-item-text';
    noteText.textContent = note.note;
    
    noteItem.appendChild(noteHeader);
    noteItem.appendChild(noteText);
    notesList.appendChild(noteItem);
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for i18n to load custom messages
  await i18nReady;
  
  console.log("Mail Note: view-note.js loaded");
  
  try {
    // Get current message sender
    currentSender = await getCurrentSenderFromPopup();
    
    console.log("Mail Note: currentSender =", currentSender);
    
    if (!currentSender || !currentSender.email) {
      showStatus(i18n('noMessageSelected'), 'error');
      return;
    }
    
    // Check if sender is user's own account
    const ownEmailCheck = await messenger.runtime.sendMessage({
      action: 'isOwnEmail',
      email: currentSender.email
    });
    
    if (ownEmailCheck && ownEmailCheck.isOwn) {
      console.log("Mail Note: Sender is user's own account, hiding notes");
      showStatus(i18n('ownEmailWarningMessage'), 'info');
      senderHeaderDiv.style.display = 'none';
      noNotesDiv.style.display = 'none';
      hasNotesDiv.style.display = 'none';
      return;
    }
    
    senderEmailSpan.textContent = currentSender.author || currentSender.email;
    
    // Load all matching notes
    currentNotes = await messenger.runtime.sendMessage({
      action: 'findAllMatchingNotes',
      email: currentSender.email
    });
    
    console.log("Mail Note: currentNotes =", currentNotes);
    
    if (currentNotes && currentNotes.length > 0) {
      renderNotesList(currentNotes);
      noNotesDiv.style.display = 'none';
      hasNotesDiv.style.display = 'block';
    } else {
      noNotesDiv.style.display = 'block';
      hasNotesDiv.style.display = 'none';
    }
  } catch (error) {
    console.error("Mail Note: Error initializing view-note:", error);
    showStatus('Error: ' + error.message, 'error');
  }
});

// Add note button
addNoteBtn.addEventListener('click', async () => {
  console.log("Mail Note: Add Note button clicked, currentSender =", currentSender);
  
  if (!currentSender || !currentSender.email) {
    showStatus(i18n('noSenderInfo'), 'error');
    return;
  }
  
  try {
    await openNoteEditor();
  } catch (error) {
    console.error("Mail Note: Error opening note editor:", error);
    showStatus('Error: ' + error.message, 'error');
  }
});

// Add another note button
addAnotherNoteBtn.addEventListener('click', async () => {
  console.log("Mail Note: Add Another Note button clicked, currentSender =", currentSender);
  
  if (!currentSender || !currentSender.email) {
    showStatus(i18n('noSenderInfo'), 'error');
    return;
  }
  
  try {
    await openNoteEditor();
  } catch (error) {
    console.error("Mail Note: Error opening note editor:", error);
    showStatus('Error: ' + error.message, 'error');
  }
});

// Manage all notes buttons
async function openManageNotes() {
  try {
    const result = await messenger.runtime.sendMessage({
      action: 'openManageNotes'
    });
    
    if (result && result.success) {
      window.close();
    }
  } catch (error) {
    console.error("Mail Note: Error opening manage notes:", error);
    showStatus('Error: ' + error.message, 'error');
  }
}

manageNotesBtn.addEventListener('click', openManageNotes);
manageNotesBtnEmpty.addEventListener('click', openManageNotes);

// Edit a specific note
async function editNote(note) {
  console.log("Mail Note: Edit note clicked", note);
  
  if (!currentSender || !currentSender.email) {
    showStatus(i18n('noSenderInfo'), 'error');
    return;
  }
  
  try {
    await openNoteEditorForNote(note);
  } catch (error) {
    console.error("Mail Note: Error opening note editor:", error);
    showStatus('Error: ' + error.message, 'error');
  }
}

// Delete a specific note
async function deleteNote(note) {
  console.log("Mail Note: Delete note clicked", note);
  
  if (confirm(i18n('confirmDelete'))) {
    try {
      await messenger.runtime.sendMessage({
        action: 'deleteNote',
        noteId: note.id
      });
      
      // Refresh the banner
      await messenger.runtime.sendMessage({
        action: 'refreshBanner',
        email: currentSender.email
      });
      
      showStatus(i18n('noteDeleted'), 'success');
      
      // Reload the notes list
      currentNotes = await messenger.runtime.sendMessage({
        action: 'findAllMatchingNotes',
        email: currentSender.email
      });
      
      if (currentNotes && currentNotes.length > 0) {
        renderNotesList(currentNotes);
      } else {
        noNotesDiv.style.display = 'block';
        hasNotesDiv.style.display = 'none';
      }
    } catch (error) {
      console.error("Mail Note: Error deleting note:", error);
      showStatus('Error: ' + error.message, 'error');
    }
  }
}

// Open note editor - sends message to background to open popup window
function openNoteEditor() {
  console.log("Mail Note: Opening note editor for", currentSender);
  
  // Send message to background script to open popup
  messenger.runtime.sendMessage({
    action: 'openAddNotePopup',
    email: currentSender.email,
    author: currentSender.author
  }).catch(() => {}); // Ignore any errors
  
  // Close this popup after a brief delay to allow message to be sent
  setTimeout(() => window.close(), 50);
}

// Open note editor for a specific note
function openNoteEditorForNote(note) {
  console.log("Mail Note: Opening note editor for note", note);
  
  // Send message to background script to open popup with note ID
  messenger.runtime.sendMessage({
    action: 'openAddNotePopup',
    email: currentSender.email,
    author: currentSender.author,
    noteId: note.id
  }).catch(() => {}); // Ignore any errors
  
  // Close this popup after a brief delay to allow message to be sent
  setTimeout(() => window.close(), 50);
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';
}
