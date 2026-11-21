(() => {
  const root = document.documentElement;
  const button = document.getElementById('theme');
  let preference = null;
  try { preference = localStorage.getItem('lienvo-theme') ?? localStorage.getItem('hublot-theme'); } catch {}
  const dark = preference === 'dark' || (preference !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const apply = value => {
    root.dataset.theme = value ? 'dark' : 'light';
    if (button) {
      button.textContent = value ? 'Mode clair' : 'Mode sombre';
      button.setAttribute('aria-pressed', String(value));
    }
  };
  apply(Boolean(dark));
  button?.addEventListener('click', () => {
    const value = root.dataset.theme !== 'dark';
    apply(value);
    try { localStorage.setItem('lienvo-theme', value ? 'dark' : 'light'); } catch {}
  });
})();
