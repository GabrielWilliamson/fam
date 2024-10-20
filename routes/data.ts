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
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const { DB_USER, DB_NAME, PASS } = process.env;

const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => ["application/gzip"].includes(file.type), {
      message: "archivo debe ser un archivo .gz",
    }),
});

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
  .post("/restore", zValidator("form", fileSchema), async (c) => {
    const user = c.get("user");

    if (!user || user.role !== "ADMIN") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }
    const { file } = c.req.valid("form");
    const copysDir = join(process.cwd(), "copys");

    try {
      //received file
      console.info("Copying file...");
      const filePath = join(copysDir, "copy.dump.gz");
      await Bun.write(filePath, await file.arrayBuffer());

      //unzip
    } catch (error) {
      console.error(`Error en el proceso de restauración:`);
    }

    try {
      console.info("Uncompressing file...");
      await uncompressBackup();

      //validar que sea de type dump

      console.info("truncated tables");
      await truncateTables();

      console.info("Restoring database...");
      await restoreDatabase();

      console.info("delete copys");
      await deleteAllFilesInDirectory(copysDir);

      return c.json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error(`Error en el proceso de restauración:`, error);
      return c.json({
        success: false,
        error: "Error al realizar la restauración.",
      });
    }
  });

function truncateTables(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const script = `
    #!/bin/bash
    DB_NAME="${DB_NAME}"
    DB_USER="${DB_USER}"


    # Truncar tablas en el esquema public
    tables_public=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")

    for table in $tables_public; do
      echo "Truncando tabla en public: $table"
      psql -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE \"public\".\"$table\" CASCADE;" 2>/dev/null || echo "Tabla $table no existe, omitiendo."
    done

    # Truncar tablas en el esquema drizzle
    psql -U "$DB_USER" -d "$DB_NAME" -c "TRUNCATE TABLE \"drizzle\".\"__drizzle_migrations\" CASCADE;" 2>/dev/null || echo "Tabla __drizzle_migrations no existe, omitiendo."

    `;
    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error truncated tables: ${error.message}`);
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

function restoreDatabase(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const copysDir = join(process.cwd(), "copys");
    const fileCopyPath = join(copysDir, "copy.dump");

    const script = `
      #!/bin/bash
      DB_NAME="${DB_NAME}"
      DB_USER="${DB_USER}"
        pg_restore -U "${DB_USER}" -d "${DB_NAME}"  --clean   "${fileCopyPath}"
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
      `PGPASSWORD=${PASS} pg_dump -U ${DB_USER} -h localhost -F c -b -v -f ./backup/backup.dump ${DB_NAME}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error al hacer el respaldo: ${error.message}`);
          console.error(`Detalles del error: ${error}`);
          return reject(error);
        }
        if (stderr) {
          console.warn(`Advertencia de pg_dump:\n${stderr}`);
        }
        console.log(`Resultado de pg_dump:\n${stdout}`);
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

async function uncompressBackup(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec("gunzip ./copys/copy.dump.gz", (error, stdout, stderr) => {
      if (error) {
        console.error(
          `Error al descomprimir la copia de seguridad: ${error.message}`,
        );
        return reject(new Error(`Error al descomprimir: ${error.message}`));
      }

      if (stderr) {
        console.info(
          `Advertencia al descomprimir la copia de seguridad: ${stderr}`,
        );
      }

      console.log(
        `Copia de seguridad descomprimida exitosamente. Output:\n${stdout}`,
      );
      resolve();
    });
  });
}
