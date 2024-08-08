import { Hono } from "hono";
import { drugsSchema } from "../schemas/drugSchema";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import type { drugsTable } from "../types/drugs";
import { Doctors, Drugs, Users } from "../db/schemas";
import { db } from "../db/db";
import { and, eq, or, sql } from "drizzle-orm";
import errorMap from "zod/locales/en.js";
import doctorIdentification from "../lib/doctorIdentification";
import type { drugSearch } from "../types/drugs";

export const drugsRoute = new Hono<{ Variables: authVariables }>()

  // data table
  .get("/", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );

    const drugs = await db
      .select({
        id: Drugs.id,
        tradeName: Drugs.tradeName,
        genericName: Drugs.genericName,
        status: Drugs.status,
        presentations: Drugs.presentations,
      })
      .from(Drugs)
      .where(and(eq(Drugs.doctorId, doctorId), eq(Drugs.status, true)));

    const formattedDrugs = drugs.map((drug: any) => ({
      ...drug,
      presentations: drug.presentations || [],
    }));

    return c.json({ success: true, data: formattedDrugs as drugsTable[] });
  })

  .get("/search", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401
      );

    const q = c.req.query("q");
    if (!q)
      return c.json(
        { success: false, error: "query not found", data: null },
        500
      );

    const termArray = q.trim().split(/\s+/);
    const term = termArray
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(" & ");

    if (!term) {
      return c.json(
        { success: false, error: "query not found", data: null },
        500
      );
    }

    const result = await db
      .select({
        id: Drugs.id,
        tradeName: Drugs.tradeName,
        genericName: Drugs.genericName,
        presentations: Drugs.presentations,
      })
      .from(Drugs)
      .where(
        and(
          eq(Drugs.doctorId, doctorId),
          eq(Drugs.status, true),
          or(
            sql`to_tsvector('english', ${Drugs.tradeName}) @@ to_tsquery('english', ${term})`
          )
        )
      );

    const x: drugSearch[] = result.map((item) => {
      return {
        drugId: item.id,
        tradeName: item.tradeName,
        genericName: item.genericName,
        presentations: item.presentations!,
      };
    });

    return c.json({ success: true, data: x });
  })

  //agregar
  .post("/", zValidator("json", drugsSchema), async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", result: null },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", result: null },
        401
      );

    const data = c.req.valid("json");

    try {
      const doctor = await db
        .select()
        .from(Doctors)
        .where(eq(Doctors.userId, user.id))
        .limit(1);

      const find = await db
        .select()
        .from(Drugs)
        .where(
          and(
            eq(Drugs.tradeName, data.tradeName.toLowerCase()),
            eq(Drugs.doctorId, doctor[0].id)
          )
        );
      if (find.length > 0)
        return c.json(
          { success: false, error: "El fármaco ya existe", result: null },
          500
        );

      const result = await db
        .insert(Drugs)
        .values({
          genericName: data.genericName?.toLowerCase(),
          tradeName: data.tradeName.toLowerCase(),
          doctorId: doctor[0].id,
          presentations: data.presentations,
        })
        .returning({
          id: Drugs.id,
          tradeName: Drugs.tradeName,
          genericName: Drugs.genericName,
          presentations: Drugs.presentations,
        });

      return c.json({ success: true, error: "", result: result[0] }, 200);
    } catch (e) {
      console.log(e);
      return c.json(
        { success: false, error: "Ocurrio un error", result: null },
        500
      );
    }
  })

  //actualizar presentaciones  FALTA
  .put("/:id", zValidator("json", drugsSchema), async (c) => {
    const data = await c.req.valid("json");
    const id = c.req.param("id");
    return c.json({});
  })

  //estado falta usar el id del doctor
  .patch("/change/:id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    try {
      const id = c.req.param("id");
      const drug = await db.select().from(Drugs).where(eq(Drugs.id, id));
      await db
        .update(Drugs)
        .set({ status: !drug[0].status })
        .where(eq(Drugs.id, id));

      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  });
