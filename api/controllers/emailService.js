import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendResetCode = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"Paraguay Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Código para recuperar tu contraseña",
      text: `Tu código de verificación es: ${code}. Expira en 10 minutos.`,
      html: `<p>Tu código es: <strong>${code}</strong></p><p>Expira en 10 minutos.</p>`,
    });
    
    console.log(`✅ Código enviado a ${email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error email:", error);
    return { success: false, error: error.message };
  }
};

export const sendResetCodeDev = async (email, code) => {
  console.log(`\n📧 Código para ${email}: ${code}\n`);
  return { success: true };
};