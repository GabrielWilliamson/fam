import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { db } from "../db/db";
import { Flows, Queries } from "../db/schemas";
import doctorIdentification from "../lib/identification";
import { eq, and, sql, lte, gte, asc, sum, desc } from "drizzle-orm";

export const chartsRoute = new Hono<{ Variables: authVariables }>()

  .get("/range", async (c) => {
    try {
      const user = c.get("user");
      if (!user) return c.json({ success: false, data: [] }, 401);

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId)
        return c.json(
          {
            success: false,
            data: [],
            error: "No tienes permisos para acceder a esta información",
          },
          401,
        );

      const fromDat = c.req.query("from");
      const toDat = c.req.query("to");

      // Validar que ambos parámetros están presentes
      if (!fromDat || !toDat) {
        return c.json({ success: false, data: [], error: "error" }, 400);
      }

      const fromDate = new Date(fromDat);
      const toDate = new Date(toDat);

      // Asegurar que los tiempos están correctamente establecidos
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 0);

      // Ejecutar la consulta
      const result = await db
        .select({
          date: sql<string>`to_char(${Queries.createdAt}, 'YYYY-MM-DD')`,
          queryCount: sql<number>`count(*)`,
        })
        .from(Queries)
        .where(
          and(
            eq(Queries.doctorId, doctorId),
            gte(sql`DATE(${Queries.createdAt})`, sql`DATE(${fromDate})`),
            lte(
              Queries.createdAt,
              sql`${toDate}::timestamp + interval '1 day'`,
            ),
          ),
        )
        .groupBy(sql`to_char(${Queries.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(desc(sql`to_char(${Queries.createdAt}, 'YYYY-MM-DD')`))
        .execute();

      return c.json({ success: true, data: result, error: "" });
    } catch (error) {
      console.error("Error en la consulta /range:", error);
      return c.json(
        { success: false, data: [], error: "Error interno del servidor" },
        500,
      );
    }
  })
  .get("/incomes", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);

    if (user.role !== "DOCTOR")
      return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const fromDat = c.req.query("from");
    const toDat = c.req.query("to");

    if (!fromDat || !toDat) {
      return c.json({ success: false, data: [], error: "error" }, 400);
    }

    const fromDate = new Date(fromDat);
    const toDate = new Date(toDat);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 0);

    const data = await db
      .select({
        date: sql<string>`to_char(${Flows.createdAt}, 'DD-MM-YYYY')`,
        totalSum: sum(Flows.total),
      })
      .from(Flows)
      .where(
        and(
          eq(Flows.doctorId, doctorId),
          eq(Flows.flow, "income"),
          gte(sql`DATE(${Flows.createdAt})`, sql`DATE(${fromDate})`),
          lte(Flows.createdAt, sql`${toDate}::timestamp + interval '1 day'`),
        ),
      )
      .groupBy(sql`to_char(${Flows.createdAt}, 'DD-MM-YYYY')`)
      .orderBy(asc(sql`to_char(${Flows.createdAt}, 'DD-MM-YYYY')`))
      .execute();

    return c.json({ success: true, data: data, error: "" });
  })

  //expences of the week
  //assistant + doctor
  .get("/expences", async (c) => {
    return c.json({ success: true, data: [] });
  });
