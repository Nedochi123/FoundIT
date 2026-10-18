const { z } = require("zod");
const db = require("../../db");
const { getSchool } = require("../config/schools");

// Each school has its own ID number format (see config/schools.js).
// This only checks the format is well-formed. It does not (and cannot, without access to the school's registrar
// system) confirm the ID belongs to a real, currently-enrolled student or staff member. Real access control is
// the school-email requirement at signup; this just keeps obviously-fake entries out.
function idNumberSchemaFor(schoolOrId) {
  const school = typeof schoolOrId === "string" || !schoolOrId ? getSchool(schoolOrId) : schoolOrId;
  return z.string().trim().regex(school.idPattern, school.idMessage).optional();
}

// The ID number of whichever school the request is for (checked when the request is read, not when the server starts).
const idNumberSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const school = getSchool(db.currentSchoolId());
    if (!school.idPattern.test(value)) ctx.addIssue({ code: "custom", message: school.idMessage });
  })
  .optional();

const ID_NUMBER_PATTERN = getSchool().idPattern; // the default school's

module.exports = { idNumberSchema, idNumberSchemaFor, ID_NUMBER_PATTERN };
