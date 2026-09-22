import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";
const labelClass = "block text-sm font-medium text-slate-300 mb-1";
const hintClass = "mt-1 text-xs text-slate-400";

export default function SignupForm({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup({ name, email, password, idNumber: idNumber || undefined });
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
          placeholder="yourname@nileuniversity.edu.ng"
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
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          className={inputClass}
          placeholder="NUN/2024/001"
          pattern="[Nn][Uu][Nn]/\d{4}/\d{2,6}"
          title="Format: NUN/2024/001"
        />
        <p className={hintClass}>
          Format: NUN/2024/001. You'll only need to enter this once — we'll ask when you first report a found item if
          you skip it now.
        </p>
      </div>
      <div>
        <label htmlFor="signup-password" className={labelClass}>
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder="At least 8 characters"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
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
