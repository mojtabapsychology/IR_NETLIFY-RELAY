const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Render relay online");
});

app.use((req, res) => {
  res.send("Render relay online");
});

const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`Running on port ${port}`);
});
