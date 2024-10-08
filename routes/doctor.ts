import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import {
  diasesSchema,
  addAssitantSchema,
  credentialSchema,
  skillsSchema,
  specialiteSchema,
} from "../schemas/doctorSchema";
import { Assistants, Doctors, Users } from "../db/schemas";
import { db } from "../db/db";
import { eq, isNull, sql } from "drizzle-orm";

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
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
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
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })
  //get doctor info
  .get("/info", async (c) => {
    const user = c.get("user");

    if (!user)
      return c.json(
        {
          credential: null,
          skils: null,
          error: "No autenticado",
          assistantName: null,
        },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        {
          credential: null,
          skils: null,
          error: "No autenticado",
          assistantName: null,
        },
        401,
      );

    const info = await db.query.Doctors.findFirst({
      where: eq(Doctors.userId, user.id),
      columns: {
        credential: true,
        socials: true,
      },
    });

    const assistant = await db
      .select({
        assistantName: Users.name,
      })
      .from(Assistants)
      .innerJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .innerJoin(Users, eq(Assistants.userId, Users.id))
      .where(eq(Doctors.userId, user.id));

    return c.json({
      credential: info?.credential || null,
      skils: info?.socials || null,
      assistantName: assistant[0]?.assistantName || null,
    });
  })
  //save skils
  // .get("/skils", zValidator("json", skillsSchema), async (c) => {
  //   const user = c.get("user");
  //   if (!user) return c.body(null, 401);
  //   if (user.role !== "DOCTOR") return c.body(null, 401);

  //   const data = c.req.valid("json");
  //   try {
  //     const ob = JSON.parse(data.skills);
  //     await db
  //       .update(Doctors)
  //       .set({
  //         socials: ob,
  //       })
  //       .where(eq(Doctors.userId, user.id));
  //     return c.json({ success: true });
  //   } catch (e) {
  //     console.log(e);
  //     return c.json({ success: false, error: "Ocurrió un error" }, 500);
  //   }
  // })
  //delete skills //CAMBIAR A REDES SOCIALES
  // .delete("/skils/:skill", async (c) => {
  //   const user = c.get("user");
  //   if (!user) return c.body(null, 401);
  //   if (user.role !== "DOCTOR") return c.body(null, 401);

  //   const skill = c.req.param("skill");

  //   if (!skill) return c.json({ success: false }, 500);

  //   try {
  //     const doc = await db.query.Doctors.findFirst({
  //       where: eq(Doctors.userId, user.id),
  //       columns: {
  //         skils: true,
  //       },
  //     });

  //     const res = JSON.stringify(doc!.skils);
  //     let w: { [key: string]: string } = JSON.parse(res);
  //     delete w[skill];

  //     await db
  //       .update(Doctors)
  //       .set({
  //         skils: w,
  //       })
  //       .where(eq(Doctors.userId, user.id));

  //     return c.json({ success: true });
  //   } catch (error) {
  //     console.error("Error al eliminar la habilidad:");
  //     return c.json({ success: false });
  //   }
  // })
  //save my assistant
  .patch("/assistant", zValidator("json", addAssitantSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autenticado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

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
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })
  //get assistants
  .get("/list", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    // List assistants not assigned to any doctor
    const assistants = await db
      .select({
        assistantId: Assistants.id,
        assistantName: Users.name,
      })
      .from(Assistants)
      .leftJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .innerJoin(Users, eq(Assistants.userId, Users.id))
      .where(isNull(Doctors.assistantId));

    console.log(assistants);

    return c.json({ success: true, data: assistants }, 200);
  })
  //get diases
  .get("/diases", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const results = await db
      .select({
        infecto: Doctors.infecto,
        hereditary: Doctors.hereditary,
      })
      .from(Doctors)
      .where(eq(Doctors.userId, user.id));

    return c.json({ success: true, data: results[0] }, 200);
  })
  //update diases
  .patch("/diases/:diase", zValidator("json", diasesSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autenticado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const diase = c.req.param("diase");
    if (!diase) return c.json({ success: false, error: "No id provided" }, 500);

    const data = c.req.valid("json");
    const diseaseName = data.name.toLowerCase(); // Convertimos el nombre a minúsculas

    if (diase === "hereditary") {
      // Verificamos si la enfermedad ya está en la lista
      const doctor = await db
        .select({
          hereditary: Doctors.hereditary,
        })
        .from(Doctors)
        .where(eq(Doctors.userId, user.id));

      if (doctor[0].hereditary && doctor[0].hereditary.includes(diseaseName)) {
        return c.json(
          { success: false, error: "Enfermedad ya registrada" },
          400,
        );
      }

      // Agregamos la nueva enfermedad si no está en la lista
      await db
        .update(Doctors)
        .set({
          hereditary: sql`array_append(${Doctors.hereditary}, ${diseaseName})`,
        })
        .where(eq(Doctors.userId, user.id));

      return c.json({ success: true, error: "" }, 200);
    }

    if (diase === "infecto") {
      // Verificamos si la enfermedad ya está en la lista
      const doctor = await db
        .select({
          infecto: Doctors.infecto,
        })
        .from(Doctors)
        .where(eq(Doctors.userId, user.id));

      if (doctor[0].infecto && doctor[0].infecto.includes(diseaseName)) {
        return c.json(
          { success: false, error: "Enfermedad ya registrada" },
          400,
        );
      }

      // Agregamos la nueva enfermedad si no está en la lista
      await db
        .update(Doctors)
        .set({
          infecto: sql`array_append(${Doctors.infecto}, ${diseaseName})`,
        })
        .where(eq(Doctors.userId, user.id));

      return c.json({ success: true, error: "" }, 200);
    }

    return c.json({ success: false, error: "error param" }, 500);
  });
