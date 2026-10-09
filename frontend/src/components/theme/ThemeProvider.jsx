import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getTheme, normalizeLook } from "../../lib/themes";
import { applyThemedIcons } from "../../lib/themedIcon";
import DoodleField from "./DoodleField";

const STORAGE_KEY = "foundit_theme";
const STILL_KEY = "foundit_doodles_still";
const ThemeContext = createContext(null);

// "Keep doodles still": a per-device switch that stops the floating without removing the doodles.
function readStill() {
  try {
    return localStorage.getItem(STILL_KEY) === "1";
  } catch {
    return false;
  }
}

// The last look used on this device, so the app is already in the right colors before sign-in finishes
// (index.html applies the color even before this code loads, to avoid a flash of the default).
function readStoredLook() {
  try {
    return normalizeLook(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return normalizeLook({});
  }
}

/**
 * Applies the student's chosen look to the whole app: the color theme (a data-theme attribute that the CSS in
 * src/themes.css keys off) and the floating doodles. A signed-in student's saved look wins, so it follows
 * them to any device; preview() changes it on screen only (the sign-up form and Profile use it to let them
 * try colors before saving).
 */
export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [look, setLook] = useState(readStoredLook);
  const [still, setStillState] = useState(readStill);

  const savedTheme = user?.theme;
  const savedDoodle = user?.doodle;
  useEffect(() => {
    if (savedTheme) setLook(normalizeLook({ theme: savedTheme, doodle: savedDoodle }));
  }, [savedTheme, savedDoodle]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", look.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getTheme(look.theme).chrome);
    applyThemedIcons(look.theme); // the browser-tab icon and the iPhone Home Screen icon
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(look));
    } catch {
      // Private browsing: the look still applies for this visit.
    }
  }, [look]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-still", still);
    try {
      localStorage.setItem(STILL_KEY, still ? "1" : "0");
    } catch {
      // Private browsing: the choice still applies for this visit.
    }
  }, [still]);

  const preview = useCallback((next) => setLook((current) => normalizeLook({ ...current, ...next })), []);
  const value = useMemo(
    () => ({
      theme: look.theme,
      doodle: look.doodle,
      preview,
      saved: normalizeLook({ theme: savedTheme, doodle: savedDoodle }),
      still,
      setStill: setStillState,
    }),
    [look, preview, savedTheme, savedDoodle, still]
  );

  return (
    <ThemeContext.Provider value={value}>
      <DoodleField doodle={look.doodle} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
