// Welcome page script

// Template message keys for fetching translated templates
const TEMPLATE_KEYS = [
  "templateImportantClient",
  "templateVipCustomer",
  "templateComplaintHistory",
  "templatePotentialSpam",
  "templateSlowPayer",
  "templateOldColleague",
  "templateNewsletter",
  "templateSpam",
  "templateResearch",
  "templateFrequentGuest",
  "templateAppointmentNoShow",
  "templateFrequentlyLate",
  "templateOutstandingBalance",
  "templateConfidentialClient",
  "templateAggressiveCommunication",
  "templateVipPrioritize",
  "templateFriendlyInformal"
];

// Get templates in the specified language
async function getTranslatedTemplates(language) {
  // Load the messages file for the selected language
  const lang = language === 'auto' ? messenger.i18n.getUILanguage().split('-')[0] : language;
  const supportedLangs = ['en', 'el'];
  const finalLang = supportedLangs.includes(lang) ? lang : 'en';
  
  try {
    const url = messenger.runtime.getURL(`_locales/${finalLang}/messages.json`);
    const response = await fetch(url);
    const messages = await response.json();
    
    return TEMPLATE_KEYS.map(key => {
      return messages[key]?.message || messenger.i18n.getMessage(key);
    });
  } catch (e) {
    console.error('Error loading templates:', e);
    // Fallback to current i18n
    return TEMPLATE_KEYS.map(key => messenger.i18n.getMessage(key));
  }
}

// Update page content with translations
async function updatePageTranslations(language) {
  // Determine which language to load
  const lang = language === 'auto' ? messenger.i18n.getUILanguage().split('-')[0] : language;
  const supportedLangs = ['en', 'el'];
  const finalLang = supportedLangs.includes(lang) ? lang : 'en';
  
  try {
    const url = messenger.runtime.getURL(`_locales/${finalLang}/messages.json`);
    const response = await fetch(url);
    const messages = await response.json();
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (messages[key]?.message) {
        el.textContent = messages[key].message;
      }
    });
    
    // Update title
    if (messages.welcomeTitle?.message) {
      document.title = messages.welcomeTitle.message;
    }
  } catch (e) {
    console.error('Error loading translations:', e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Welcome page loaded');
  
  try {
    // Wait for i18n to be ready
    if (typeof i18nReady !== 'undefined') {
      await i18nReady;
    }
    
    // Apply initial translations using the i18n.js translatePage function
    if (typeof translatePage === 'function') {
      await translatePage();
    }
    
    // Get the current language setting if any (stored in settings object)
    const { settings = {} } = await messenger.storage.local.get('settings');
    if (settings.language) {
      const radio = document.querySelector(`input[name="language"][value="${settings.language}"]`);
      if (radio) {
        radio.checked = true;
        // Update translations for saved language
        await updatePageTranslations(settings.language);
      }
    }
  } catch (e) {
    console.error('Error during initialization:', e);
  }
  
  // Handle language selection changes - update UI in real-time
  document.querySelectorAll('input[name="language"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      try {
        const selectedLanguage = e.target.value;
        await updatePageTranslations(selectedLanguage);
      } catch (err) {
        console.error('Error updating translations:', err);
      }
    });
  });
  
  // Handle Get Started button
  document.getElementById('get-started-btn').addEventListener('click', async () => {
    console.log('Get Started clicked');
    try {
      // Get selected language
      const selectedLanguage = document.querySelector('input[name="language"]:checked').value;
      console.log('Selected language:', selectedLanguage);
      
      // Save language preference in the settings object (same format as manage-notes.js)
      await messenger.storage.local.set({ settings: { language: selectedLanguage } });
      console.log('Language saved');
      
      // Get templates in the selected language and save them
      const translatedTemplates = await getTranslatedTemplates(selectedLanguage);
      console.log('Templates:', translatedTemplates);
      await messenger.storage.local.set({ templates: translatedTemplates });
      console.log('Templates saved');
      
      // Mark welcome as completed
      await messenger.storage.local.set({ welcomeCompleted: true });
      console.log('Welcome completed');
      
      // Close this tab
      const currentTab = await messenger.tabs.getCurrent();
      if (currentTab) {
        await messenger.tabs.remove(currentTab.id);
      }
    } catch (err) {
      console.error('Error in Get Started:', err);
      alert('An error occurred: ' + err.message);
    }
  });
});
