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
  autoSchema,
  historySchema,
  interrogationSchema,
  reasonSchema,
} from "../schemas/querieSchema";
import doctorIdentification from "../lib/doctorIdentification";
import { genSalt } from "bcryptjs";
import type { querieBase } from "../types/queries";

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
    if (!doctorId)
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
      .where(and(eq(Queries.id, querieId), eq(Queries.doctorsId, doctorId)));

    return c.json({ success: true, data: QuerieData[0] }, 200);
  })

  //Obtener la consulta base para los (autosave)
  .get("/base", async (c) => {
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
    if (!doctorId)
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

    const QuerieData = await db
      .select({
        querieId: Queries.id,
        interrogation: Queries.interrogation,
        reason: Queries.reason,
        history: Queries.history,
        observations: Queries.observations,
        diag: Queries.diag,
        aspects: Exams.aspects,
        skin: Exams.skin,
        abd: Exams.abd,
        exInf: Exams.exInf,
        exSup: Exams.exSup,
        anus: Exams.anus,
        genitu: Exams.genitu,
        neuro: Exams.neuro,
      })
      .from(Queries)
      .innerJoin(Exams, eq(Exams.querieId, Queries.id))
      .where(and(eq(Queries.id, querieId), eq(Queries.doctorsId, doctorId)));

    return c.json({ success: true, data: QuerieData[0] as querieBase }, 200);
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
        vitals: Exams.vitals,
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
        vitals: Exams.vitals,
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
        vitals: updatedVitals,
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

  //auto save inputs
  .patch("/auto/:querieId", zValidator("json", autoSchema), async (c) => {
    const user = c.get("user");

    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 500);
    }

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const queryFind = await db
      .select()
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);
    const query = queryFind[0];

    if (query.doctorsId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const { data, autoType } = c.req.valid("json");

    if (autoType === "history") {
      await db
        .update(Queries)
        .set({ history: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "obs") {
      await db
        .update(Queries)
        .set({ observations: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "reason") {
      await db
        .update(Queries)
        .set({ reason: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "interrogation") {
      await db
        .update(Queries)
        .set({ interrogation: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "diag") {
      await db
        .update(Queries)
        .set({ diag: data })
        .where(eq(Queries.id, querieId));
    }

    if (autoType === "abd") {
      await db
        .update(Exams)
        .set({ abd: data })
        .where(eq(Exams.querieId, querieId));
    }

    if (autoType === "anus") {
      await db
        .update(Exams)
        .set({ anus: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "aspects") {
      await db
        .update(Exams)
        .set({ anus: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "exInf") {
      await db
        .update(Exams)
        .set({ exInf: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "exSup") {
      await db
        .update(Exams)
        .set({ exSup: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "gen") {
      await db
        .update(Exams)
        .set({ genitu: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "neu") {
      await db
        .update(Exams)
        .set({ neuro: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "skin") {
      await db
        .update(Exams)
        .set({ skin: data })
        .where(eq(Exams.querieId, querieId));
    }

    return c.json({ success: true, error: null }, 200);
  });
