import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import { RelativeSchema } from "../schemas/relativeSchema";
import { db } from "../db/db";
import { Files, Patients, Queries, Relatives } from "../db/schemas";
import { eq, and, or, sql } from "drizzle-orm";
import doctorIdentification from "../lib/identification";
import { appSchema } from "../schemas/fileSchema";
import {
  hereditarySchema,
  infectoSchema,
  partoSchema,
  fedingSchema,
  postSchema,
  prenatalesSchema,
  psicoSchema,
} from "../schemas/fileSchema";
import {
  alcoholSchema,
  drogasSchema,
  tobacoSchema,
} from "../schemas/generalSchema";
import type { z } from "zod";

type Query = {
  createdAt: Date;
  emergency: boolean | null;
  reason: string | null;
  queryId: string;
};

type PaginatedResponse = {
  success: boolean;
  error: string;
  data: Query[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

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

      const existingRelative = await db
        .select({
          phone: Relatives.phone,
          dni: Relatives.dni,
        })
        .from(Relatives)
        .where(
          and(
            eq(Relatives.patientId, data.patientId),
            or(
              eq(Relatives.dni, data.DNI),
              eq(Relatives.phone, data.nationality.countryCode + data.phone),
            ),
          ),
        )
        .limit(1);

      if (existingRelative.length > 0) {
        return c.json({
          success: false,
          error: "Ya existe Familiar con la misma Cédula o teléfono ",
        });
      }

      // Insertar nuevo familiar si no hay conflicto
      await db.insert(Relatives).values({
        name: data.name,
        dni: data.DNI,
        phone: data.nationality.countryCode + data.phone,
        relation: data.relation,
        civilStatus: data.civilStatus,
        patientId: data.patientId,
        nationality: data.nationality.country,
      });

      return c.json({ success: true, error: null });
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
        500,
      );

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized", data: null }, 500);

    return c.json({ success: true, error: "", data: file[0] });
  })
  //
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

    const oldInfecto = file[0].infecto || [];
    const newInfecto = data.infecto || [];

    //validar que no existan datos duplicados

    const combinedInfecto = [...new Set([...oldInfecto, ...newInfecto])];
    await db
      .update(Files)
      .set({ infecto: combinedInfecto })
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

      const oldHereditary = file[0].hereditary || [];
      const newHereditary = data.hereditary || [];

      const combinedHereditary = [
        ...new Set([...oldHereditary, ...newHereditary]),
      ];

      await db
        .update(Files)
        .set({ hereditary: combinedHereditary })
        .where(eq(Files.id, fileId));

      return c.json({ success: true, error: "" });
    },
  )
  //for pediatrics and generals
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
        apnp: Files.apnp,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json(
        { success: false, error: "No se encontro el expediente", data: null },
        500,
      );

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized", data: null }, 500);

    return c.json({ success: true, error: "", data: file[0].apnp });
  })
  //antecendentes personales patologicos
  .get("/app", async (c) => {
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
    if (!fileId) {
      return c.json({ success: false, error: "id requerido", data: null }, 500);
    }

    const file = await db
      .select({
        doctorId: Patients.doctorId,
        app: Files.app,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (file.length === 0)
      return c.json(
        { success: false, error: "No se encontro el expediente", data: null },
        500,
      );

    if (file[0].doctorId != doctorId) {
      return c.json({ success: false, error: "unauthorized", data: null }, 500);
    }

    return c.json({ success: true, error: "", data: file[0].app });
  })
  // antecendentes personales no patologicos general
  .patch("/general/apnp/:fileId/:apnp", async (c) => {
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
        app: Files.apnp,
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
      .set({ apnp: updatedObject })
      .where(eq(Files.id, fileId));

    return c.json({ success: true });
  })
  //antecedentes personales no patológicos pediatricos
  .patch("/pediatric/:fileId/apnp/:caso", async (c) => {
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

    const caso = c.req.param("caso");
    if (!caso) return c.json({ success: false, error: "caso requerido" });
    const body = await c.req.json();

    const old = await db
      .select({ apnp: Files.apnp })
      .from(Files)
      .where(eq(Files.id, fileId));

    interface Apnp {
      prenatales?: Record<string, any>;
      parto?: Record<string, any>;
      postnatales?: Record<string, any>;
      feeding?: Record<string, any>;
      psico?: Record<string, any>;
    }

    const oldValue: Apnp = old[0].apnp || {};

    if (caso === "prenatales") {
      const result = prenatalesSchema.safeParse(body);
      if (!result.success)
        return c.json({ success: false, error: result.error.message });
      if (!oldValue.prenatales) {
        oldValue.prenatales = {};
      }
      oldValue.prenatales = { ...oldValue.prenatales, ...result.data };
    }

    if (caso === "parto") {
      const oldDate = new Date(body.horaNacimiento);

      const datePatient = await db
        .select({
          date: Patients.date,
        })
        .from(Patients)
        .innerJoin(Files, eq(Patients.id, Files.patientId))
        .where(eq(Files.id, fileId));

      const patientDate = datePatient[0].date;
      const birthDate = new Date(patientDate);

      const combinedDateTime = new Date(
        birthDate.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate(),
        oldDate.getHours(),
        oldDate.getMinutes(),
        oldDate.getSeconds(),
      );

      body.horaNacimiento = combinedDateTime;

      const result = partoSchema.safeParse(body);
      if (!result.success)
        return c.json({ success: false, error: result.error.message });
      if (!oldValue.parto) {
        oldValue.parto = {};
      }
      oldValue.parto = { ...oldValue.parto, ...result.data };
    }

    if (caso === "postnatales") {
      const result = postSchema.safeParse(body);
      if (!result.success)
        return c.json({ success: false, error: result.error.message });
      if (!oldValue.postnatales) {
        oldValue.postnatales = {};
      }
      oldValue.postnatales = { ...oldValue.postnatales, ...result.data };
    }

    if (caso === "feeding") {
      const result = fedingSchema.safeParse(body);
      if (!result.success)
        return c.json({ success: false, error: result.error.message });
      if (!oldValue.feeding) {
        oldValue.feeding = {};
      }
      oldValue.feeding = { ...oldValue.feeding, ...result.data };
    }

    if (caso === "psico") {
      const result = psicoSchema.safeParse(body);
      if (!result.success)
        return c.json({ success: false, error: result.error.message });
      if (!oldValue.psico) {
        oldValue.psico = {};
      }
      oldValue.psico = { ...oldValue.psico, ...result.data };
    }

    await db.update(Files).set({ apnp: oldValue }).where(eq(Files.id, fileId));
    return c.json({ success: true, error: "" });
  })
  // antecedentes personales patologicos pediatricos-general
  .patch("/app/:fileId", zValidator("json", appSchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ success: false, error: "unauthorized" });
    }

    const fileId = c.req.param("fileId");
    if (!fileId) return c.json({ success: false, error: "id requerido" });

    const old = await db
      .select({ app: Files.app })
      .from(Files)
      .where(eq(Files.id, fileId));

    type app = z.infer<typeof appSchema>;

    const oldValue: app = old[0]?.app || {};
    const data = c.req.valid("json");

    const updatedApp = { ...oldValue, ...data };

    const cleanData = (data: Record<string, string | undefined>) => {
      return Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== ""),
      );
    };

    const cleanedData = cleanData(updatedApp);

    await db
      .update(Files)
      .set({ app: cleanedData })
      .where(eq(Files.id, fileId));

    return c.json({ success: true, error: "" });
  })
  .get("/queryList", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json({ success: false, error: "unauthorized", data: null });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "unauthorized", data: null });
    }

    const fileId = c.req.query("fileId");
    if (!fileId) {
      return c.json({ success: false, error: "id requerido", data: null }, 500);
    }

    const page = parseInt(c.req.query("page") || "1");
    const pageSize = parseInt(c.req.query("pageSize") || "10");

    const offset = (page - 1) * pageSize;

    const [data, totalCountResult] = await Promise.all([
      db
        .select({
          createdAt: Queries.createdAt,
          emergency: Queries.emergency,
          queryId: Queries.id,
          reason: Queries.reason,
        })
        .from(Queries)
        .where(eq(Queries.idFile, fileId))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(Queries)
        .where(eq(Queries.idFile, fileId)),
    ]);

    const totalCount = totalCountResult[0].count;

    const response: PaginatedResponse = {
      success: true,
      error: "",
      data: data,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };

    return c.json(response);
  });
