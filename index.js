import express from "express";

const app = express();

app.get("/auth/callback", (req, res) => {
  const code = req.query.code;
  res.send(`Callback funcionando! Code recibido: ${code}`);
});

app.listen(3000, () => console.log("Servidor corriendo en puerto 3000"));
