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
import { eq, sql, and } from "drizzle-orm";
import { Assistants, Doctors, Flows } from "../db/schemas";

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
      .select({
        assistantId: Doctors.assistantId,
        assistantUserId: Assistants.userId,
      })
      .from(Doctors)
      .innerJoin(Assistants, eq(Assistants.id, Doctors.assistantId))
      .where(eq(Doctors.id, doctorId));

    if (!assistant[0]?.assistantId)
      return c.json(
        { success: false, error: "No tienes un asistente definido" },
        401,
      );

    await db
      .insert(Flows)
      .values({
        flow: "add",
        description: "change",
        doctorId: doctorId,
        chargeTo: assistant[0].assistantUserId,
        total: data.amount,
        cordobas: data.amount,
        dollars: 0,
      })
      .returning({ id: Flows.id });

    await db
      .update(Assistants)
      .set({
        cordobas: sql`${Assistants.cordobas} + ${data.amount}`,
        total: sql`${Assistants.total} + ${data.amount}`,
      })
      .where(eq(Assistants.id, assistant[0].assistantId));

    return c.json({ success: true });
  })
  //get especific data
  .get("/moneyDoctor", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json({ success: false, data: null }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const assistantId = await assistantIdentification(user.role, user.id);

    const data = await db
      .select({
        totalA: assistantId ? Assistants.total : sql<number | null>`NULL`,
        cordobasA: assistantId ? Assistants.cordobas : sql<number | null>`NULL`,
        dollarsA: assistantId ? Assistants.dollars : sql<number | null>`NULL`,
        total: Doctors.total,
        cordobas: Doctors.cordobas,
        dollars: Doctors.dollars,
        rate: Doctors.rate,
      })
      .from(Doctors)
      .leftJoin(Assistants, eq(Doctors.assistantId, Assistants.id))
      .where(eq(Doctors.id, doctorId));

    const doctorExpensesQuery = await db
      .select({
        doctorExpenses: sql<number>`SUM(${Flows.total})`,
      })
      .from(Flows)
      .where(
        and(
          eq(Flows.doctorId, doctorId),
          eq(Flows.flow, "expense"),
          eq(Flows.chargeTo, user.id),
          sql`DATE(${Flows.createdAt}) = CURRENT_DATE`,
        ),
      );

    // Consulta para obtener los gastos de la asistente (si existe, basado en su userId)
    const assistantExpensesQuery = assistantId
      ? await db
          .select({
            assistantExpenses: sql<number>`SUM(${Flows.total})`,
          })
          .from(Flows)
          .innerJoin(Assistants, eq(Flows.chargeTo, Assistants.userId))
          .where(
            and(
              eq(Flows.doctorId, doctorId),
              eq(Flows.flow, "expense"),
              eq(Assistants.id, assistantId),
              sql`DATE(${Flows.createdAt}) = CURRENT_DATE`,
            ),
          )
      : [{ assistantExpenses: 0 }]; // Si no hay asistente, 0 gastos

    // Manejo de valores finales con null coalescing
    const totalA = data[0]?.totalA ?? null;
    const cordobasA = data[0]?.cordobasA ?? null;
    const dollarsA = data[0]?.dollarsA ?? null;
    const total = data[0]?.total ?? 0;
    const cordobas = data[0]?.cordobas ?? 0;
    const dollars = data[0]?.dollars ?? 0;
    const rate = data[0]?.rate ?? 0;
    const doctorExpenses = doctorExpensesQuery[0]?.doctorExpenses ?? 0;
    const assistantExpenses =
      assistantExpensesQuery[0]?.assistantExpenses ?? null;
    const expencesTotal = doctorExpenses + assistantExpenses || 0;

    return c.json({
      success: true,
      data: {
        totalA,
        cordobasA,
        dollarsA,
        assitantExpenses: assistantExpenses,
        total,
        cordobas,
        dollars,
        doctorExpenses,
        expencesTotal,
        rate,
      },
    });
  })
  //get especific data
  .get("/moneyAssistant", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "ASSISTANT") {
      return c.json({ success: false, data: null }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    // Identificación del asistente (puede ser null si no hay asistente)
    const assistantId = await assistantIdentification(user.role, user.id);

    if (!assistantId) {
      return c.json({ success: false, data: null }, 401);
    }

    // Obtener datos del doctor y el asistente (si existe)
    const data = await db
      .select({
        totalA: Assistants.total,
        cordobasA: Assistants.cordobas,
        dollarsA: Assistants.dollars,
        rate: Doctors.rate,
      })
      .from(Assistants)
      .innerJoin(Doctors, eq(Assistants.id, Doctors.assistantId))
      .where(eq(Assistants.id, assistantId));

    const assistantExpensesQuery = assistantId
      ? await db
          .select({
            assistantExpenses: sql<number>`SUM(${Flows.total})`,
          })
          .from(Flows)
          .innerJoin(Assistants, eq(Flows.chargeTo, Assistants.userId))
          .where(
            and(
              eq(Flows.doctorId, doctorId),
              eq(Flows.flow, "expense"),
              eq(Assistants.id, assistantId),
              sql`DATE(${Flows.createdAt}) = CURRENT_DATE`,
            ),
          )
      : [{ assistantExpenses: 0 }]; // Si no hay asistente, 0 gastos

    // Manejo de valores finales con null coalescing
    const total = data[0]?.totalA ?? null;
    const cordobas = data[0]?.cordobasA ?? null;
    const dollars = data[0]?.dollarsA ?? null;

    const rate = data[0]?.rate ?? 0;
    const assitantExpenses =
      assistantExpensesQuery[0]?.assistantExpenses ?? null;

    return c.json({
      success: true,
      data: {
        total,
        cordobas,
        dollars,
        assitantExpenses,
        rate,
      },
    });
  })
  //arqueo
  .patch("/conciliation", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "unauthorized" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "unauthorized" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "unatorized" });
    }

    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      return c.json({ success: false, error: "no tienes asistente" });
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
    const maxCordobas = assistant[0]?.cordobas;

    if (maxDolares === 0 && maxCordobas === 0) {
      return c.json({ success: false, error: "No hay fondos disponibles" });
    }

    const schema = generateConciliationSchema(maxCordobas, maxDolares);
    const body = await c.req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return c.json({ success: false, error: "Error" }, 500);
    }

    const currentRate = assistant[0]?.rate ?? 0;
    if (currentRate === 0) {
      return c.json({
        success: false,
        error: "Debes definir una tasa de cambio",
      });
    }

    const setTotalCordobas = maxCordobas - result.data.cordobas || 0;
    const setTotalDolares = maxDolares - result.data.dolares || 0;

    const total = setTotalCordobas + setTotalDolares * currentRate;
    const grandTotal =
      result.data.cordobas || 0 + result.data.dolares || 0 * currentRate;

    await db.insert(Flows).values({
      flow: "conciliation",
      description: "conciliation",
      doctorId: doctorId,
      chargeTo: user.id,
      total: grandTotal,
      cordobas: result.data.cordobas ?? 0,
      dollars: result.data.dolares ?? 0,
    });

    await db
      .update(Assistants)
      .set({
        dollars: setTotalDolares,
        cordobas: setTotalCordobas,
        total: total,
      })
      .where(eq(Assistants.id, assistantId));

    return c.json({ success: true, error: "" }, 200);
  })
  //obtener el tipo de cambio
  .get("/rate", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, data: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const result = await db
      .select({
        rate: Doctors.rate,
        cordobas: Doctors.cordobas,
        cordobasA: Assistants.cordobas,
      })
      .from(Doctors)
      .innerJoin(Assistants, eq(Doctors.assistantId, Assistants.id))
      .where(eq(Doctors.id, doctorId));

    const rate = result[0]?.rate ?? 0;
    const cordobas = result[0]?.cordobas ?? 0;
    const cordobasA = result[0]?.cordobasA ?? 0;

    return c.json({ success: true, data: { rate, cordobas, cordobasA } });
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
  // agregar un nuevo expence for assistant
  .post("/expencesAssistant", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, message: "Unauthorized" }, 401);
    if (user.role !== "ASSISTANT")
      return c.json({ success: false, message: "Unauthorized" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) {
      return c.json({ success: false, message: "unAutorized" }, 401);
    }

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

    // Verificar que no se intenten dejar fondos negativos
    if (setTotalCordobas < 0 || setTotalDolares < 0) {
      return c.json(
        { success: false, message: "Fondos insuficientes para esta operación" },
        400,
      );
    }

    await db
      .insert(Flows)
      .values({
        flow: "expense",
        description: result.data.description,
        doctorId: doctorId,
        chargeTo: user.id,
        total: result.data.cordobas + result.data.dollars * currentRate,
        cordobas: result.data.cordobas,
        dollars: result.data.dollars,
      })
      .returning({ id: Flows.id });

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
  .post("/expencesDoctor", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, message: "Unauthorized" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, message: "Unauthorized" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) {
      return c.json({ success: false, message: "unAutorized" }, 401);
    }

    const doctor = await db
      .select({
        cordobas: Doctors.cordobas,
        dolars: Doctors.dollars,
        rate: Doctors.rate,
      })
      .from(Doctors)
      .where(eq(Doctors.id, doctorId));

    // Verificación de fondos actuales
    const maxDolares = doctor[0]?.dolars ?? 0;
    const maxCordobas = doctor[0]?.cordobas ?? 0;

    if (maxDolares === 0 && maxCordobas === 0) {
      console.error("sin fondos");
      return c.json({ success: false, message: "Fondos insuficientes" }, 500);
    }

    // Verificar la tasa de cambio
    const currentRate = doctor[0]?.rate ?? 0;
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

    // Verificar que no se intenten dejar fondos negativos
    if (setTotalCordobas < 0 || setTotalDolares < 0) {
      return c.json(
        { success: false, message: "Fondos insuficientes para esta operación" },
        400,
      );
    }

    await db
      .insert(Flows)
      .values({
        flow: "expense",
        description: result.data.description,
        doctorId: doctorId,
        chargeTo: user.id,
        total: result.data.cordobas + result.data.dollars * currentRate,
        cordobas: result.data.cordobas,
        dollars: result.data.dollars,
      })
      .returning({ id: Flows.id });

    // Actualizar la base de datos
    await db
      .update(Doctors)
      .set({
        dollars: setTotalDolares,
        cordobas: setTotalCordobas,
        total: total,
      })
      .where(eq(Doctors.id, doctorId));

    return c.json({
      success: true,
      message: "Gastos actualizados correctamente",
    });
  })
  //obtner los gastos de el asistente
  .get("/expensesAssistant", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);
    if (user.role === "ADMIN") {
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, message: "unAutorized" }, 401);
    }

    // Get assistant identification based on user role and ID
    const assistantId = await assistantIdentification(user.role, user.id);
    if (!assistantId) {
      return c.json(
        {
          success: false,
          data: null,
          error: "No tienes un asistente definido",
        },
        401,
      );
    }

    // Get the query parameter "q" (date) if provided, or use the current date
    let dateQuery = c.req.query("q");
    if (!dateQuery) {
      dateQuery = new Date().toDateString(); // Get current date in 'YYYY-MM-DD' format
    }

    // Identify the user linked to the assistant
    const userIdentification = await db
      .select({ userId: Assistants.userId })
      .from(Assistants)
      .where(eq(Assistants.id, assistantId))
      .limit(1);

    if (!userIdentification || userIdentification.length === 0) {
      return c.json({ success: false, data: null, error: "Error" }, 404);
    }

    // Fetch expenses for the user for the specified date
    const result = await db
      .select({
        description: Flows.description,
        cordobas: Flows.cordobas,
        dollars: Flows.dollars,
        total: Flows.total,
        date: Flows.createdAt,
      })
      .from(Flows)
      .where(
        and(
          eq(Flows.chargeTo, userIdentification[0].userId),
          eq(Flows.doctorId, doctorId),
          eq(Flows.flow, "expense"),
          sql`DATE(${Flows.createdAt}) = ${dateQuery}`,
        ),
      );
    Flows;

    return c.json({ success: true, data: result, error: "" });
  })
  //get expenses for doctor
  .get("/expensesDoctor", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN") {
      return c.json({ success: false, data: null }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    // Get the query parameter "q" (date) if provided, or use the current date
    let dateQuery = c.req.query("q");
    if (!dateQuery) {
      dateQuery = new Date().toDateString(); // Get current date in 'YYYY-MM-DD' format
    }

    // Fetch expenses for the user for the specified date
    const result = await db
      .select({
        description: Flows.description,
        cordobas: Flows.cordobas,
        dollars: Flows.dollars,
        total: Flows.total,
        date: Flows.createdAt,
      })
      .from(Flows)
      .where(
        and(
          eq(Flows.chargeTo, user.id),
          eq(Flows.doctorId, doctorId),
          eq(Flows.flow, "expense"),
          sql`DATE(${Flows.createdAt}) = ${dateQuery}`,
        ),
      );

    return c.json({ success: true, data: result });
  });
