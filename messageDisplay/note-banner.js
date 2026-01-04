// Content script for displaying note banner in message pane
// This script runs in the message display context

(function() {
  console.log("Mail Note: Content script loaded in message display");
  
  // i18n helper
  function i18n(key, substitutions) {
    return messenger.i18n.getMessage(key, substitutions) || key;
  }
  
  // Avoid duplicate initialization
  if (window.mailNoteInitialized) {
    console.log("Mail Note: Already initialized, skipping");
    return;
  }
  window.mailNoteInitialized = true;

  let bannerContainer = null;

  // Create the banner container
  function createBannerContainer() {
    if (bannerContainer && document.body.contains(bannerContainer)) {
      return bannerContainer;
    }

    bannerContainer = document.createElement('div');
    bannerContainer.id = 'mail-note-banner-container';
    bannerContainer.className = 'mail-note-banner-container';
    
    return bannerContainer;
  }

  // Create a single banner element for a note
  function createBanner(noteId, note, pattern, matchType) {
    const banner = document.createElement('div');
    banner.className = 'mail-note-banner';
    banner.dataset.noteId = noteId;
    banner.title = i18n('bannerClickToEdit');
    
    // Add click handler to edit the note
    banner.addEventListener('click', () => {
      messenger.runtime.sendMessage({
        action: 'editNoteFromBanner',
        noteId: noteId
      });
    });
    
    const noteIcon = document.createElement('span');
    noteIcon.className = 'mail-note-icon';
    noteIcon.textContent = '📝';
    
    const noteText = document.createElement('span');
    noteText.className = 'mail-note-text';
    noteText.textContent = note;
    
    // Get translated match type
    const matchTypeKey = 'matchType' + matchType.charAt(0).toUpperCase() + matchType.slice(1);
    const translatedMatchType = i18n(matchTypeKey);
    
    const matchInfo = document.createElement('span');
    matchInfo.className = 'mail-note-match-info';
    matchInfo.textContent = `(${translatedMatchType}: ${pattern})`;
    matchInfo.title = `${translatedMatchType}: ${pattern}`;
    
    banner.appendChild(noteIcon);
    banner.appendChild(noteText);
    banner.appendChild(matchInfo);
    
    return banner;
  }

  // Show banners for multiple notes
  function showBanners(notes) {
    console.log("Mail Note: Showing banners for", notes.length, "notes");
    const container = createBannerContainer();
    
    // Clear existing banners
    container.innerHTML = '';
    
    // Create a banner for each note
    for (const noteData of notes) {
      const banner = createBanner(noteData.id, noteData.note, noteData.pattern, noteData.matchType);
      container.appendChild(banner);
    }
    
    // Insert container at the beginning of the body
    if (!document.body.contains(container)) {
      document.body.insertBefore(container, document.body.firstChild);
    }
    
    container.style.display = 'block';
  }

  // Show a single banner (backward compatibility)
  function showBanner(note, pattern, matchType, noteId) {
    console.log("Mail Note: Showing single banner:", note);
    showBanners([{ id: noteId || 'single', note, pattern, matchType }]);
  }

  // Hide all banners
  function hideBanners() {
    console.log("Mail Note: Hiding banners");
    if (bannerContainer) {
      bannerContainer.style.display = 'none';
    }
  }

  // Listen for messages from background script
  messenger.runtime.onMessage.addListener((message, sender) => {
    console.log("Mail Note: Content script received message:", message);
    
    if (message.action === 'showNoteBanners') {
      // New action for multiple banners
      showBanners(message.notes);
      return Promise.resolve({ success: true });
    } else if (message.action === 'showNoteBanner') {
      // Backward compatibility for single banner
      showBanner(message.note, message.pattern, message.matchType, message.noteId);
      return Promise.resolve({ success: true });
    } else if (message.action === 'hideNoteBanner') {
      hideBanners();
      return Promise.resolve({ success: true });
    }
    
    return false;
  });

  // On load, request the notes for the current message
  async function checkForNote() {
    try {
      console.log("Mail Note: Checking for notes on page load...");
      
      // Ask background script for all notes for current message
      const result = await messenger.runtime.sendMessage({
        action: 'checkCurrentMessageNotes'
      });
      
      console.log("Mail Note: checkCurrentMessageNotes result:", result);
      
      if (result && result.hasNotes && result.notes && result.notes.length > 0) {
        showBanners(result.notes);
      }
    } catch (e) {
      console.log("Mail Note: Error checking for notes:", e);
    }
  }

  // Check for note when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForNote);
  } else {
    // Small delay to ensure message info is available
    setTimeout(checkForNote, 100);
  }
})();
