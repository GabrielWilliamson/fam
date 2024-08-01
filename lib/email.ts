import nodemailer from "nodemailer";

export const sendVerificationEmail = async (email: string, token: string) => {
  const { SMPT_EMAIL, SMTP_GMAIL_PASS, HOST } = process.env;
  var transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMPT_EMAIL,
      pass: SMTP_GMAIL_PASS,
    },
  });

  const emailData = {
    from: '"CLINICA DE ESPECIALIDADES FAMED" <verification@test.com>',
    to: email,
    subject: "Verificación de Email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <p>¡Gracias por registrarte en nuestro servicio de salud!</p>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <a href="${HOST}/verify?email=${email}&token=${token}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">Verificar Ahora</a>
        <p style="margin-top: 20px;">Después de verificar tu correo electrónico, te recomendamos cambiar tu contraseña por seguridad.</p>
      </div>
    `,
  };

  try {
    const info = await transport.sendMail(emailData);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};
