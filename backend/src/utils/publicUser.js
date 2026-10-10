const { isAdminAccount } = require("./admin");
const { isMonitorAccount } = require("./monitor");
const { THEMES, DOODLES, DEFAULT_THEME, DEFAULT_DOODLE } = require("./themes");

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
  };
}

module.exports = { publicUser };
