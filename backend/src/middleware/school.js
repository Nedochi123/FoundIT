const db = require("../../db");
const { SCHOOLS, DEFAULT_SCHOOL_ID } = require("../config/schools");

// Decides which school each API request is for, and runs the rest of the request inside that school, so every
// db.prepare() it makes reaches that school's own database (see db/index.js).
//
// The website sends the school the student picked as an "X-School" header. A request without one is the default
// school's: that is how the app worked before there were several schools, so phones still running an older copy of the
// website keep working. An unknown school is refused, and so is a school that is not open yet: its database exists, but
// nobody can reach it until it opens.
function schoolContext(req, res, next) {
  const raw = req.get("X-School");
  const id = raw === undefined || raw.trim() === "" ? DEFAULT_SCHOOL_ID : raw.trim().toLowerCase();
  const school = SCHOOLS.find((s) => s.id === id);
  if (!school) return res.status(400).json({ error: "Unknown school." });
  if (!school.enabled) return res.status(403).json({ error: `${school.name} isn't open on FoundIT yet.` });
  req.school = school;
  return db.runWithSchool(school.id, () => next());
}

/**
 * Puts the rest of a request back inside its school. Used after things that call back from a stream or socket event (a
 * photo upload, a "finished" listener). Today's Node keeps the school through those (the tests pass without this), but
 * that depends on how each library schedules its callbacks, and a slip would put a school's data in the default
 * school's database, so these places say which school they are for explicitly.
 */
function inSchool(req, fn) {
  return db.runWithSchool(req.school?.id || DEFAULT_SCHOOL_ID, fn);
}

module.exports = { schoolContext, inSchool };
