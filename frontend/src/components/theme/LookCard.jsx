import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { normalizeLook } from "../../lib/themes";
import { useTheme } from "./ThemeProvider";
import ThemePicker from "./ThemePicker";

/** Profile: change the app's color and floating doodles after sign-up. The app previews each choice live. */
export default function LookCard() {
  const { user, updateProfile } = useAuth();
  const { preview } = useTheme();
  const saved = normalizeLook({ theme: user?.theme, doodle: user?.doodle });
  const [look, setLook] = useState(saved);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState("");
  const dirty = look.theme !== saved.theme || look.doodle !== saved.doodle;

  // walking away without saving puts the saved look back
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => () => preview(savedRef.current), [preview]);

  function handleChange(next) {
    setLook(next);
    preview(next);
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    setError("");
    try {
      await updateProfile({ theme: look.theme, doodle: look.doodle });
      setStatus("saved");
    } catch (err) {
      setError(err.message || "Couldn't save your look. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur">
      <div className="mb-3.5 flex items-center gap-2">
        <Palette className="h-4 w-4 text-brand-teal" />
        <p className="text-sm font-bold text-slate-50">App look</p>
      </div>
      <ThemePicker value={look} onChange={handleChange} autoSuggest={false} />
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || status === "saving"}
          className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-white shadow-md shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {status === "saving" ? "Saving..." : "Save my look"}
        </button>
        {status === "saved" && !dirty && <p role="status" className="text-sm text-emerald-300">Saved. It will follow you to any device.</p>}
      </div>
    </div>
  );
}
