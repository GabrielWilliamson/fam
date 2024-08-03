import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import { RelativeSchema } from "../schemas/relativeSchema";
import { db } from "../db/db";
import { Relatives } from "../db/schemas";
import { eq } from "drizzle-orm";

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
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  })

  //list relative
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
  });
