import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 pr-12 text-slate-50 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/60 focus:border-brand-teal";

export default function PasswordInput({ id, value, onChange, placeholder, required, minLength }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        value={value}
        onChange={onChange}
        className={inputClass}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400 transition hover:text-slate-200"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
