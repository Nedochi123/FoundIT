require("./instrument");
const app = require("./app");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`FoundIT backend listening on http://localhost:${PORT}`);
  console.log(`Allowed client origin: ${process.env.CLIENT_ORIGIN || "http://localhost:5173"}`);
});
