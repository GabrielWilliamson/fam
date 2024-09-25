import nodemailer from "nodemailer";

const createTransporter = () => {
  const { SMTP_EMAIL, SMTP_GMAIL_PASS } = process.env;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_GMAIL_PASS,
    },
  });
};

const sendEmail = async (emailData: nodemailer.SendMailOptions) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(emailData);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const { HOST } = process.env;
  const emailData = {
    from: '"CLINICA DE ESPECIALIDADES FAMED" <verification@test.com>',
    to: email,
    subject: "Verificación de Email",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #007bff;">Verifica tu Email</h2>
        <p>¡Gracias por usar esta app!</p>
        <p>Para verificar tu email, haz clic en el siguiente enlace:</p>
        <a href="${HOST}/verify?email=${email}&token=${token}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">Verificar Ahora</a>
        <p style="margin-top: 20px;">Por tu seguridad, te recomendamos cambiar tu clave después de verificar tu cuenta.</p>
      </div>
    `,
  };

  await sendEmail(emailData);
};

export const sendForgotEmail = async (email: string, token: string) => {
  const { HOST } = process.env;
  const emailData = {
    from: '"CLINICA DE ESPECIALIDADES FAMED" <verification@test.com>',
    to: email,
    subject: "Recuperación de clave",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <h2 style="color: #007bff;">Recupera tu clave</h2>
        <p>Hemos recibido una solicitud para restablecer tu clave.</p>
        <p>Para continuar con el proceso, haz clic en el siguiente enlace:</p>
        <a href="${HOST}/reset?email=${email}&token=${token}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">Restablecer Contraseña</a>
        <p style="margin-top: 20px;">Por razones de seguridad, te recomendamos cambiar tu clave después de restablecerla.</p>
      </div>
    `,
  };

  await sendEmail(emailData);
};
