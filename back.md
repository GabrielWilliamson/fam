const { exec } = require('child_process');
const fs = require('fs');
const nodemailer = require('nodemailer');
const path = require('path');

// Variables de configuración
const DB_NAME = 'tu_basededatos';
const DB_USER = 'tu_usuario';
const BACKUP_DIR = '/tmp';
const BACKUP_FILE = path.join(BACKUP_DIR, `${DB_NAME}-backup-${Date.now()}.sql`);
const COMPRESSED_FILE = `${BACKUP_FILE}.gz`;
const EMAIL_RECIPIENT = 'destino@gmail.com';
const EMAIL_SENDER = 'tucorreo@gmail.com';
const EMAIL_PASSWORD = 'tu_contraseña_gmail';  // Usa contraseñas de aplicación de Gmail

// Función para respaldar la base de datos
function backupDatabase() {
  return new Promise((resolve, reject) => {
    const backupCommand = `pg_dump -U ${DB_USER} ${DB_NAME} > ${BACKUP_FILE}`;
    exec(backupCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al realizar el respaldo: ${stderr}`);
        return reject(error);
      }
      console.log('Respaldo completado con éxito');
      resolve();
    });
  });
}

// Función para comprimir el respaldo
function compressBackup() {
  return new Promise((resolve, reject) => {
    const compressCommand = `gzip ${BACKUP_FILE}`;
    exec(compressCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al comprimir el respaldo: ${stderr}`);
        return reject(error);
      }
      console.log('Compresión completada con éxito');
      resolve();
    });
  });
}

// Función para enviar el respaldo por correo
async function sendBackupEmail() {
  try {
    // Crear transportador de nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_SENDER,
        pass: EMAIL_PASSWORD,
      },
    });

    // Configurar los detalles del correo
    const mailOptions = {
      from: EMAIL_SENDER,
      to: EMAIL_RECIPIENT,
      subject: `Respaldo de base de datos ${DB_NAME}`,
      text: 'Adjunto encontrarás el respaldo de la base de datos.',
      attachments: [
        {
          filename: path.basename(COMPRESSED_FILE),
          path: COMPRESSED_FILE,
        },
      ],
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);
    console.log('Correo enviado con éxito');
  } catch (error) {
    console.error(`Error al enviar el correo: ${error.message}`);
  }
}

// Proceso principal de respaldo y envío
async function main() {
  try {
    await backupDatabase();        // Respaldar la base de datos
    await compressBackup();        // Comprimir el respaldo
    await sendBackupEmail();       // Enviar el respaldo comprimido por correo

    // Limpiar el archivo comprimido después de enviar el correo
    fs.unlinkSync(COMPRESSED_FILE);
    console.log('Archivo de respaldo eliminado del servidor');
  } catch (error) {
    console.error(`Ocurrió un error: ${error.message}`);
  }
}

main();
