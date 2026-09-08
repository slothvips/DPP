var storedTheme = localStorage.getItem('theme');
var theme =
  storedTheme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : storedTheme === 'dark'
      ? 'dark'
      : 'light';
document.documentElement.dataset.dppTheme = theme;
document.documentElement.classList.toggle('dark', theme === 'dark');
