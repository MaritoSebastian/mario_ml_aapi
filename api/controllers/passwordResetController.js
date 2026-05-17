// controllers/passwordResetController.js
import bcrypt from "bcrypt";
import generateCode from "./generateCode.js";
import { sendResetCode, sendResetCodeDev } from "./emailService.js";

// 1. Solicitar código de recuperación
export const solicitarReset = async (req, res) => {
  try {
    const db = await req.app.locals.getDB();
    const { email } = req.body;

    // Validar email
    if (!email) {
      return res.status(400).json({ error: "EMAIL_REQUERIDO" });
    }

    // Verificar que el usuario existe
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "USUARIO_NO_EXISTE" });
    }

    // Eliminar códigos anteriores no usados del mismo email
    await db.collection("password_resets").deleteMany({
      email: email,
      used: false,
    });

    // Generar nuevo código
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expira en 10 minutos

    // Guardar en DB
    await db.collection("password_resets").insertOne({
      email,
      code,
      attempts: 0,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    // Determinar si estamos en desarrollo
    const isDev = process.env.NODE_ENV === "development" || !process.env.EMAIL_USER;
    
    let emailResult;
    if (isDev) {
      emailResult = await sendResetCodeDev(email, code);
    } else {
      emailResult = await sendResetCode(email, code);
    }

    if (!emailResult.success) {
      return res.status(500).json({ error: "ERROR_ENVIAR_EMAIL" });
    }

    res.json({
      ok: true,
      message: "CODIGO_ENVIADO",
      // Solo para desarrollo: devolver el código (útil para testing)
      ...(isDev && { devCode: code }),
    });
  } catch (error) {
    console.error("SOLICITAR_RESET_ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Verificar código
export const verificarCodigo = async (req, res) => {
  try {
    const db = await req.app.locals.getDB();
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "EMAIL_Y_CODIGO_REQUERIDOS" });
    }

    // Buscar el código
    const resetRequest = await db.collection("password_resets").findOne({
      email,
      code,
      used: false,
    });

    if (!resetRequest) {
      return res.status(400).json({ error: "CODIGO_INVALIDO" });
    }

    // Verificar expiración
    if (new Date() > resetRequest.expiresAt) {
      return res.status(400).json({ error: "CODIGO_EXPIRADO" });
    }

    // Verificar intentos
    if (resetRequest.attempts >= 3) {
      await db.collection("password_resets").updateOne(
        { _id: resetRequest._id },
        { $set: { used: true } }
      );
      return res.status(400).json({ error: "DEMASIADOS_INTENTOS" });
    }

    // Incrementar intentos
    await db.collection("password_resets").updateOne(
      { _id: resetRequest._id },
      { $inc: { attempts: 1 } }
    );

    res.json({
      ok: true,
      valid: true,
      message: "CODIGO_VALIDO",
    });
  } catch (error) {
    console.error("VERIFICAR_CODIGO_ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// 3. Resetear contraseña
export const resetearPassword = async (req, res) => {
  try {
    const db = await req.app.locals.getDB();
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "DATOS_INCOMPLETOS" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "PASSWORD_DEMASIADO_CORTA" });
    }

    // Verificar el código nuevamente
    const resetRequest = await db.collection("password_resets").findOne({
      email,
      code,
      used: false,
    });

    if (!resetRequest) {
      return res.status(400).json({ error: "CODIGO_INVALIDO" });
    }

    if (new Date() > resetRequest.expiresAt) {
      return res.status(400).json({ error: "CODIGO_EXPIRADO" });
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar usuario
    await db.collection("users").updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    // Marcar código como usado
    await db.collection("password_resets").updateOne(
      { _id: resetRequest._id },
      { $set: { used: true } }
    );

    res.json({
      ok: true,
      message: "CONTRASEÑA_ACTUALIZADA",
    });
  } catch (error) {
    console.error("RESETEAR_PASSWORD_ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};