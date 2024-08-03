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
import { eq } from "drizzle-orm";
import type { querieType } from "../types/queries";
import { resolve } from "bun";
import { zValidator } from "@hono/zod-validator";
import { vitalsSchema } from "../schemas/vitalSchema";

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

    const dateId = c.req.query("dateId");
    if (!dateId) {
      return c.json(
        { success: false, redirect: null, error: "El id es requerido" },
        500
      );
    }

    const findQuerie = await db
      .select()
      .from(Queries)
      .where(eq(Queries.dateId, dateId));

    if (findQuerie.length > 0)
      return c.json(
        { success: true, redirect: findQuerie[0].id, error: null },
        500
      );

    const dateInfo = await db
      .select({
        dateId: Dates.id,
        idFile: Files.id,
        doctorId: Dates.doctorId,
      })
      .from(Dates)
      .innerJoin(Files, eq(Files.patientId, Dates.patientId))
      .where(eq(Dates.id, dateId));

    if (dateInfo.length === 0)
      return c.json(
        { success: false, redirect: null, error: "No se encotro la cita" },
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
      .innerJoin(Patients, eq(Patients.id, Files.patientId));

    return c.json({ success: true, data: QuerieData[0] }, 200);
  })

  //obtener el examen fisico
  .get("/vitals", async (c) => {
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
        id: Exams.id,
        vitals: Exams.signosVitales,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, data: examData[0] }, 200);
  })

  //save vitals
  .post("/vitals", zValidator("json", vitalsSchema), async (c) => {
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

    const data = c.req.valid("json");
      


  });
