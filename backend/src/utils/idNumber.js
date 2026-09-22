const { z } = require("zod");

// Nile University ID numbers follow NUN/<year>/<sequence>, e.g. NUN/2024/001.
// This only checks the format is well-formed — it does not (and cannot,
// without access to the university's registrar system) confirm the ID
// belongs to a real, currently-enrolled student or staff member. Real
// access control is the @nileuniversity.edu.ng email requirement at
// signup; this just keeps obviously-fake entries out.
const ID_NUMBER_PATTERN = /^NUN\/\d{4}\/\d{2,6}$/i;

const idNumberSchema = z
  .string()
  .trim()
  .regex(ID_NUMBER_PATTERN, "ID number must look like NUN/2024/001.")
  .transform((value) => value.toUpperCase())
  .optional();

module.exports = { idNumberSchema, ID_NUMBER_PATTERN };
