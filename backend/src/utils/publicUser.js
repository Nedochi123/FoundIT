const { isAdminAccount } = require("./admin");
const { isMonitorAccount } = require("./monitor");
const { THEMES, DOODLES, DEFAULT_THEME, DEFAULT_DOODLE } = require("./themes");
const db = require("../../db");
const { getSchool, allowedEmailDomain } = require("../config/schools");

function universityOf(schoolId) {
  const school = getSchool(schoolId);
  return { id: school.id, name: school.name, emailDomain: allowedEmailDomain(school) };
}

/** The user as the app is allowed to see it (never the password hash or other internals). */
function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    idNumber: row.id_number,
    emailVerified: !!row.email_verified_at,
    tokens: row.tokens,
    isAdmin: isAdminAccount(row),
    isMonitor: isMonitorAccount(row), // the owner account (verified email): may open the owner page
    theme: THEMES.includes(row.theme) ? row.theme : DEFAULT_THEME,
    doodle: DOODLES.includes(row.doodle) ? row.doodle : DEFAULT_DOODLE,
    // The university this account belongs to, decided here on the server (the database the account lives in), never by
    // the device: the app shows it as the student's private university space.
    school: universityOf(db.currentSchoolId()),
  };
}

module.exports = { publicUser };
