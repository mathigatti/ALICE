// Runs before styles load to avoid flashing the wrong theme on navigation.
(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = JSON.parse(localStorage.getItem('alice:theme'));
    if (['system', 'light', 'dark'].includes(saved)) preference = saved;
  } catch {}

  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'dark' ? '#202429' : '#e7f0ee';
    const icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    if (icon) icon.href = theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg';
  }
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const select = document.getElementById('theme');
    if (!select) return;
    select.value = preference;
    select.addEventListener('change', () => {
      preference = select.value;
      try { localStorage.setItem('alice:theme', JSON.stringify(preference)); } catch {}
      apply();
    });
  });
})();
