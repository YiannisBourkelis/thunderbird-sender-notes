// i18n helper for translating HTML elements
// Add data-i18n attribute to elements for automatic translation
// Use data-i18n-placeholder for placeholder attributes
// Use data-i18n-title for title attributes

// Cache for loaded translations
let customMessages = null;
let currentLanguage = 'auto';

// Load messages for a specific language
async function loadMessages(lang) {
  if (lang === 'auto') {
    // Use default messenger i18n
    customMessages = null;
    return;
  }
  
  try {
    const url = messenger.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    if (response.ok) {
      customMessages = await response.json();
    } else {
      console.warn(`Could not load messages for ${lang}, falling back to default`);
      customMessages = null;
    }
  } catch (error) {
    console.warn(`Error loading messages for ${lang}:`, error);
    customMessages = null;
  }
}

// Get message with substitutions
function getMessage(messageObj, substitutions) {
  if (!messageObj || !messageObj.message) return null;
  
  let message = messageObj.message;
  
  // Handle substitutions
  if (substitutions) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
    subs.forEach((sub, index) => {
      message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
    });
    
    // Also replace named placeholders
    if (messageObj.placeholders) {
      for (const [name, placeholder] of Object.entries(messageObj.placeholders)) {
        const content = placeholder.content;
        if (content && content.startsWith('$')) {
          const idx = parseInt(content.substring(1)) - 1;
          if (subs[idx] !== undefined) {
            message = message.replace(new RegExp(`\\$${name.toUpperCase()}\\$`, 'gi'), subs[idx]);
          }
        }
      }
    }
  }
  
  return message;
}

function i18n(key, substitutions) {
  // Use custom messages if loaded
  if (customMessages && customMessages[key]) {
    const result = getMessage(customMessages[key], substitutions);
    if (result) return result;
  }
  
  // Fall back to messenger i18n
  return messenger.i18n.getMessage(key, substitutions) || key;
}

async function translatePage() {
  // Load custom language if set
  const { settings = {} } = await messenger.storage.local.get('settings');
  currentLanguage = settings.language || 'auto';
  
  if (currentLanguage !== 'auto') {
    await loadMessages(currentLanguage);
  }
  
  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });
  
  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.placeholder = translated;
    }
  });
  
  // Translate titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.title = translated;
    }
  });
  
  // Translate document title
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) {
    const key = titleEl.getAttribute('data-i18n');
    const translated = i18n(key);
    if (translated && translated !== key) {
      document.title = translated;
    }
  }
  
  // Translate select options
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });
}

// Run translation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => translatePage());
} else {
  translatePage();
}
