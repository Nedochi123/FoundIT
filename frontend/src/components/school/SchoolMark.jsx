import { useState } from "react";

/**
 * A school's logo on a round white badge. The badge is what keeps every logo readable: crests are often dark
 * on a transparent background, which would vanish on the app's dark pages. If the logo file is missing or
 * fails to load, a colored initial in the school's own color is drawn instead, so there is never an empty gap.
 *
 * Decorative: the school's name is always written next to it. Pass size (px) and className/style for placement.
 */
export default function SchoolMark({ school, size = 40, className = "", style }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`school-badge ${className}`}
      style={{ width: size, height: size, padding: Math.round(size * 0.12), ...style }}
      aria-hidden="true"
    >
      {school.logo && !broken ? (
        <img src={school.logo} alt="" draggable={false} decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span className="school-mark" style={{ background: school.color, color: school.markText, fontSize: Math.round(size * 0.4) }}>
          {school.mark}
        </span>
      )}
    </span>
  );
}
