// Blocking, same-origin startup: apply the preference before the app paints.
(() => {
  let preference = null;
  try { preference = localStorage.getItem('maple-theme'); } catch { /* Storage may be unavailable. */ }
  const theme = preference === 'light' || preference === 'dark'
    ? preference : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
