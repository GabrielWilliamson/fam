import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import { RelativeSchema } from "../schemas/relativeSchema";
import { db } from "../db/db";
import { Files, Patients, Relatives } from "../db/schemas";
import { eq } from "drizzle-orm";
import doctorIdentification from "../lib/doctorIdentification";
import { hereditarySchema, infectoSchema } from "../schemas/fileSchema";
import {
  alcoholSchema,
  drogasSchema,
  tobacoSchema,
} from "../schemas/generalSchema";

export const fileRoute = new Hono<{ Variables: authVariables }>()

  //ADD RELATIVE
  .post("/relative", zValidator("json", RelativeSchema), async (c) => {
    const user = c.get("user");
    if (!user || user.role === "ADMIN") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    try {
      const data = c.req.valid("json");
      await db.insert(Relatives).values({
        name: data.name,
        dni: data.DNI,
        phone: data.nationality.countryCode + data.phone,
        relation: data.relation,
        civilStatus: data.civilStatus,
        patientId: data.patientId,
        nationality: data.nationality.country,
      });

      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })

  //list relative  validar la seguridad des esto
  .get("/relative", async (c) => {
    const user = c.get("user");
    if (!user || user.role === "ADMIN") {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const id = c.req.query("id");
    if (!id)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const ls = await db
      .select({
        id: Relatives.id,
        name: Relatives.name,
        dni: Relatives.dni,
        phone: Relatives.phone,
        relation: Relatives.relation,
        civilStatus: Relatives.civilStatus,
      })
      .from(Relatives)
      .where(eq(Relatives.patientId, id));

    return c.json({ success: true, data: ls });
  })

  //list diases

  .get("/diases", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const fileId = c.req.query("fileId");
    if (!fileId)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const file = await db
      .select({
        doctorId: Patients.doctorId,
        infecto: Files.infecto,
        hereditary: Files.hereditary,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json(
        { success: false, error: "No se encontro el expediente", data: null },
        500
      );

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized", data: null }, 500);

    return c.json({ success: true, error: "", data: file[0] });
  })

  .patch("/infecto/:fileId", zValidator("json", infectoSchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const fileId = c.req.param("fileId");
    if (!fileId) return c.json({ success: false, error: "id requerido" });

    const data = c.req.valid("json");

    const file = await db
      .select({
        id: Files.id,
        doctorId: Patients.doctorId,
        infecto: Files.infecto,
        patientId: Files.patientId,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json({ success: false, error: "No se encontro el expediente" });

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized" });

    const oldInfecto = file[0].infecto;
    const newInfecto = [...(oldInfecto ?? []), ...data.infecto];

    await db
      .update(Files)
      .set({ infecto: newInfecto })
      .where(eq(Files.id, fileId));

    return c.json({ success: true, error: "" });
  })
  //enfermedades hereditarias
  .patch(
    "/hereditary/:fileId",
    zValidator("json", hereditarySchema),
    async (c) => {
      const user = c.get("user");
      if (!user) {
        return c.json({
          success: false,
          error: "unauthorized",
        });
      }

      if (user.role != "DOCTOR") {
        return c.json({
          success: false,
          error: "unauthorized",
        });
      }

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId) {
        return c.json({
          success: false,
          error: "unauthorized",
        });
      }

      const fileId = c.req.param("fileId");
      if (!fileId) return c.json({ success: false, error: "id requerido" });

      const data = c.req.valid("json");

      const file = await db
        .select({
          id: Files.id,
          doctorId: Patients.doctorId,
          hereditary: Files.hereditary,
          patientId: Files.patientId,
        })
        .from(Files)
        .innerJoin(Patients, eq(Files.patientId, Patients.id))
        .where(eq(Files.id, fileId));

      if (!file)
        return c.json({
          success: false,
          error: "No se encontro el expediente",
        });

      if (file[0].doctorId != doctorId)
        return c.json({ success: false, error: "unauthorized" });

      const olfHereditary = file[0].hereditary;
      const newHereditary = [...(olfHereditary ?? []), ...data.hereditary];

      await db
        .update(Files)
        .set({ hereditary: newHereditary })
        .where(eq(Files.id, fileId));

      return c.json({ success: true, error: "" });
    }
  )

  .get("/apnp", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const fileId = c.req.query("fileId");
    if (!fileId)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const file = await db
      .select({
        doctorId: Patients.doctorId,
        apnp: Files.app,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json(
        { success: false, error: "No se encontro el expediente", data: null },
        500
      );

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized", data: null }, 500);

    return c.json({ success: true, error: "", data: file[0].apnp });
  })

  // antecendentes personales patologicos
  //general
  .patch("/general/app/:fileId/:apnp", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, error: "unauthorized" });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "unauthorized" });
    }

    const fileId = c.req.param("fileId");
    if (!fileId) return c.json({ success: false, error: "id requerido" });

    const apnp = c.req.param("apnp");
    if (!apnp) return c.json({ success: false, error: "apnp requerido" });

    type APNPType = "tobaco" | "alcohol" | "drogas";

    const schemas: Record<APNPType, any> = {
      tobaco: tobacoSchema,
      alcohol: alcoholSchema,
      drogas: drogasSchema,
    };

    const schema = schemas[apnp as APNPType];
    if (!schema) return c.json({ success: false, error: "apnp no soportado" });

    const body = await c.req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json({ success: false, error: result.error });
    }

    const data = result.data;

    // Consulta para obtener el expediente
    const file = await db
      .select({
        id: Files.id,
        doctorId: Patients.doctorId,
        app: Files.app,
        patientId: Files.patientId,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file.length) {
      return c.json({ success: false, error: "No se encontró el expediente" });
    }

    if (file[0].doctorId != doctorId) {
      return c.json({ success: false, error: "unauthorized" });
    }

    // Preparar el objeto según el tipo de antecedente
    const newEntry: Record<string, any> = {};
    if (apnp === "tobaco") {
      newEntry["Tabaco"] = {
        tobaccoType: { value: data.tobaccoType, label: "Tipo de tabaco" },
        consumptionAmount: {
          value: data.consumptionAmount,
          label: "Consumo de tabaco",
        },
        consumptionFrequency: {
          value: data.consumptionFrequency,
          label: "Frecuencia de consumo",
        },
        startAge: { value: data.startAge, label: "Edad de inicio" },
        duration: { value: data.duration, label: "Duración" },
      };
    } else if (apnp === "alcohol") {
      newEntry["Alcohol"] = {
        alcoholType: { value: data.alcoholType, label: "Tipo de alcohol" },
        consumptionAmount: {
          value: data.consumptionAmount,
          label: "Consumo de alcohol",
        },
        consumptionFrequency: {
          value: data.consumptionFrequency,
          label: "Frecuencia de consumo",
        },
        startAge: { value: data.startAge, label: "Edad de inicio" },
        duration: { value: data.duration, label: "Duración" },
      };
    } else if (apnp === "drogas") {
      newEntry["Drogas"] = {
        drugType: { value: data.drugType, label: "Tipo de droga" },
        consumptionAmount: {
          value: data.consumptionAmount,
          label: "Consumo de drogas",
        },
        consumptionFrequency: {
          value: data.consumptionFrequency,
          label: "Frecuencia de consumo",
        },
        startAge: { value: data.startAge, label: "Edad de inicio" },
        duration: { value: data.duration, label: "Duración" },
      };
    }

    // Combinar los datos existentes con los nuevos
    const oldObject = file[0].app || {};
    const updatedObject = { ...oldObject, ...newEntry };

    // Actualizar la base de datos
    await db
      .update(Files)
      .set({ app: updatedObject })
      .where(eq(Files.id, fileId));

    return c.json({ success: true });
  });
