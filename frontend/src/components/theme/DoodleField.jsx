import { DOODLE_SETS } from "./doodles";

// Where each doodle floats (percent of the screen), its size in px, tilt, how long one drift takes, and how
// far into the drift it starts, so no two move in step. "bob" floats up and down, "drift" sways sideways,
// "orbit" traces a small loop.
const SLOTS = [
  { x: 6, y: 7, size: 36, rot: -12, dur: 9, delay: 0, move: "bob" },
  { x: 26, y: 3, size: 28, rot: 8, dur: 12, delay: -3, move: "drift" },
  { x: 47, y: 9, size: 40, rot: 0, dur: 11, delay: -5, move: "orbit" },
  { x: 70, y: 4, size: 30, rot: 14, dur: 10, delay: -2, move: "bob" },
  { x: 88, y: 11, size: 38, rot: -8, dur: 13, delay: -6, move: "drift" },
  { x: 11, y: 27, size: 42, rot: 10, dur: 12, delay: -1, move: "orbit" },
  { x: 38, y: 33, size: 28, rot: -14, dur: 9, delay: -4, move: "bob" },
  { x: 63, y: 29, size: 36, rot: 6, dur: 14, delay: -7, move: "drift" },
  { x: 90, y: 35, size: 30, rot: 12, dur: 10, delay: -3, move: "orbit" },
  { x: 4, y: 52, size: 32, rot: -6, dur: 11, delay: -8, move: "drift" },
  { x: 27, y: 58, size: 40, rot: 12, dur: 13, delay: -2, move: "bob" },
  { x: 53, y: 53, size: 30, rot: -10, dur: 9, delay: -6, move: "orbit" },
  { x: 80, y: 58, size: 44, rot: 4, dur: 12, delay: -1, move: "drift" },
  { x: 14, y: 79, size: 36, rot: -4, dur: 10, delay: -5, move: "orbit" },
  { x: 40, y: 85, size: 32, rot: 14, dur: 13, delay: -9, move: "bob" },
  { x: 66, y: 80, size: 40, rot: -12, dur: 11, delay: -3, move: "drift" },
  { x: 90, y: 86, size: 34, rot: 8, dur: 9, delay: -7, move: "bob" },
];

/**
 * Soft, slowly floating doodles behind the whole app (kittens, dogs, aliens, money or microscopes, chosen by
 * the student). They sit behind every screen, ignore taps, and are faint enough not to compete with the
 * content. Only transforms are animated, and the animation stops entirely for people who prefer reduced motion.
 */
export default function DoodleField({ doodle }) {
  const set = DOODLE_SETS[doodle];
  if (!set) return null;
  return (
    <div className="doodle-field" aria-hidden="true" data-doodle={doodle}>
      {SLOTS.map((slot, i) => {
        const Icon = set[i % set.length];
        return (
          <span
            key={i}
            className={`doodle doodle-${slot.move}`}
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: slot.size,
              height: slot.size,
              "--rot": `${slot.rot}deg`,
              "--dur": `${slot.dur}s`,
              "--delay": `${slot.delay}s`,
            }}
          >
            <Icon width="100%" height="100%" />
          </span>
        );
      })}
    </div>
  );
}
