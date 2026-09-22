const { z } = require("zod");

// Nile University ID numbers are exactly 9 digits, e.g. 252120246. This
// only checks the format is well-formed — it does not (and cannot,
// without access to the university's registrar system) confirm the ID
// belongs to a real, currently-enrolled student or staff member. Real
// access control is the @nileuniversity.edu.ng email requirement at
// signup; this just keeps obviously-fake entries out.
const ID_NUMBER_PATTERN = /^\d{9}$/;

const idNumberSchema = z
  .string()
  .trim()
  .regex(ID_NUMBER_PATTERN, "ID number must be exactly 9 digits, e.g. 252120246.")
  .optional();

module.exports = { idNumberSchema, ID_NUMBER_PATTERN };
