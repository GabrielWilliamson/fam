import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import doctorIdentification, {
  assistantIdentification,
} from "../lib/identification";
import { zValidator } from "@hono/zod-validator";
import {
  addChageSchema,
  generateConciliationSchema,
  generateExpencesSchema,
  rateSchema,
} from "../schemas/servicesSchema";
import { db } from "../db/db";
import { eq, sql, and, sum } from "drizzle-orm";
import { Assistants, Doctors, Expences, Queries, Users } from "../db/schemas";

export const servicesRoute = new Hono<{ Variables: authVariables }>()

  //add change
  .patch("/change", zValidator("json", addChageSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "no autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "no autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false }, 401);
    }

    const data = c.req.valid("json");

    const assistant = await db
      .select({ assistantId: Doctors.assistantId })
      .from(Doctors)
      .where(eq(Doctors.id, doctorId));

    if (!assistant[0]?.assistantId)
      return c.json(
        { success: false, error: "No tienes un asistente definido" },
        401,
      );

    await db
      .update(Assistants)
      .set({
        change: sql`${Assistants.change} + ${data.amount}`,
      })
      .where(eq(Assistants.id, assistant[0].assistantId));

    return c.json({ success: true });
  })
  .get("/money", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, data: null }, 401);

    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      return c.json({ success: false, data: null }, 401);
    }

    const data = await db
      .select({
        change: Assistants.change,
        total: Assistants.total,
        cordobas: Assistants.cordobas,
        dollars: Assistants.dollars,
      })
      .from(Assistants)
      .where(eq(Assistants.id, assistantId));

    const res = await db
      .select({
        totalSum: sql<number>`SUM(${Expences.total})`,
      })
      .from(Expences)
      .where(
        and(
          eq(Expences.assistantId, assistantId),
          sql`DATE(${Expences.createdAt}) = CURRENT_DATE`,
        ),
      );

    const total = data[0]?.total ?? 0;
    const change = data[0]?.change ?? 0;
    const dollars = data[0]?.dollars ?? 0;
    const cordobas = data[0]?.cordobas ?? 0;
    const expencesTotal = res[0]?.totalSum ?? 0;

    return c.json({
      success: true,
      data: { total, change, dollars, cordobas, expencesTotal },
    });
  })
  //obtener el tipo de cambio
  .get("/rate", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: 0 }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: 0 }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: 0 }, 401);
    }

    const rate = await db
      .select({
        rate: Doctors.rate,
      })
      .from(Doctors)
      .where(eq(Doctors.id, doctorId));

    return c.json({ success: true, data: rate[0].rate });
  })
  //get info services
  .get("/info", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const ass = await db
      .select({ assistantId: Doctors.assistantId })
      .from(Doctors)
      .where(eq(Doctors.id, doctorId));

    if (ass.length <= 0) return c.json({ success: false, data: null }, 401);

    const assistantId = ass[0]?.assistantId;

    if (!assistantId) return c.json({ success: false, data: null }, 401);

    const assistant = await db
      .select({ change: Assistants.change, name: Users.name })
      .from(Assistants)
      .innerJoin(Users, eq(Assistants.userId, Users.id))
      .where(eq(Assistants.id, assistantId));

    return c.json({ success: true, data: assistant[0] });
  })
  //arqueo
  .patch("/conciliation", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      console.error("sin asistente");
      return c.json({ success: false }, 500);
    }

    const assistant = await db
      .select({
        total: Assistants.total,
        cordobas: Assistants.cordobas,
        dolars: Assistants.dollars,
        rate: Doctors.rate,
      })
      .from(Assistants)
      .innerJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .where(eq(Assistants.id, assistantId));

    const maxDolares = assistant[0]?.dolars ?? 0;
    const maxCordobas = assistant[0]?.cordobas ?? 0;

    if (maxDolares === 0 && maxCordobas === 0) {
      console.error("sin fondos");
      return c.json({ success: false }, 500);
    }

    const schema = generateConciliationSchema(maxCordobas, maxDolares);
    const body = await c.req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      console.log(result.error);
      return c.json({ success: false }, 500);
    }

    const currentRate = assistant[0]?.rate ?? 0;
    if (currentRate === 0) {
      console.log("sin tasa");
      return c.json({ success: false }, 500);
    }

    const setTotalCordobas = maxCordobas - result.data.cordobas;
    const setTotalDolares = maxDolares - result.data.dolares;
    const total = setTotalCordobas + setTotalDolares * currentRate;

    await db
      .update(Assistants)
      .set({
        dollars: setTotalDolares,
        cordobas: setTotalCordobas,
        total: total,
      })
      .where(eq(Assistants.id, assistantId));

    return c.json({ success: true }, 200);
  })
  //rate
  .patch("/rate", zValidator("json", rateSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);
    if (user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      console.log("nell", doctorId);
      return c.json({ success: false }, 401);
    }
    const data = c.req.valid("json");

    await db
      .update(Doctors)
      .set({ rate: data.rate })
      .where(eq(Doctors.id, doctorId));
    return c.json({ success: true }, 200);
  })
  // agregar un nuevo expence
  .patch("/expences", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, message: "Unauthorized" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, message: "Unauthorized" }, 401);

    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      return c.json(
        { success: false, message: "Assistant identification failed" },
        500,
      );
    }

    const assistant = await db
      .select({
        cordobas: Assistants.cordobas,
        dolars: Assistants.dollars,
        rate: Doctors.rate,
      })
      .from(Assistants)
      .innerJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .where(eq(Assistants.id, assistantId));

    // Verificación de fondos actuales
    const maxDolares = assistant[0]?.dolars ?? 0;
    const maxCordobas = assistant[0]?.cordobas ?? 0;

    if (maxDolares === 0 && maxCordobas === 0) {
      console.error("sin fondos");
      return c.json({ success: false, message: "Fondos insuficientes" }, 500);
    }

    // Verificar la tasa de cambio
    const currentRate = assistant[0]?.rate ?? 0;
    if (currentRate === 0) {
      return c.json(
        { success: false, message: "Tasa de cambio inválida" },
        500,
      );
    }

    // Validar el cuerpo de la solicitud
    const body = await c.req.json();
    const schema = generateExpencesSchema(maxCordobas, maxDolares);
    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json(
        {
          success: false,
          message: "Datos inválidos",
          errors: result.error.errors,
        },
        400,
      );
    }

    // Calcular los nuevos fondos
    const setTotalCordobas = maxCordobas - result.data.cordobas;
    const setTotalDolares = maxDolares - result.data.dollars;
    const total = setTotalCordobas + setTotalDolares * currentRate;

    await db.insert(Expences).values({
      cordobas: result.data.cordobas,
      dollars: result.data.dollars,
      description: result.data.description,
      total: result.data.cordobas + result.data.dollars * currentRate,
      assistantId: assistantId,
    });

    // Verificar que no se intenten dejar fondos negativos
    if (setTotalCordobas < 0 || setTotalDolares < 0) {
      return c.json(
        { success: false, message: "Fondos insuficientes para esta operación" },
        400,
      );
    }
    // Actualizar la base de datos
    await db
      .update(Assistants)
      .set({
        dollars: setTotalDolares,
        cordobas: setTotalCordobas,
        total: total,
      })
      .where(eq(Assistants.id, assistantId));

    return c.json({
      success: true,
      message: "Gastos actualizados correctamente",
    });
  })
  //obtner los gastos de el dia actual
  .get("/expences", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN") {
      return c.json({ success: false, data: null }, 401);
    }

    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      return c.json({ success: false, data: null }, 500);
    }

    const result = await db
      .select({
        description: Expences.description,
        cordobas: Expences.cordobas,
        dollars: Expences.dollars,
        total: Expences.total,
        date: Expences.createdAt,
      })
      .from(Expences)
      .where(
        and(
          eq(Expences.assistantId, assistantId),
          sql`DATE(${Expences.createdAt}) = CURRENT_DATE`,
        ),
      );

    return c.json({ success: true, data: result });
  });
