/**
 * The FoundIT icon. On the Default look it is the original image, untouched. On every other look it is the
 * same picture redrawn so its background takes the student's chosen colors (the gradient comes from the theme's
 * CSS variables) and its check mark uses the theme's check color. Which one shows is decided by CSS from
 * <html data-theme> (see index.css), so it also works on pages outside the theme provider, such as a finder's
 * tag page, and there is no flash of the wrong one.
 *
 * Pass the size and rounding as className, e.g. "h-7 w-7 rounded-[8px] shadow-md". Pass label if the icon
 * is the only thing naming the app there; otherwise it is decorative.
 */
export default function Logo({ className = "", label }) {
  return (
    <>
      <img src="/brand/foundit-icon.png" alt={label || ""} className={`logo-classic ${className}`} />
      <span
        className={`logo-themed relative overflow-hidden bg-brand-gradient ${className}`}
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
      >
        <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="150" cy="150" r="66" stroke="#fff" strokeWidth="24" />
          <path d="M199 199 L234 234" stroke="#fff" strokeWidth="24" />
          <path d="M108 152 L136 176 L186 124" style={{ stroke: "var(--logo-check, #3fe08b)" }} strokeWidth="19" />
        </svg>
      </span>
    </>
  );
}
