import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { zValidator } from "@hono/zod-validator";
import { RelativeSchema } from "../schemas/relativeSchema";
import { db } from "../db/db";
import { Files, Patients, Relatives } from "../db/schemas";
import { eq } from "drizzle-orm";
import doctorIdentification from "../lib/doctorIdentification";
import { hereditarySchema, infectoSchema } from "../schemas/fileSchema";

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
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })

  //list relative  validar la seguridad des esto
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
  })

  //list diases

  .get("/diases", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
        data: null,
      });
    }

    const fileId = c.req.query("fileId");
    if (!fileId)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const file = await db
      .select({
        doctorId: Patients.doctorId,
        infecto: Files.infecto,
        hereditary: Files.hereditary,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json(
        { success: false, error: "No se encontro el expediente", data: null },
        500
      );

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized", data: null }, 500);

    return c.json({ success: true, error: "", data: file[0] });
  })

  .patch("/infecto/:fileId", zValidator("json", infectoSchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const fileId = c.req.param("fileId");
    if (!fileId) return c.json({ success: false, error: "id requerido" });

    const data = c.req.valid("json");

    const file = await db
      .select({
        id: Files.id,
        doctorId: Patients.doctorId,
        infecto: Files.infecto,
        patientId: Files.patientId,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json({ success: false, error: "No se encontro el expediente" });

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized" });

    const oldInfecto = file[0].infecto;
    const newInfecto = [...(oldInfecto ?? []), ...data.infecto];

    await db
      .update(Files)
      .set({ infecto: newInfecto })
      .where(eq(Files.id, fileId));

    return c.json({ success: true, error: "" });
  })

  //enfermedades hereditarias
  .patch("/hereditary/:fileId", zValidator("json", hereditarySchema), async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    if (user.role != "DOCTOR") {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({
        success: false,
        error: "unauthorized",
      });
    }

    const fileId = c.req.param("fileId");
    if (!fileId) return c.json({ success: false, error: "id requerido" });

    const data = c.req.valid("json");

    const file = await db
      .select({
        id: Files.id,
        doctorId: Patients.doctorId,
        hereditary: Files.hereditary,
        patientId: Files.patientId,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.id, fileId));

    if (!file)
      return c.json({ success: false, error: "No se encontro el expediente" });

    if (file[0].doctorId != doctorId)
      return c.json({ success: false, error: "unauthorized" });

    const olfHereditary = file[0].hereditary;
    const newHereditary = [...(olfHereditary ?? []), ...data.hereditary];

    await db
      .update(Files)
      .set({ hereditary: newHereditary })
      .where(eq(Files.id, fileId));

    return c.json({ success: true, error: "" });
  });
