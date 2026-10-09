import { useEffect, useState } from "react";
import "./IntroAnimation.css";
import Logo from "./theme/Logo";

// Total time the overlay stays mounted: matches the CSS's fade-out delay
// (2.2s of action) + fade-out duration (0.5s), plus a small buffer.
const TOTAL_MS = 2800;

export default function IntroAnimation({ onDone }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    // Reduced motion: skip the choreographed run/bump/shake/wave
    // sequence entirely rather than just slowing it down — respects the
    // preference instead of working around it.
    const delay = mq.matches ? 400 : TOTAL_MS;
    const timer = setTimeout(onDone, delay);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={`intro-overlay ${reducedMotion ? "intro-reduced" : ""}`}>
      <div className="intro-stage">
        <div className="intro-logo">
          <Logo className="intro-logo-img" />
        </div>

        <svg className="intro-character" viewBox="0 0 120 160" aria-hidden="true">
          <g className="runner-head-group">
            {/* afro — big and full, framing most of the head */}
            <circle cx="60" cy="37" r="36" className="runner-afro" />

            {/* face */}
            <circle cx="60" cy="43" r="19" className="runner-skin" />

            {/* dazed eyes (X) */}
            <g className="runner-eyes-dazed">
              <path d="M46,40 L56,50 M56,40 L46,50" className="runner-line" />
              <path d="M64,40 L74,50 M74,40 L64,50" className="runner-line" />
            </g>

            {/* happy eyes (curved) */}
            <g className="runner-eyes-happy">
              <path d="M45,48 Q52,40 59,48" className="runner-line" />
              <path d="M61,48 Q68,40 75,48" className="runner-line" />
            </g>

            {/* flat/dazed mouth */}
            <line x1="51" y1="55" x2="69" y2="55" className="runner-mouth-flat runner-line" />

            {/* smile */}
            <path d="M49,53 Q60,65 71,53" className="runner-mouth-smile runner-line" />
          </g>

          {/* torso */}
          <rect x="41" y="63" width="38" height="44" rx="12" className="runner-shirt" />

          {/* left arm (static) */}
          <line x1="41" y1="73" x2="24" y2="86" className="runner-line runner-limb" />

          {/* right arm (waves) */}
          <g className="runner-arm-wave-pivot">
            <line x1="79" y1="73" x2="96" y2="58" className="runner-line runner-limb" />
          </g>

          {/* left leg (runs) */}
          <g className="runner-leg-left-pivot">
            <line x1="49" y1="106" x2="42" y2="144" className="runner-line runner-limb-leg" />
          </g>

          {/* right leg (runs) */}
          <g className="runner-leg-right-pivot">
            <line x1="71" y1="106" x2="78" y2="144" className="runner-line runner-limb-leg" />
          </g>
        </svg>
      </div>
    </div>
  );
}
