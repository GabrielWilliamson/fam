import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { db } from "../db/db";
import {
  Dates,
  Exams,
  Files,
  Patients,
  Prescriptions,
  Queries,
} from "../db/schemas";
import { eq, and } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import {
  antropometricsSchema,
  vitalsSchema,
  type antropometrics,
  type vitals,
} from "../schemas/vitalSchema";
import {
  historySchema,
  interrogationSchema,
  reasonSchema,
} from "../schemas/querieSchema";
import doctorIdentification from "../lib/doctorIdentification";

// status for Dates
// process - en proceso
// created  - creada

//falta
// pending - pendiente
// cancelled - cancelada
// completed - completada
// deleted  - eliminada
// reagent    - re agendada

export const queriesRoute = new Hono<{ Variables: authVariables }>()

  //Create Query regular
  .post("/", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, redirect: null, error: "No autorizado" },
        401
      );
    if (user.role != "DOCTOR")
      return c.json(
        { success: false, redirect: null, error: "No autorizado" },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, redirect: null, error: "No autorizado" },
        401
      );

    const dateId = c.req.query("dateId");
    if (!dateId) {
      return c.json(
        { success: false, redirect: null, error: "El id es requerido" },
        500
      );
    }

    const dateInfo = await db
      .select({
        dateId: Dates.id,
        idFile: Files.id,
        doctorId: Dates.doctorId,
      })
      .from(Dates)
      .innerJoin(Files, eq(Files.patientId, Dates.patientId))
      .where(and(eq(Dates.id, dateId), eq(Dates.doctorId, doctorId)));

    if (dateInfo.length === 0)
      return c.json(
        { success: false, redirect: null, error: "No se encotro la cita" },
        500
      );

    const findQuerie = await db
      .select()
      .from(Queries)
      .where(eq(Queries.dateId, dateId));

    if (findQuerie.length > 0)
      return c.json(
        { success: true, redirect: findQuerie[0].id, error: null },
        500
      );

    const result = await db
      .insert(Queries)
      .values({
        dateId: dateInfo[0].dateId!,
        idFile: dateInfo[0].idFile!,
        doctorsId: dateInfo[0].doctorId!,
      })
      .returning({
        querieId: Queries.id,
      });

    await db.insert(Exams).values({
      querieId: result[0].querieId,
    });

    await db
      .update(Dates)
      .set({ status: "process" })
      .where(eq(Dates.id, dateId));

    return c.json(
      { success: true, redirect: result[0].querieId, error: null },
      200
    );
  })

  //Create Query emergency no llevaria date

  //Obtener las consulta actual
  .get("/data", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );


    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)  return c.json(
      { success: false, error: "No autorizado", data: null },
      401
    );

    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const QuerieData = await db
      .select({
        id: Queries.id,
        dateId: Queries.dateId,
        idFile: Queries.idFile,
        emergency: Queries.emergency,
        price: Queries.price,
        name: Patients.name,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(and(
        eq(Queries.id, querieId),
        eq(Queries.doctorsId, doctorId)
      ));

    return c.json({ success: true, data: QuerieData[0] }, 200);
  })

  //obtener el examen fisico
  .get("/exam", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const examData = await db
      .select({
        vitals: Exams.signosVitales,
        antropometrics: Exams.antropometrics,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    const data = examData[0].vitals;
    const data2 = examData[0].antropometrics;

    if (data === null && data2 === null) {
      return c.json(
        {
          success: true,
          data: {
            vitals: null,
            antropometrics: null,
          },
        },
        200
      );
    }
    const result = JSON.stringify(data);
    const vitalsData: vitals = JSON.parse(result);

    const result2 = JSON.stringify(data2);
    const antropometricsData: antropometrics = JSON.parse(result2);

    return c.json(
      {
        success: true,
        data: {
          vitals: vitalsData,
          antropometrics: antropometricsData,
        },
      },
      200
    );
  })

  //save vitals
  .post("/vitals/:querieId", zValidator("json", vitalsSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const newData = c.req.valid("json");

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    // Obtener los datos existentes
    const existingData = await db
      .select({
        vitals: Exams.signosVitales,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    // Recuperar el objeto existente de signos vitales
    const existingVitals = existingData[0]?.vitals || {};

    // Combinar datos existentes con los nuevos (actualizar campos existentes y agregar nuevos)
    const updatedVitals = {
      ...existingVitals,
      ...newData,
    };

    // Actualizar el registro
    await db
      .update(Exams)
      .set({
        signosVitales: updatedVitals,
      })
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, error: null }, 200);
  })

  //save antropometricos
  .post(
    "/antro/:querieId",
    zValidator("json", antropometricsSchema),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
      if (user.role === "ADMIN")
        return c.json({ success: false, error: "No autorizado" }, 401);

      const newData = c.req.valid("json");

      const querieId = c.req.param("querieId");
      if (!querieId)
        return c.json({ success: false, error: "El id es requerido" }, 500);

      // Obtener los datos existentes
      const existingData = await db
        .select({
          antropometrics: Exams.antropometrics,
        })
        .from(Exams)
        .where(eq(Exams.querieId, querieId));

      // Recuperar el objeto existente de antropométricos
      const existingAntropometrics = existingData[0]?.antropometrics || {};

      // Combinar datos existentes con los nuevos (actualizar campos existentes y agregar nuevos)
      const updatedAntropometrics = {
        ...existingAntropometrics,
        ...newData,
      };

      // Actualizar el registro
      await db
        .update(Exams)
        .set({
          antropometrics: updatedAntropometrics,
        })
        .where(eq(Exams.querieId, querieId));

      return c.json({ success: true, error: null }, 200);
    }
  )

  //AUTOSAVE ENDPOINTS

  //HISTORY
  .post("/history/:querieId", zValidator("json", historySchema), async (c) => {
    const { history } = c.req.valid("json");
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    await db
      .update(Queries)
      .set({
        history: history,
      })
      .where(eq(Queries.id, querieId));

    return c.json({ success: true }, 200);
  })
  .get("/history/:querieId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const findQuerie = await db
      .select({
        history: Queries.history,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    return c.json({ success: true, data: findQuerie[0].history }, 200);
  })

  //REASON
  .post("/reason/:querieId", zValidator("json", reasonSchema), async (c) => {
    const { reason } = c.req.valid("json");
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    await db
      .update(Queries)
      .set({
        reason: reason,
      })
      .where(eq(Queries.id, querieId));

    return c.json({ success: true }, 200);
  })
  .get("/reason/:querieId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const findQuerie = await db
      .select({
        reason: Queries.reason,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    return c.json({ success: true, data: findQuerie[0].reason }, 200);
  })

  //INTERROGATION
  .post(
    "/interrogation/:querieId",
    zValidator("json", interrogationSchema),
    async (c) => {
      const { interrogation } = c.req.valid("json");
      const user = c.get("user");
      if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
      if (user.role !== "DOCTOR")
        return c.json({ success: false, error: "No autorizado" }, 401);

      const querieId = c.req.param("querieId");
      if (!querieId)
        return c.json({ success: false, error: "El id es requerido" }, 500);

      await db
        .update(Queries)
        .set({
          interrogation: interrogation,
        })
        .where(eq(Queries.id, querieId));

      return c.json({ success: true }, 200);
    }
  )
  .get("/interrogation/:querieId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const findQuerie = await db
      .select({
        interrogation: Queries.interrogation,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    return c.json({ success: true, data: findQuerie[0].interrogation }, 200);
  });
