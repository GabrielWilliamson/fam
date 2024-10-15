import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import CryptoHasher from "bun";
import { db } from "../db/db";
import { Patients, Queries } from "../db/schemas";
import { eq } from "drizzle-orm";
import doctorIdentification from "../lib/identification";
import {
  DeleteResource,
  getResource,
  getResources,
  saveIdResources,
  upload,
} from "../lib/store";

type resource = {
  id: string;
  name: string;
};

export const mediaRoute = new Hono<{ Variables: authVariables }>()
  //guardar los recursos de la consuta
  .post("/resources/:queryId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No se encontro el usuario" },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, error: "unauthorized" }, 401);

    const queryId = c.req.param("queryId");
    if (!queryId) return c.json({ error: "No se encontro el query" }, 400);

    //validar que esa querie exista y que tenga acceso a ella
    const body = await c.req.parseBody();
    const files: Blob[] = [];

    // validar la cantidad de archivos

    const MAX_FILES = 6;

    const resources = await db
      .select({
        currentResources: Queries.resources,
      })
      .from(Queries)
      .where(eq(Queries.id, queryId));

    let existingResourcesCount = 0;

    if (resources.length > 0 && resources[0].currentResources) {
      existingResourcesCount = resources[0].currentResources.length;
    }

    // Recorrer las entradas del objeto
    Object.entries(body).forEach(([key, value]) => {
      if (key.startsWith("files[") && value instanceof Blob) {
        files.push(value);
      }
    });

    if (!files.length) {
      return c.json({ success: false, error: "No se subieron archivos" }, 400);
    }

    const totalFilesCount = existingResourcesCount + files.length;

    if (totalFilesCount > MAX_FILES) {
      return c.json(
        {
          success: false,
          error: `Se permite un máximo de ${MAX_FILES} archivos. Actualmente tienes ${totalFilesCount} archivos.`,
        },
        400,
      );
    }

    //veryfying file types
    const accept = [
      // PDF
      "application/pdf",

      // Imágenes
      "image/jpeg",
      "image/png",
      "image/webp",

      // Word
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx

      // Excel
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel.sheet.binary.macroEnabled.12", // .xlsb
      "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    ];

    const ready = files.every((file) => {
      return accept.includes(file.type);
    });

    if (!ready) {
      return c.json(
        { success: false, error: "Tipo de archivo no admitido" },
        400,
      );
    }

    const maxSize = 3 * 1024 * 1024; // 3MB en bytes

    const allFilesWithinLimit = files.every((file) => {
      return file.size <= maxSize;
    });

    if (!allFilesWithinLimit) {
      return c.json(
        { success: false, error: "Los archivos exceden el tamaño maximo" },
        400,
      );
    }

    try {
      for (const file of files) {
        const fileName = CryptoHasher.hash(file.name, 32).toString();
        const arrayBuffer = await file.arrayBuffer();
        await upload(arrayBuffer, fileName, file.type);
        saveIdResources(fileName + "." + file.type, queryId, file.name);
      }

      return c.json({ success: true, error: "" });
    } catch (error) {
      console.error("Error al subir los archivos:", error);
      return c.json(
        { success: false, error: "Falló la subida de los archivos" },
        500,
      );
    }
  })
  //borrar un recurso de la consulta
  .delete("/resources/:queryId/:resourceId", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: "No se encontró el usuario", success: false },
        401,
      );
    }
    if (user.role !== "DOCTOR") {
      return c.json({ error: "No autorizado", success: false }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ error: "No autorizado", success: false }, 401);
    }

    const queryId = c.req.param("queryId");
    if (!queryId) {
      return c.json({ error: "No se encontró el query", success: false }, 400);
    }

    const resourceId = c.req.param("resourceId");
    if (!resourceId) {
      return c.json({ error: "No se encontró el id", success: false }, 400);
    }

    try {
      // Obtener los recursos actuales desde la base de datos
      const [query] = await db
        .select({
          resources: Queries.resources,
        })
        .from(Queries)
        .where(eq(Queries.id, queryId));

      if (!query || !query.resources) {
        return c.json(
          { error: "No se encontraron recursos", success: false },
          404,
        );
      }
      await DeleteResource(resourceId);
      const resourcesArray: resource[] = (query.resources as resource[]) || [];

      const newResources = resourcesArray.filter(
        (resource: resource) => resource.id.split(".")[0] !== resourceId,
      );

      // Actualizar los recursos en la base de datos
      await db
        .update(Queries)
        .set({ resources: newResources })
        .where(eq(Queries.id, queryId));

      return c.json({ error: "", success: true });
    } catch (e) {
      console.log("Error al borrar el recurso:", e);
      return c.json(
        { error: "Error al borrar el recurso", success: false },
        500,
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

    const resourcesArray: resource[] = (list as resource[]) || [];

    if (!list) return c.json({ resources: [] }, 200);
    if (list.length < 0) return c.json({ resources: [] }, 200);
    const current = await getResources(resourcesArray);
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
        500,
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
      console.error("error shampu", e);
      return c.json({ error: "No se pudo subir el archivo" }, 500);
    }

    await db
      .update(Patients)
      .set({ image: fileName })
      .where(eq(Patients.id, patientId));

    return c.json({ success: true });
  });

export default mediaRoute;
