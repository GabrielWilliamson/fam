import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { mkdir } from "node:fs/promises";
import path from "path";
import CryptoHasher from "bun";
import { db } from "../db/db";
import { Files, Patients, Queries } from "../db/schemas";
import { and, eq } from "drizzle-orm";
import doctorIdentification from "../lib/doctorIdentification";
import type { resource } from "../types/queries";
import {
  getSignedUrl,
  S3RequestPresigner,
} from "@aws-sdk/s3-request-presigner";
import {
  DeleteObjectCommand,
  GetObjectAclCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const region = process.env.AWS_BUCKET_REGION!;
const bucketName = process.env.AWS_BUCKET_NAME!;
const accessKeyId = process.env.AWS_ACCESS_KEY!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

export const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

export const mediaRoute = new Hono<{ Variables: authVariables }>()

  //guardar los recursos de la consuta
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
    const files: Blob[] = [];

    // Recorrer las entradas del objeto
    Object.entries(body).forEach(([key, value]) => {
      if (key.startsWith("files[") && value instanceof Blob) {
        files.push(value);
      }
    });

    if (!files.length) {
      return c.json({ error: "No se subieron archivos" }, 400);
    }

    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    //veryfying file types
    const accept = [
      "sheet",
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
    ];

    const ready = files.every((file) => {
      return accept.includes(file.type);
    });

    if (!ready) {
      return c.json({ error: "Tipo de archivo no admitido" }, 400);
    }

    const maxSize = 3 * 1024 * 1024; // 3MB en bytes

    const allFilesWithinLimit = files.every((file) => {
      return file.size <= maxSize;
    });

    if (!allFilesWithinLimit) {
      return c.json({ error: "Los archivos exceden el tamaño maximo" }, 400);
    }

    try {
      for (const file of files) {
        const fileName = CryptoHasher.hash(file.name, 32).toString();
        const arrayBuffer = await file.arrayBuffer();
        await upload(arrayBuffer, fileName, file.type);
        saveIdResources(fileName + "." + file.type, queryId);
      }

      return c.json({ success: true, files: [] });
    } catch (error) {
      console.error("Error al subir los archivos:", error);
      return c.json({ error: "Falló la subida de los archivos" }, 500);
    }
  })
  //borrar un recurso de la consulta
  .delete("/resources/:queryId/:resourceId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { error: "No se encontro el usuario", success: false },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json({ error: "No autorizado", success: false }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ error: "No autorizado", success: false }, 401);

    const queryId = c.req.param("queryId");
    if (!queryId)
      return c.json({ error: "No se encontro el query", success: false }, 400);

    const resourceId = c.req.param("resourceId");
    if (!resourceId)
      return c.json({ error: "No se encontro el id", success: false }, 400);

    const input = {
      Bucket: bucketName,
      Key: resourceId,
    };
    const command = new DeleteObjectCommand(input);

    try {
      const s3 = new S3Client({
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });
      await s3.send(command);

      // Obtener los recursos actuales desde la base de datos
      const currentResources = await db
        .select({
          resources: Queries.resources,
        })
        .from(Queries)
        .where(eq(Queries.id, queryId));

      if (!currentResources || currentResources.length === 0) {
        return c.json(
          { error: "No se encontraron recursos", success: false },
          404
        );
      }

      // Filtrar el recurso que se debe eliminar del array
      const newResources = currentResources[0].resources?.filter(
        (resource) => resource.split(".")[0] !== resourceId
      );

      console.log(newResources, "esto estamos guardando");

      // Actualizar los recursos en la base de datos
      await db
        .update(Queries)
        .set({ resources: newResources })
        .where(eq(Queries.id, queryId));

      return c.json({ error: "", success: true });
    } catch (e) {
      console.log("error deleting file");
      return c.json(
        { error: "Error al borrar el archivo", success: false },
        500
      );
    }
  })
  //obtener los recursos de la consulta
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
    return c.json({ resources: current }, 200);
  })
  //obtener la imagen del paciente
  .get("/patient", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, data: null }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId)
      return c.json({ success: false, error: "id requerido", data: null }, 501);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);

    let patient = await db
      .select({
        image: Patients.image,
        doctorId: Patients.doctorId,
      })
      .from(Patients)
      .where(eq(Patients.id, patientId))
      .limit(1);

    if (!patient)
      return c.json(
        { success: false, error: "No se encontro el paciente", data: null },
        500
      );

    if (patient[0].doctorId !== doctorId) {
      return c.json({ success: false, error: "unauthorized", data: null }, 401);
    }

    if (!patient[0].image)
      return c.json({ success: true, error: "", data: null });

    const image = await getResource(patient[0].image);

    return c.json({ success: true, error: "", data: image });
  })
  //subir imagen del paciente
  .post("/patient/:patientId", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "No se encontro el usuario" }, 401);
    if (user.role !== "DOCTOR") return c.json({ error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const patientId = c.req.param("patientId");
    if (!patientId) return c.json({ error: "No se encontro el id" }, 400);

    //validar que el paciente exista y que pueda realizar esta operacion

    const body = await c.req.parseBody();
    const file = body.file;

    if (!file) return c.json({ error: "No se encontro el archivo" }, 400);
    if (typeof file === "string")
      return c.json({ error: "No se encontro el archivo" }, 400);

    //validar el tipo de archivo y peso

    const fileName = CryptoHasher.hash(file.name, 32).toString();
    const arrayBuffer = await file.arrayBuffer();

    try {
      await upload(arrayBuffer, fileName, file.type);
    } catch (e) {
      return c.json({ error: "No se pudo subir el archivo" }, 500);
    }

    await db
      .update(Patients)
      .set({ image: fileName })
      .where(eq(Patients.id, patientId));

    return c.json({ success: true });
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

async function getResources(
  list: string[]
): Promise<{ id: string; url: string }[]> {
  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const resourcePromises = list.map(async (idResource: string) => {
    const fileId = idResource.split(".").shift() || "";

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileId,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return { id: idResource, url };
  });

  // Wait for all the promises to resolve
  const resources = await Promise.all(resourcePromises);
  return resources;
}

async function getResource(idResource: string) {
  const s3 = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: idResource,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}
