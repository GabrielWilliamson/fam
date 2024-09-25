import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { exec } from "child_process";
import fs from "fs";
import nodemailer from "nodemailer";
import { readdir, unlink } from "node:fs/promises";
import { join } from "path";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "../db/db";

export const dataRoute = new Hono<{ Variables: authVariables }>()
  //backup
  .post("/backup", async (c) => {
    const user = c.get("user");

    if (!user || user.role !== "ADMIN") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }
    console.log(user.email);

    try {
      await backupDatabase();
      await compressBackup();
      await sendBackupEmail(user.email);
      await cleanUpBackups();

      return c.json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error(`Error en el proceso de respaldo:`);
      return c.json({
        success: false,
        error: "Error al realizar el respaldo.",
      });
    }
  })
  //resotore
  .post("/restore", async (c) => {
    const user = c.get("user");

    if (!user || user.role !== "ADMIN") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    try {
      await restoreDatabase();

      return c.json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error(`Error en el proceso de restauración:`);
      return c.json({
        success: false,
        error: "Error al realizar la restauración.",
      });
    }
  });

function restoreDatabase(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    //borrar todo
    const data = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );

    const script = `
      #!/bin/bash
      # Variables
      DB_NAME="famed"
      DB_USER="postgres"
      DUMP_FILE="/home/gabriel/Desktop/backup.dump"

      echo "Vaciar todas las tablas..."
      psql -U $DB_USER -d $DB_NAME -c "
            DO \$\$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END
            \$\$; "


      echo "Restaurando nuevos datos..."
      pg_restore -U $DB_USER -d $DB_NAME --clean --no-owner $DUMP_FILE
    `;

    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al restaurar la base de datos: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.log(`stderr ===> ${stderr}`);
      }
      console.log(`Output:\n${stdout}`);
      resolve();
    });
  });
}

function backupDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(
      `pg_dump -U postgres -h localhost -F c -b -v -f ./backup/backup.dump famed`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error al hacer el respaldo: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.log(`stderr ===> ${stderr}`);
        }
        console.log(`Output:\n${stdout}`);
        resolve(); // Resolvemos la promesa al completar la operación
      },
    );
  });
}

function compressBackup(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec("gzip ./backup/backup.dump", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al comprimir el respaldo: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.log(`stderr ===> ${stderr}`);
      }
      console.log(`Output:\n${stdout}`);
      resolve(); // Resolvemos la promesa al completar la operación
    });
  });
}

async function sendBackupEmail(email: string): Promise<void> {
  try {
    const { SMTP_EMAIL, SMTP_GMAIL_PASS } = process.env;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"CLINICA DE ESPECIALIDADES FAMED" <verification@test.com>',
      to: email,
      subject: `Respaldo de base de datos`,
      text: "Adjunto encontrarás el respaldo de la base de datos.",
      attachments: [
        {
          filename: path.basename("./backup/backup.dump.gz"),
          path: "./backup/backup.dump.gz",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log("Correo enviado con éxito");
  } catch (error) {
    console.error(`Error al enviar el correo`);
    throw error;
  }
}

async function cleanUpBackups(): Promise<void> {
  try {
    const directoryPath = "./backup";
    await deleteAllFilesInDirectory(directoryPath);
  } catch (e) {
    console.error(`Error al eliminar los archivos de respaldo`);
  }
}

async function deleteAllFilesInDirectory(directoryPath: string): Promise<void> {
  try {
    const files = await readdir(directoryPath);

    for (const file of files) {
      const filePath = join(directoryPath, file);
      await unlink(filePath);
    }

    console.log("Todos los archivos han sido borrados.");
  } catch (error) {
    console.error("Error al borrar los archivos:");
    throw error;
  }
}
