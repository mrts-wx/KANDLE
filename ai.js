(() => {
  'use strict';
  const panel = document.getElementById('ai-panel');
  const launcher = document.getElementById('ai-launcher');
  const closeButton = document.getElementById('ai-close');
  if (!panel || !launcher || !closeButton) return;

  function openPanel() {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });
  }
  function closePanel(restoreFocus = true) {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    if (restoreFocus) launcher.focus({ preventScroll: true });
  }
  launcher.addEventListener('click', () => panel.hidden ? openPanel() : closePanel(false));
  closeButton.addEventListener('click', () => closePanel(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel(true);
  });
  document.addEventListener('click', event => {
    if (!panel.hidden && !panel.contains(event.target) && !launcher.contains(event.target)) closePanel(false);
  });
})();
