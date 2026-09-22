// FoundIT has no reference data to seed (unlike Pup Facts' breeds/training
// content) — lost and found items are entirely user-generated. This file
// still exists, run on every boot via railway.json's startCommand, purely
// to trigger db/index.js's schema init + migrations before the server
// starts, and as a ready place to add reference data later (e.g. a fixed
// list of item categories) without touching the deploy command again.
require("./index");
console.log("Schema ready. Nothing to seed.");
