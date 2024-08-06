import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import {
  addAssitantShema,
  credentialSchema,
  skillsSchema,
  specialiteSchema,
} from "../schemas/doctorSchema";
import { Assistants, Doctors, Users } from "../db/schemas";
import { db } from "../db/db";
import { eq } from "drizzle-orm";


//REVISAR EL ACCESO DEL MEDICO 

export const doctorRoute = new Hono<{ Variables: authVariables }>()

  //save credential
  .patch("/credential", zValidator("json", credentialSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const data = c.req.valid("json");

    try {
      await db
        .update(Doctors)
        .set({
          credential: data.credential.toString(),
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  })

  //save file type
  .patch("/type", zValidator("json", specialiteSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const data = c.req.valid("json");
    try {
      await db
        .update(Doctors)
        .set({
          specialtie: data.specialite,
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  })

  // get doctor info
  .get("/info", async (c) => {
    const user = c.get("user");

    type response = {
      credential: string | null;
      skils: {} | null;
      error?: string;
    };

    const r: response = {
      credential: null,
      skils: null,
      error: "No autenticado",
    };

    if (!user) return c.json(r, 401);
    if (user.role !== "DOCTOR") return c.json(r, 401);

    const info = await db.query.Doctors.findFirst({
      where: eq(Doctors.userId, user.id),
      columns: {
        credential: true,
        skils: true,
      },
    });

    const data: response = {
      credential: info?.credential || null,
      skils: info?.skils || null,
    };

    return c.json(data);
  })

  //save skils
  .get("/skils", zValidator("json", skillsSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const data = c.req.valid("json");
    try {
      const ob = JSON.parse(data.skills);
      await db
        .update(Doctors)
        .set({
          skils: ob,
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  })

  //delete skills //CAMBIAR A REDES SOCIALES
  .delete("/skils/:skill", async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const skill = c.req.param("skill");

    if (!skill) return c.json({ success: false }, 500);

    try {
      const doc = await db.query.Doctors.findFirst({
        where: eq(Doctors.userId, user.id),
        columns: {
          skils: true,
        },
      });

      const res = JSON.stringify(doc!.skils);
      let w: { [key: string]: string } = JSON.parse(res);
      delete w[skill];

      await db
        .update(Doctors)
        .set({
          skils: w,
        })
        .where(eq(Doctors.userId, user.id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Error al eliminar la habilidad:");
      return c.json({ success: false });
    }
  })

  //save my assistant
  .post("/assistant", zValidator("json", addAssitantShema), async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const data = c.req.valid("json");

    try {
      const assistantExists = await db
        .select()
        .from(Assistants)
        .where(eq(Assistants.id, data.assistantId))
        .then((res) => res.length > 0);

      if (!assistantExists) {
        return c.json({ success: false, error: "Asistente no encontrado" });
      }

      await db
        .update(Doctors)
        .set({
          assistantId: data.assistantId,
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrio un error" }, 500);
    }
  })

  //get my assistant
  .get("/assistant", async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const assistants = await db
      .select({
        assistantId: Assistants.id,
        assistantName: Users.name,
      })
      .from(Assistants)
      .innerJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .innerJoin(Users, eq(Assistants.userId, Users.id))
      .where(eq(Doctors.userId, user.id));

    return c.json(assistants);
  });
