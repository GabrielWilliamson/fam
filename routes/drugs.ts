import { Hono } from "hono";
import { drugsSchema } from "../schemas/drugSchema";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import type { drugsTable } from "../types/drugs";
import { Doctors, Drugs, Users } from "../db/schemas";
import { db } from "../db/db";
import { and, eq } from "drizzle-orm";
import errorMap from "zod/locales/en.js";
import doctorIdentification from "../lib/doctorIdentification";

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

    console.log(drugs);
    console.log(doctorId, "checking");

    const formattedDrugs = drugs.map((drug: any) => ({
      ...drug,
      presentations: drug.presentations || [],
    }));

    return c.json({ success: true, data: formattedDrugs as drugsTable[] });
  })

  //agregar
  .post("/", zValidator("json", drugsSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

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
            eq(Drugs.tradeName, data.tradeName),
            eq(Drugs.doctorId, doctor[0].id)
          )
        );
      if (find.length > 0)
        return c.json({ success: false, error: "El fármaco ya existe" }, 500);

      await db.insert(Drugs).values({
        genericName: data.genericName?.toLowerCase(),
        tradeName: data.tradeName.toLowerCase(),
        doctorId: doctor[0].id,
        presentations: data.presentations,
      });

      await setTimeout(() => {}, 500);
      return c.json({ success: true, error: "" });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
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
