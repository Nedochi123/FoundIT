// The schools FoundIT serves. This is the ONE place that knows a school's name, email ending, logo and colors:
// every screen reads from here, so adding a university later means adding one entry (plus its database on the
// server, see backend/src/config/schools.js, which must agree with this list: test/consistency.test.mjs).
//
// enabled:      the school's section is live. A school that is not enabled still shows on the Welcome page, marked
//               "opening soon", so students can see it is coming.
// emailDomain:  what a student's school email ends with: the school's own domain, checked to exist and to receive mail.
//               (null would mean "not known yet": the sign-up box then shows "Your school email" and nothing is invented.)
// logo:         the school's official badge (its crest or seal), a 256x256 PNG in public/schools/, taken from the
//               school's own website. If the file is missing the Welcome page draws a colored initial instead
//               (SchoolMark), so a missing logo never leaves a hole.
// badge:        the color behind the logo. White unless the official logo is itself white (Philomath).
// theme:        the school's own app colors (an id in lib/themes.js), shown to its students until they pick another.
//               No theme = the original FoundIT look.
// emailLocal:   what comes before the @ in an example email (default "yourIDnumber").
// color/markText: the school's own color (taken from its website) and the text color that reads on it.

export const SCHOOLS = [
  {
    id: "nile",
    name: "Nile University",
    short: "Nile",
    emailDomain: "nileuniversity.edu.ng",
    idFormat: { pattern: "\\d{9}", maxLength: 9, inputMode: "numeric", example: "123456789", hint: "9 digits, e.g. 123456789" },
    logo: "/schools/nile.png",
    mark: "N",
    color: "#1c9bb8",
    markText: "#04141c",
    enabled: true,
  },
  {
    id: "baze",
    name: "Baze University",
    short: "Baze",
    emailDomain: "bazeuniversity.edu.ng",
    emailLocal: "surname12345", // a Baze student email is the surname followed by the ID number
    idFormat: { pattern: "\\d{4,8}", maxLength: 8, inputMode: "numeric", example: "12345", hint: "digits only, e.g. 12345" },
    theme: "baze", // Baze's own colors (lib/themes.js): what a Baze student sees until they pick another
    logo: "/schools/baze.png",
    mark: "B",
    color: "#9c9fa6",
    markText: "#17181b",
    enabled: true,
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan University",
    short: "Cosmopolitan",
    emailDomain: "cosmopolitan.edu.ng",
    logo: "/schools/cosmopolitan.png",
    mark: "C",
    color: "#a18b5c",
    markText: "#06222f",
    enabled: false,
  },
  {
    id: "philomath",
    name: "Philomath University",
    short: "Philomath",
    emailDomain: "philomath.edu.ng",
    logo: "/schools/philomath.png",
    badge: "#000c42", // Philomath's official crest is the white version, so its badge is the school's navy instead of white
    mark: "P",
    color: "#1d3f7c",
    markText: "#ffffff",
    enabled: false,
  },
  {
    id: "veritas",
    name: "Veritas University",
    short: "Veritas",
    emailDomain: "veritas.edu.ng",
    logo: "/schools/veritas.png",
    mark: "V",
    color: "#095d3f",
    markText: "#ffffff",
    enabled: false,
  },
];

export const DEFAULT_SCHOOL_ID = "nile";
const STORAGE_KEY = "foundit_school";

// A school's ID numbers. Nile's are exactly 9 digits. For a school whose format is not known yet, any sensible
// ID is accepted (letters, digits, "/" or "-", 4 to 20 characters, as printed on many Nigerian student cards)
// until its real format is added to its entry above as idFormat.
const LENIENT_ID_FORMAT = {
  pattern: "[A-Za-z0-9/-]{4,20}",
  maxLength: 20,
  inputMode: "text",
  example: null,
  hint: "your school ID number (letters, numbers, / or -)",
};

/** The school's ID number rules: what the typing boxes accept and say. */
export function idFormat(school) {
  return school?.idFormat || LENIENT_ID_FORMAT;
}

/** The props for an ID number text box, so every screen asks for it the same way and in the school's format. */
export function idInputProps(school) {
  const f = idFormat(school);
  return {
    inputMode: f.inputMode,
    maxLength: f.maxLength,
    placeholder: f.example || "Your ID number",
    pattern: f.pattern,
    title: `Format: ${f.hint}`,
  };
}

/** The short line under an ID number box, e.g. "Format: 9 digits, e.g. 123456789". */
export function idHint(school) {
  return `Format: ${idFormat(school).hint}`;
}

/** The school with this id, or the default school for anything unknown (an old or edited saved value). */
export function getSchool(id) {
  return SCHOOLS.find((s) => s.id === id) || SCHOOLS.find((s) => s.id === DEFAULT_SCHOOL_ID);
}

/** The school's section is live, so a student can sign in or sign up there. */
export function isOpen(school) {
  return Boolean(school?.enabled);
}

/** A sample school email for a placeholder, e.g. "yourIDnumber@nileuniversity.edu.ng". */
export function emailExample(school) {
  return school?.emailDomain ? `${school.emailLocal || "yourIDnumber"}@${school.emailDomain}` : "Your school email";
}

/**
 * The address in a QR sticker's code. The default school's stickers stay exactly as they always were (/t/CODE), so every
 * sticker already printed keeps working; other schools' say which school they belong to (/t/CODE?school=baze).
 */
export function tagUrl(origin, code, school) {
  const named = school && school.id !== DEFAULT_SCHOOL_ID ? `?school=${encodeURIComponent(school.id)}` : "";
  return `${origin}/t/${code}${named}`;
}

/** Who to hand a found item to when the owner can't be reached: always named with the school. */
export function handInTo(school) {
  return `${school.name} campus security`;
}

/**
 * The school named in the page address (?school=...), if it is a known, open school. Links in FoundIT's emails (verify
 * your email, reset your password) and QR stickers of schools other than the default carry it, so they open in the
 * right school even on a phone that has never picked one.
 */
export function readSchoolFromUrl() {
  try {
    const id = new URLSearchParams(window.location.search).get("school");
    const school = SCHOOLS.find((s) => s.id === id);
    return school && isOpen(school) ? school.id : null;
  } catch {
    return null;
  }
}

/** The school this device chose last, or null if none (or the saved value is not an open school). */
export function readChosenSchoolId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    const school = SCHOOLS.find((s) => s.id === id);
    return school && isOpen(school) ? school.id : null;
  } catch {
    return null;
  }
}

export function rememberSchoolId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // private browsing: the Welcome page simply shows again next time
  }
}

export function forgetSchoolId() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing saved, nothing to forget
  }
}
