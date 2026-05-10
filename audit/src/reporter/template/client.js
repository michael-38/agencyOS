(function () {
  function activate(id) {
    document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('section.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.tab === id));
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  }

  document.querySelectorAll('nav.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('.issue');
    if (el) el.classList.toggle('expanded');
  });

  const fromHash = location.hash.replace('#', '');
  if (fromHash && document.querySelector('section.tab-panel[data-tab="' + fromHash + '"]')) {
    activate(fromHash);
  } else {
    activate('overview');
  }
})();
