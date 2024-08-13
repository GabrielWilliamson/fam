import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { mkdir } from "node:fs/promises";
import path from "path";
import CryptoHasher from "bun";
import { db } from "../db/db";
import { Queries } from "../db/schemas";
import { eq } from "drizzle-orm";
import doctorIdentification from "../lib/doctorIdentification";
import type { resource } from "../types/queries";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectAclCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import dotenv from "dotenv";
dotenv.config();

const region = process.env.AWS_BUCKET_REGION!;
const bucketName = process.env.AWS_BUCKET_NAME!;
const accessKeyId = process.env.AWS_ACCESS_KEY!;
const secretAccessKey = process.env.AWS_ACCESS_KEY!;

export const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

export const mediaRoute = new Hono<{ Variables: authVariables }>()

  .post("/resources/:queryId", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "No se encontro el usuario" }, 401);
    if (user.role !== "DOCTOR") return c.json({ error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const queryId = c.req.param("queryId");
    if (!queryId) return c.json({ error: "No se encontro el query" }, 400);

    //validar que esa querie exista y que tenga acceso a ella

    const body = await c.req.parseBody();
    console.log(body);

    const files: Blob[] = [];

    // Recorrer las entradas del objeto
    Object.entries(body).forEach(([key, value]) => {
      if (key.startsWith("files[") && value instanceof Blob) {
        files.push(value);
      }
    });

    files.map((file) => {
      console.log(file.name);
    });

    if (!files.length) {
      return c.json({ error: "No se subieron archivos" }, 400);
    }

    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];

    try {
      for (const file of files) {
        const fileName = CryptoHasher.hash(file.name, 32).toString();
        const filePath = path.join(uploadDir, fileName);
        const arrayBuffer = await file.arrayBuffer();
        await upload(arrayBuffer, fileName, file.type);
        uploadedFiles.push(filePath);
        saveIdResources(fileName, queryId);
      }

      return c.json({ success: true, files: uploadedFiles });
    } catch (error) {
      console.error("Error al subir los archivos:", error);
      return c.json({ error: "Falló la subida de los archivos" }, 500);
    }
  })

  .get("/resources/:queryId", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "No se encontro el usuario" }, 401);
    if (user.role !== "DOCTOR") return c.json({ error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ error: "No autorizado" }, 401);

    const queryId = c.req.param("queryId");
    if (!queryId) return c.json({ error: "No se encontro el query" }, 400);

    const resources = await db
      .select({
        currentResources: Queries.resources,
      })
      .from(Queries)
      .where(eq(Queries.id, queryId));

    if (resources.length < 0) return c.json({ resources: [] }, 200);

    const list = resources[0].currentResources;

    if (!list) return c.json({ resources: [] }, 200);
    if (list.length < 0) return c.json({ resources: [] }, 200);

    const current = await getResources(list);
    // console.log(current);
    return c.json({ resources: current }, 200);
  });

export default mediaRoute;

async function upload(
  arrayBuffer: ArrayBuffer,
  name: string,
  contentType: string
) {
  const uint8Array = new Uint8Array(arrayBuffer);

  const params = {
    Bucket: bucketName,
    Body: uint8Array,
    Key: name,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(params);

  return s3.send(command);
}

async function saveIdResources(fileId: string, queryId: string) {
  const [resources] = await db
    .select({
      currentResources: Queries.resources,
    })
    .from(Queries)
    .where(eq(Queries.id, queryId));

  const resourcesArray = resources.currentResources || [];
  if (!resourcesArray.includes(fileId)) {
    await db
      .update(Queries)
      .set({ resources: [...resourcesArray, fileId] })
      .where(eq(Queries.id, queryId));
  }
}

const getResources = async (list: string[]): Promise<resource[]> => {
  const resourcePromises = list.map(async (idResource: string) => {
    const command = new GetObjectAclCommand({
      Bucket: bucketName,
      Key: idResource,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return { id: idResource, url };
  });

  // Espera a que todas las promesas se resuelvan
  const resources = await Promise.all(resourcePromises);
  return resources;
};

