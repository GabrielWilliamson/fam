import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { Dates, Patients } from "../db/schemas";
import { db } from "../db/db";
import doctorIdentification from "../lib/identification";
import { dateSchema } from "../schemas/dateSchema";
import { and, or, lte, gte, eq, asc, inArray } from "drizzle-orm/expressions";

export const datesRoute = new Hono<{ Variables: authVariables }>()

  /*
  appoinment status

  cancelled
  scheduled
  process
  end
  */

  // full appointments where status is scheduled
  .get("/", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const result = await db
      .select({
        id: Dates.id,
        start: Dates.start,
        patientId: Dates.patientId,
        end: Dates.end,
        patient: Patients.name,
      })
      .from(Dates)
      .innerJoin(Patients, eq(Patients.id, Dates.patientId))
      .where(and(eq(Dates.doctorId, doctorId), eq(Dates.status, "scheduled")));

    const adjustedResults = result.map((event: any) => {
      const adjustedEnd = new Date(event.end);
      adjustedEnd.setMinutes(adjustedEnd.getMinutes() + 1);
      return {
        ...event,
        end: adjustedEnd,
      };
    });

    return c.json({ data: adjustedResults, success: true });
  })
  // CURRENT APPOINTMENTS
  .get("/current", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const currentDates = await db
      .select({
        id: Dates.id,
        patientId: Dates.patientId,
        start: Dates.start,
        end: Dates.end,
        patient: Patients.name,
      })
      .from(Dates)
      .innerJoin(Patients, eq(Patients.id, Dates.patientId))
      .where(
        and(
          eq(Dates.doctorId, doctorId),
          eq(Dates.status, "scheduled"),
          and(gte(Dates.start, today), lte(Dates.end, tomorrow)),
        ),
      )
      .orderBy(asc(Dates.start));

    const adjustedResults = currentDates.map((event: any) => {
      const adjustedEnd = new Date(event.end);
      adjustedEnd.setMinutes(adjustedEnd.getMinutes() + 1);
      return {
        ...event,
        end: adjustedEnd,
      };
    });

    return c.json({ success: true, data: adjustedResults });
  })
  /*new */
  .post("/", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role === "ADMIN") return c.json({ success: false }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false }, 401);

    const body = await c.req.json();
    body.date = new Date(body.date);
    const result = dateSchema.safeParse(body);
    if (!result.success) return c.json({ success: false, error: result.error });

    const { start, end, date, patient } = result.data;

    // Convertir la fecha de inicio
    const startDate = new Date(date);
    const [startHour, startMinute, startSecond] = start.split(":");
    startDate.setHours(parseInt(startHour));
    startDate.setMinutes(parseInt(startMinute));
    startDate.setSeconds(parseInt(startSecond));

    // Convertir la fecha de finalización
    const endDate = new Date(date);
    const [endHour, endMinute, endSecond] = end.split(":");
    endDate.setHours(parseInt(endHour));
    endDate.setMinutes(parseInt(endMinute));
    endDate.setSeconds(parseInt(endSecond));

    // LTE MENOR O IGUAL QUE
    // GTE MAYOR O IGUAL QUE
    // LT MENOR QUE
    // GT MAYOR QUE
    const refineEnd = new Date(endDate);
    refineEnd.setMinutes(refineEnd.getMinutes() - 1);

    const existingDates = await db.query.Dates.findMany({
      where: (dates) =>
        and(
          eq(dates.doctorId, doctorId),
          inArray(dates.status, ["scheduled", "process"]),
          or(
            and(
              lte(dates.start, refineEnd), // La cita existente empieza antes que la nueva termine
              gte(dates.end, startDate), // La cita existente termina después que la nueva comienza
            ),
          ),
        ),
    });

    if (existingDates.length > 0) {
      return c.json({
        success: false,
        error: "Ya existe una cita en ese rango de fechas",
      });
    }
    const et = new Date(endDate);
    et.setMinutes(et.getMinutes() - 1);

    try {
      await db.insert(Dates).values({
        start: startDate,
        end: et,
        doctorId: doctorId,
        patientId: patient.id,
        status: "scheduled",
      });

      return c.json({ success: true });
    } catch (error) {
      console.error("Error al crear la cita:", error);
      return c.json({ success: false, error: "Error al crear la cita" });
    }
  })
  /*cancel */
  .patch("/cancel/:id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "unautorized" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "unautorized" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, error: "unautorized" }, 401);

    const id = c.req.param("id");

    if (!id) {
      return c.json(
        { success: false, error: "No se encontro el id de la cita" },
        404,
      );
    }

    const [data] = await db
      .select({ status: Dates.status })
      .from(Dates)
      .where(and(eq(Dates.id, id), eq(Dates.doctorId, doctorId)));

    if (!data) return c.json({ success: false, error: "error" }, 401);

    if (data.status === "cancelled" || data.status === "end") {
      return c.json({ success: false, error: "error" }, 401);
    }

    await db.update(Dates).set({ status: "cancelled" }).where(eq(Dates.id, id));

    return c.json({ success: true, error: "" });
  });
