// i18n
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const msg = typeof browser !== 'undefined' && browser.i18n 
      ? browser.i18n.getMessage(key)
      : (typeof messenger !== 'undefined' && messenger.i18n ? messenger.i18n.getMessage(key) : null);
    if (msg) {
      if (el.tagName === 'TITLE') {
        document.title = msg;
      } else {
        el.textContent = msg;
      }
    }
  });
}

applyI18n();

document.getElementById('closeBtn').addEventListener('click', () => {
  window.close();
});

// Also close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});
