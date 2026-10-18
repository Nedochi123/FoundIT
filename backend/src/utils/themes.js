// The looks a student can choose for their app: a color theme and a style of floating doodles. The choice is
// purely cosmetic and saved on the account so it follows them to any device. The same lists (and the CSS for
// each color) live in frontend/src/lib/themes.js; add new ones in both places.
// "baze" is Baze University's own colors: the default for Baze students (see frontend/src/lib/schools.js)
const THEMES = ["classic", "pink", "camo", "black", "blue", "red", "purple", "green", "lightpink", "lightpurple", "baze"];
const DOODLES = ["none", "kittens", "dogs", "aliens", "money", "science"];

const DEFAULT_THEME = "classic"; // today's look
const DEFAULT_DOODLE = "none";

module.exports = { THEMES, DOODLES, DEFAULT_THEME, DEFAULT_DOODLE };
