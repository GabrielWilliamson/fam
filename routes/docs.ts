import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { Files, Patients, Relatives } from "../db/schemas";
import { db } from "../db/db";
import { eq, and, or } from "drizzle-orm";
import { getResource } from "../lib/store";

interface relatives {
  id: string;
  name: string;
  dni: string | null;
  phone: string | null;
  relation: string;
  civilStatus: string;
}

export const docsRoute = new Hono<{ Variables: authVariables }>()
  //
  .get("/file", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role != "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const relatives = await db
      .select({
        id: Relatives.id,
        name: Relatives.name,
        dni: Relatives.dni,
        phone: Relatives.phone,
        relation: Relatives.relation,
        civilStatus: Relatives.civilStatus,
      })
      .from(Relatives)
      .where(eq(Relatives.patientId, patientId));

    const my = await db
      .select({
        infecto: Files.infecto,
        hereditary: Files.hereditary,
        image: Patients.image,
        app: Files.app,
        apnp: Files.apnp,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.patientId, patientId));

    const file = my[0];
    if (file.image) {
      const image = await getResource(file.image);
      file.image = image;
    }

    return c.json({ success: true, data: { file, relatives } });
  });
