// Applies the look saved on this device before the first paint, so a user who
// picked Light or Automatic never sees a flash of the dark default.
// A file (not inline) so the page needs no dangerouslySetInnerHTML; the CSP
// allows scripts from 'self'. Kept in sync with ThemePicker (more-sheet.tsx).
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "system") document.documentElement.dataset.theme = t;
} catch (e) {}
