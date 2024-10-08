import { Hono } from "hono";
import { drugsSchema } from "../schemas/drugSchema";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import type { drugsTable } from "../types/drugs";
import { Doctors, Drugs, PrescriptionsDetails, Users } from "../db/schemas";
import { db } from "../db/db";
import { and, eq, or, sql } from "drizzle-orm";
import errorMap from "zod/locales/en.js";
import doctorIdentification from "../lib/identification";
import type { drugSearch } from "../types/drugs";

type PaginatedResponse = {
  success: boolean;
  error: string;
  data: drugsTable[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export const drugsRoute = new Hono<{ Variables: authVariables }>()

  // data table
  .get("/", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );

    const page = parseInt(c.req.query("page") || "1");
    const pageSize = parseInt(c.req.query("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    const [drugs, total] = await Promise.all([
      db
        .select({
          id: Drugs.id,
          tradeName: Drugs.tradeName,
          genericName: Drugs.genericName,
          status: Drugs.status,
          presentations: Drugs.presentations,
        })
        .from(Drugs)
        .where(and(eq(Drugs.doctorId, doctorId), eq(Drugs.status, true)))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(Drugs)
        .where(and(eq(Drugs.doctorId, doctorId), eq(Drugs.status, true))),
    ]);

    const totalCount = total[0].count;

    const formattedDrugs = drugs.map((drug: any) => ({
      ...drug,
      presentations: drug.presentations || [],
    }));

    const response: PaginatedResponse = {
      success: true,
      error: "",
      data: formattedDrugs as drugsTable[],
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };

    return c.json({ success: true, data: response });
  })
  .get("/search", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, data: null, error: "User not found" },
        401,
      );

    const q = c.req.query("q");
    if (!q)
      return c.json(
        { success: false, error: "query not found", data: null },
        500,
      );

    const termArray = q.trim().split(/\s+/);
    const term = termArray
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(" & ");

    if (!term) {
      return c.json(
        { success: false, error: "query not found", data: null },
        500,
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
            sql`to_tsvector('english', ${Drugs.tradeName}) @@ to_tsquery('english', ${term})`,
          ),
        ),
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
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", result: null },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    try {
      const find = await db
        .select()
        .from(Drugs)
        .where(
          and(
            eq(Drugs.tradeName, formatText(data.tradeName)),
            eq(Drugs.doctorId, doctorId),
          ),
        );
      if (find.length > 0)
        return c.json(
          { success: false, error: "El fármaco ya existe", result: null },
          500,
        );

      const result = await db
        .insert(Drugs)
        .values({
          genericName: data.genericName && formatText(data.genericName),
          tradeName: formatText(data.tradeName),
          doctorId: doctorId,
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
        { success: false, error: "Ocurrió un error", result: null },
        500,
      );
    }
  })
  //actualizar presentaciones  FALTA
  .patch("/:id", zValidator("json", drugsSchema), async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", result: null },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", result: null },
        401,
      );

    const id = c.req.param("id");
    if (!id) return c.json({ success: false, error: "No id provided" }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    //buscar ese medicament
    const drug = await db.select().from(Drugs).where(eq(Drugs.id, id));

    if (drug.length === 0)
      return c.json({ success: false, error: "No se encontro" }, 500);

    if (drug[0].doctorId !== doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    await db
      .update(Drugs)
      .set({
        presentations: data.presentations,
        genericName: data.genericName?.toLowerCase(),
      })
      .where(eq(Drugs.id, id));

    return c.json({ success: true, error: null });
  })
  //change status
  .patch("/change/:id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    try {
      const id = c.req.param("id");
      if (!id) return c.json({ success: false, error: "No id provided" }, 500);
      const drug = await db.select().from(Drugs).where(eq(Drugs.id, id));

      if (drug.length === 0)
        return c.json({ success: false, error: "No se encontro" }, 500);

      if (drug[0].doctorId !== doctorId)
        return c.json({ success: false, error: "No autorizado" }, 401);

      await db
        .update(Drugs)
        .set({ status: !drug[0].status })
        .where(eq(Drugs.id, id));

      return c.json({ success: true });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" }, 500);
    }
  })
  //delete drug
  .delete("/:id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }
    const id = c.req.param("id");
    if (!id) return c.json({ success: false, error: "No id provided" }, 500);

    const drug = await db.select().from(Drugs).where(eq(Drugs.id, id));

    if (drug.length === 0)
      return c.json({ success: false, error: "No se encontro" }, 500);

    if (drug[0].doctorId !== doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    //evaluar si el medicamento no ha sido usado

    const details = await db
      .select()
      .from(PrescriptionsDetails)
      .where(eq(PrescriptionsDetails.drugId, id));
    if (details.length > 0)
      return c.json({ success: false, error: "No se puede borrar" }, 500);

    await db.delete(Drugs).where(eq(Drugs.id, id));
    return c.json({ success: true, error: null });
  });

function formatText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
