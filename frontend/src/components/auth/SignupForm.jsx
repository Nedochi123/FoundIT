import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../theme/ThemeProvider";
import ThemePicker from "../theme/ThemePicker";
import PasswordInput from "./PasswordInput";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const hintClass = "mt-1 text-xs text-slate-400";

export default function SignupForm({ onSwitchToLogin, onShowLegal }) {
  const { signup } = useAuth();
  const { theme, doodle, preview } = useTheme();
  const [look, setLook] = useState({ theme, doodle });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // the whole app re-colors as they choose, so they see exactly what they are getting
  function handleLook(next) {
    setLook(next);
    preview(next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup({ name, email, password, idNumber: idNumber || undefined, theme: look.theme, doodle: look.doodle });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="signup-name" className={labelClass}>
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Ada Lovelace"
        />
      </div>
      <div>
        <label htmlFor="signup-email" className={labelClass}>
          Nile University email
        </label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="yourIDnumber@nileuniversity.edu.ng"
        />
        <p className={hintClass}>Open to students, lecturers, and staff.</p>
      </div>
      <div>
        <label htmlFor="signup-idnumber" className={labelClass}>
          ID number <span className="text-slate-400 font-normal">(optional for now)</span>
        </label>
        <input
          id="signup-idnumber"
          type="text"
          inputMode="numeric"
          maxLength={9}
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          className={inputClass}
          placeholder="123456789"
          pattern="\d{9}"
          title="Format: 9 digits, e.g. 123456789"
        />
        <p className={hintClass}>
          Format: 9 digits, e.g. 123456789. You'll only need to enter this once — we'll ask when you first report a
          found item if you skip it now.
        </p>
      </div>
      <div>
        <label htmlFor="signup-password" className={labelClass}>
          Password
        </label>
        <PasswordInput
          id="signup-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <p className="text-sm font-bold text-slate-50">Make FoundIT yours</p>
        <p className="mb-3.5 mt-0.5 text-xs text-slate-400">
          Choose the color and the little doodles that float around your app. You can change them any time in Profile.
        </p>
        <ThemePicker value={look} onChange={handleLook} />
      </div>
      <label className="flex items-start gap-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 accent-brand-teal"
        />
        <span>
          I agree to FoundIT's{" "}
          <button
            type="button"
            onClick={onShowLegal}
            className="font-semibold text-brand-teal underline hover:no-underline"
          >
            Privacy &amp; Terms
          </button>
        </span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !agreed}
        className="mt-1 w-full rounded-lg bg-brand-gradient py-2.5 font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-semibold text-brand-teal hover:underline">
          Log in
        </button>
      </p>
    </form>
  );
}
