export const verificarWebhook = (req, res) => {
  console.log("ENTRÓ AL WEBHOOK DE WHATSAPP");

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFICADO CORRECTAMENTE");

    return res.status(200).send(challenge);
  }

  console.log("ERROR EN VERIFICACIÓN DEL WEBHOOK");

  return res.sendStatus(403);
};
export const recibirWebhook = (req, res) => {
  console.log("📩 Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).send("EVENT_RECEIVED");
};