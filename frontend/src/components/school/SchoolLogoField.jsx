import { SCHOOLS } from "../../lib/schools";
import SchoolMark from "./SchoolMark";

// Where each logo floats (percent of the screen), its size in px, tilt, how long one drift takes, and how far into
// the drift it starts, so no two move in step. The motion names are the doodles' own ("bob" floats up and down,
// "drift" sways sideways, "orbit" traces a small loop), so the logos behave exactly like the floating doodles.
// Neighbouring slots are given to different schools, so the same crest never sits twice side by side.
const SLOTS = [
  { x: 5, y: 6, size: 64, rot: -10, dur: 11, delay: 0, move: "bob" },
  { x: 30, y: 3, size: 52, rot: 8, dur: 13, delay: -3, move: "drift" },
  { x: 55, y: 8, size: 72, rot: 0, dur: 12, delay: -5, move: "orbit" },
  { x: 82, y: 4, size: 56, rot: 12, dur: 10, delay: -2, move: "bob" },
  { x: 14, y: 30, size: 76, rot: 9, dur: 14, delay: -1, move: "orbit" },
  { x: 44, y: 34, size: 50, rot: -12, dur: 11, delay: -4, move: "bob" },
  { x: 72, y: 30, size: 66, rot: 6, dur: 15, delay: -7, move: "drift" },
  { x: 91, y: 38, size: 52, rot: -8, dur: 10, delay: -3, move: "orbit" },
  { x: 3, y: 56, size: 56, rot: -6, dur: 12, delay: -8, move: "drift" },
  { x: 30, y: 60, size: 70, rot: 11, dur: 13, delay: -2, move: "bob" },
  { x: 60, y: 56, size: 54, rot: -10, dur: 10, delay: -6, move: "orbit" },
  { x: 84, y: 62, size: 74, rot: 4, dur: 14, delay: -1, move: "drift" },
  { x: 12, y: 82, size: 60, rot: -4, dur: 11, delay: -5, move: "orbit" },
  { x: 40, y: 86, size: 52, rot: 13, dur: 13, delay: -9, move: "bob" },
  { x: 68, y: 82, size: 68, rot: -11, dur: 12, delay: -3, move: "drift" },
  { x: 91, y: 88, size: 54, rot: 8, dur: 10, delay: -7, move: "bob" },
];

/**
 * Every school's logo, floating softly behind the Welcome page. Behind the content, ignoring taps, faint enough
 * not to compete with the school list, and only transforms are animated (the same rules as the doodles). The
 * animation stops for people who prefer reduced motion and when "Keep doodles still" is on, because the logos
 * use the doodle classes (see index.css).
 */
export default function SchoolLogoField({ schools = SCHOOLS }) {
  return (
    <div className="doodle-field" aria-hidden="true" data-testid="school-logo-field">
      {SLOTS.map((slot, i) => (
        <SchoolMark
          key={i}
          school={schools[i % schools.length]}
          size={slot.size}
          className={`doodle school-logo doodle-${slot.move}`}
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            "--rot": `${slot.rot}deg`,
            "--dur": `${slot.dur}s`,
            "--delay": `${slot.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
