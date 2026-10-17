const { z } = require("zod");
const { getSchool, DEFAULT_SCHOOL_ID } = require("../config/schools");

// Each school has its own ID number format (see config/schools.js).
// This only checks the format is well-formed. It does not (and cannot, without access to the school's registrar
// system) confirm the ID belongs to a real, currently-enrolled student or staff member. Real access control is
// the school-email requirement at signup; this just keeps obviously-fake entries out.
function idNumberSchemaFor(schoolOrId) {
  const school = typeof schoolOrId === "string" || !schoolOrId ? getSchool(schoolOrId) : schoolOrId;
  return z.string().trim().regex(school.idPattern, school.idMessage).optional();
}

// Until the server knows a request's school, everything is the default school's.
const ID_NUMBER_PATTERN = getSchool(DEFAULT_SCHOOL_ID).idPattern;
const idNumberSchema = idNumberSchemaFor(DEFAULT_SCHOOL_ID);

module.exports = { idNumberSchema, idNumberSchemaFor, ID_NUMBER_PATTERN };
