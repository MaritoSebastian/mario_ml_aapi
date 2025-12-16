import express from "express";
const app = express();

app.get("/", (req, res) => {
  res.send("Backend funcionando OK");
});

app.get("/callback", (req, res) => {
  res.send("Callback OK");
});

export default app;
