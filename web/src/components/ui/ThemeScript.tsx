export const THEME_KEY = 'follower.theme';

// Runs before first paint, so a user who picked a theme never sees the other one
// flash. Without an explicit choice nothing is stamped and the CSS
// prefers-color-scheme block decides.
const SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${THEME_KEY}');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.colorScheme = t;
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
