import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import {
  diasesSchema,
  addAssitantSchema,
  credentialSchema,
  socialsSchema,
  specialitySchema,
  fileTypeSchema,
} from "../schemas/doctorSchema";
import { Assistants, Doctors, Users } from "../db/schemas";
import { db } from "../db/db";
import { eq, isNull, sql } from "drizzle-orm";

export const doctorRoute = new Hono<{ Variables: authVariables }>()

  //especiality
  .patch("/speciality", zValidator("json", specialitySchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const data = c.req.valid("json");

    try {
      await db
        .update(Doctors)
        .set({
          specialityName: data.speciality,
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })
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
  .patch("/type", zValidator("json", fileTypeSchema), async (c) => {
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
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role !== "DOCTOR")
      return c.json(
        {
          success: false,
          data: null,
        },
        401,
      );

    const info = await db.query.Doctors.findFirst({
      where: eq(Doctors.userId, user.id),
      columns: {
        credential: true,
        socials: true,
        specialtie: true,
        specialityName: true,
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
      success: true,
      data: {
        credential: info?.credential || null,
        socials: info?.socials || null,
        fileType: info?.specialtie,
        speciality: info?.specialityName || null,
        assistantName: assistant[0]?.assistantName || null,
      },
    });
  })
  /*add socials media */
  .post("/socials", zValidator("json", socialsSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const data = c.req.valid("json");
    try {
      const ob = JSON.parse(data.skills);
      await db
        .update(Doctors)
        .set({
          socials: ob,
        })
        .where(eq(Doctors.userId, user.id));
      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })
  /*delete socials media */
  .delete("/socials/:social", async (c) => {
    const user = c.get("user");
    if (!user) return c.body(null, 401);
    if (user.role !== "DOCTOR") return c.body(null, 401);

    const social = c.req.param("social");

    if (!social) return c.json({ success: false }, 500);

    try {
      const doc = await db.query.Doctors.findFirst({
        where: eq(Doctors.userId, user.id),
        columns: {
          socials: true,
        },
      });

      const res = JSON.stringify(doc!.socials);
      let w: { [key: string]: string } = JSON.parse(res);
      delete w[social];

      await db
        .update(Doctors)
        .set({
          socials: w,
        })
        .where(eq(Doctors.userId, user.id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Error al eliminar la habilidad:");
      return c.json({ success: false });
    }
  })
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
