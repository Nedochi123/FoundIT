import {
  Cat,
  Dog,
  Bone,
  PawPrint,
  Heart,
  Microscope,
  FlaskConical,
  Atom,
  Dna,
  Banknote,
  Coins,
  PiggyBank,
  Rocket,
  Orbit,
  Star,
  Sparkles,
} from "lucide-react";

// The floating doodles. Most are lucide line icons; the ones lucide doesn't have (a kitten face, a puppy, an
// alien, a UFO, a ball of yarn, a naira coin) are drawn here in the same 24x24 line style. They are original
// drawings (generic kittens, not any particular cartoon character).

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };

function KittenFace({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M5 9 L4.2 3.5 L9.2 5.8 Q12 5.2 14.8 5.8 L19.8 3.5 L19 9 Q20.5 11 20.5 13.5 Q20.5 20 12 20 Q3.5 20 3.5 13.5 Q3.5 11 5 9 Z" />
      <path d="M7.5 12.5 Q9 10.8 10.5 12.5 M13.5 12.5 Q15 10.8 16.5 12.5" />
      <path d="M11 14.4 H13 L12 15.5 Z" fill="currentColor" />
      <path d="M12 15.5 V16.3 M12 16.3 Q10.8 17.5 9.6 16.7 M12 16.3 Q13.2 17.5 14.4 16.7" />
      <path d="M2 13.5 L5.5 14.2 M2 16.5 L5.7 15.8 M22 13.5 L18.5 14.2 M22 16.5 L18.3 15.8" />
    </svg>
  );
}

function YarnBall({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="M4.3 8.5 Q11 13 17.7 8.5 M3.3 12.3 Q11 17.5 18.7 12.3 M7.8 4 Q10.3 11 7.8 18.3 M12.5 3.2 Q15 11 12.5 18.9" />
      <path d="M16 17.8 Q20 19 20.5 21.5 Q21 23 22.5 22.5" />
    </svg>
  );
}

function PuppyFace({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M7 6 Q12 4.4 17 6 Q19.5 9 19 14 Q18 20 12 20.5 Q6 20 5 14 Q4.5 9 7 6 Z" />
      <path d="M7.3 6.3 C3.2 6 2.2 11 3.2 14.5 C3.7 16.2 5.6 16.3 6.2 14.6 M16.7 6.3 C20.8 6 21.8 11 20.8 14.5 C20.3 16.2 18.4 16.3 17.8 14.6" />
      <circle cx="9.3" cy="11" r="0.9" fill="currentColor" />
      <circle cx="14.7" cy="11" r="0.9" fill="currentColor" />
      <ellipse cx="12" cy="14.4" rx="1.7" ry="1.1" fill="currentColor" />
      <path d="M12 15.5 V16.9 M12 16.9 Q10.6 18.3 9.3 17.3 M12 16.9 Q13.4 18.3 14.7 17.3" />
    </svg>
  );
}

function AlienHead({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M12 3 C6 3 3.4 8 4.5 12.5 C5.3 16.2 8.5 20 12 21 C15.5 20 18.7 16.2 19.5 12.5 C20.6 8 18 3 12 3 Z" />
      <path d="M6.8 10.2 C8.5 10 10.2 11.3 10.5 13 C8.6 13.6 6.8 12.4 6.8 10.2 Z M17.2 10.2 C15.5 10 13.8 11.3 13.5 13 C15.4 13.6 17.2 12.4 17.2 10.2 Z" fill="currentColor" />
      <path d="M10.6 17.2 H13.4" />
    </svg>
  );
}

function Ufo({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <path d="M7.5 10.5 C7.5 6.8 9.4 5 12 5 C14.6 5 16.5 6.8 16.5 10.5" />
      <path d="M2.8 13 C2.8 11.6 7 10.6 12 10.6 C17 10.6 21.2 11.6 21.2 13 C21.2 14.6 17 15.6 12 15.6 C7 15.6 2.8 14.6 2.8 13 Z" />
      <path d="M7.5 13.2 H7.6 M12 13.6 H12.1 M16.5 13.2 H16.6" strokeWidth={2.4} />
      <path d="M8.2 17 L6.2 21 M12 17.2 V21.5 M15.8 17 L17.8 21" />
    </svg>
  );
}

// a coin with the naira sign: an N with two bars through it
function NairaCoin({ strokeWidth = 1.6, ...props }) {
  return (
    <svg {...base} strokeWidth={strokeWidth} {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.5 16.5 V7.5 L15.5 16.5 V7.5" />
      <path d="M6.8 10.4 H17.2 M6.8 13.6 H17.2" />
    </svg>
  );
}

// the icons used for each style, in the order they are scattered
export const DOODLE_SETS = {
  kittens: [KittenFace, PawPrint, Heart, YarnBall, Cat, KittenFace, Heart],
  dogs: [PuppyFace, Bone, PawPrint, Dog, Bone, PuppyFace, PawPrint],
  aliens: [AlienHead, Ufo, Star, Orbit, AlienHead, Rocket, Sparkles],
  money: [NairaCoin, Banknote, Coins, PiggyBank, Banknote, NairaCoin, Coins],
  science: [Microscope, FlaskConical, Atom, Dna, Microscope, Atom, FlaskConical],
};

// the single icon shown on each choice in the picker
export const DOODLE_ICON = {
  kittens: KittenFace,
  dogs: PuppyFace,
  aliens: AlienHead,
  money: NairaCoin,
  science: Microscope,
};
