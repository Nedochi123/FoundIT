// The schools FoundIT serves, and the rules that decide who may join each one. This is the ONE place on the
// server that knows a school's name, email ending or ID format; the website keeps a matching list in
// frontend/src/lib/schools.js (frontend/test/consistency.test.mjs fails if the two drift apart).
//
// Adding a university means adding one entry here and one on the website. Its students and items live in that
// school's own database (a later step); until a school is `enabled`, nobody can sign up to it.
//
// emailDomain: what a school email must end with (null until it is confirmed with a real student email).
// idPattern:   the format of that school's ID numbers. This only checks the number is well-formed. It cannot
//              confirm that it belongs to a real, enrolled student (FoundIT cannot see a school's records): the
//              real gate is the school email address plus the verification link sent to it.

const DEFAULT_SCHOOL_ID = "nile";

// Used for a school whose real ID format is not known yet: letters, digits, "/" or "-", 4 to 20 characters.
const LENIENT_ID = {
  idPattern: /^[A-Za-z0-9/-]{4,20}$/,
  idMessage: "ID number can only use letters, numbers, / or -, and must be 4 to 20 characters.",
};

const SCHOOLS = [
  {
    id: "nile",
    name: "Nile University",
    emailDomain: "nileuniversity.edu.ng",
    // Nile ID numbers are exactly 9 digits, e.g. 123456789.
    idPattern: /^\d{9}$/,
    idMessage: "ID number must be exactly 9 digits, e.g. 123456789.",
    enabled: true,
  },
  { id: "baze", name: "Baze University", emailDomain: "bazeuniversity.edu.ng", ...LENIENT_ID, enabled: false },
  { id: "cosmopolitan", name: "Cosmopolitan University", emailDomain: null, ...LENIENT_ID, enabled: false },
  { id: "philomath", name: "Philomath University", emailDomain: null, ...LENIENT_ID, enabled: false },
  { id: "veritas", name: "Veritas University", emailDomain: null, ...LENIENT_ID, enabled: false },
];

/** The school with this id, or the default school for anything unknown. */
function getSchool(id) {
  return SCHOOLS.find((s) => s.id === id) || SCHOOLS.find((s) => s.id === DEFAULT_SCHOOL_ID);
}

/**
 * What a school email must end with, lower-case. The ALLOWED_EMAIL_DOMAIN setting (already set on the live
 * server) still decides it for the default school, exactly as before; every other school uses its own entry.
 */
function allowedEmailDomain(school) {
  const s = school || getSchool(DEFAULT_SCHOOL_ID);
  const override = s.id === DEFAULT_SCHOOL_ID ? process.env.ALLOWED_EMAIL_DOMAIN : null;
  return (override || s.emailDomain || "").toLowerCase();
}

/** True if this email belongs to the school: it ends with "@" + the school's email domain. */
function emailBelongsTo(school, email) {
  const domain = allowedEmailDomain(school);
  return Boolean(domain) && String(email).toLowerCase().endsWith(`@${domain}`);
}

/** The open school this email address belongs to, or null (a closed school never matches). */
function schoolForEmail(email) {
  return SCHOOLS.find((s) => s.enabled && emailBelongsTo(s, email)) || null;
}

module.exports = { SCHOOLS, DEFAULT_SCHOOL_ID, getSchool, allowedEmailDomain, emailBelongsTo, schoolForEmail };
