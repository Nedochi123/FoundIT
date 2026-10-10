// The FoundIT icon in the student's chosen color, for the places the page can't style with CSS: the little icon
// in the browser tab, and the picture an iPhone saves when "Add to Home Screen" is used. It is drawn on a canvas
// (the same artwork as components/theme/Logo.jsx) and handed to the page's <link> tags as a PNG.
//
// The Home Screen icon of an app that is ALREADY installed is another matter: a web page can't redraw it. What it
// can do is point the page at a web-app manifest in the student's saved color (setManifestForTheme below, with the
// files from scripts/build-theme-icons.mjs). Chrome on Android re-checks the manifest of an installed app and
// updates the icon by itself, usually within a day or two of the app being opened. An iPhone never updates it:
// the icon is read once, when "Add to Home Screen" is used, so the app must be removed and added again.
// Push notification pictures are fixed files too.

const DEFAULT_ICON = "/icons/icon-192.png";
const SIZE = 192;
const APPLE_SIZE = 180;

function roundedSquare(g, s, r) {
  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(s, 0, s, s, r);
  g.arcTo(s, s, 0, s, r);
  g.arcTo(0, s, 0, 0, r);
  g.arcTo(0, 0, s, 0, r);
  g.closePath();
}

/** The icon as a PNG data URL. Rounded for a tab; full-bleed for iPhone, which rounds the corners itself. */
function draw(px, { a, b, check }, rounded) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d");
  const k = px / 360; // the artwork is drawn on a 360 x 360 grid
  g.scale(k, k);

  const gradient = g.createLinearGradient(0, 0, 360, 360);
  gradient.addColorStop(0, a);
  gradient.addColorStop(1, b);
  g.fillStyle = gradient;
  if (rounded) {
    roundedSquare(g, 360, 62);
    g.fill();
  } else {
    g.fillRect(0, 0, 360, 360);
  }

  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = "#ffffff";
  g.lineWidth = 24;
  g.beginPath();
  g.arc(150, 150, 66, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(199, 199);
  g.lineTo(234, 234);
  g.stroke();

  g.strokeStyle = check;
  g.lineWidth = 19;
  g.beginPath();
  g.moveTo(108, 152);
  g.lineTo(136, 176);
  g.lineTo(186, 124);
  g.stroke();

  return canvas.toDataURL("image/png");
}

/**
 * Points the page's web-app manifest at the given SAVED color (Default goes back to manifest.json). Not used for
 * previews: a phone may read the manifest at any moment, and it should only ever see a color the student kept.
 */
export function setManifestForTheme(themeId) {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link || !/^[a-z]+$/.test(themeId || "")) return;
  link.href = themeId === "classic" ? "/manifest.json" : `/manifests/${themeId}.json`;
}

/** Points the tab icon and the Home Screen icon at the given look (Default goes back to the original files). */
export function applyThemedIcons(themeId) {
  const icon = document.querySelector('link[rel="icon"]');
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  try {
    if (themeId === "classic") {
      if (icon) icon.href = DEFAULT_ICON;
      if (apple) apple.href = DEFAULT_ICON;
      return;
    }
    const css = getComputedStyle(document.documentElement);
    const colors = {
      a: css.getPropertyValue("--brand-a").trim() || "#17b8ae",
      b: css.getPropertyValue("--brand-b").trim() || "#2467e6",
      check: css.getPropertyValue("--logo-check").trim() || "#3fe08b",
    };
    if (icon) {
      icon.type = "image/png";
      icon.href = draw(SIZE, colors, true);
    }
    if (apple) apple.href = draw(APPLE_SIZE, colors, false);
  } catch {
    // No canvas (very old browser): the original icon stays, which is fine.
  }
}
