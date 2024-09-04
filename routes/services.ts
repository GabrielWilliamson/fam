import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import doctorIdentification, {
  assistantIdentification,
} from "../lib/identification";
import { zValidator } from "@hono/zod-validator";
import {
  addChageSchema,
  generateConciliationSchema,
  rateSchema,
} from "../schemas/servicesSchema";
import { db } from "../db/db";
import { eq, sql, and, sum } from "drizzle-orm";
import { Assistants, Doctors, Queries, Users } from "../db/schemas";

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
        401
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
      })
      .from(Assistants)
      .where(eq(Assistants.id, assistantId));

    const total = data[0]?.total ?? 0;
    const change = data[0]?.change ?? 0;

    return c.json({ success: true, data: { total, change } });
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
      console.log("error en la busqueda de mi asii")
      return c.json({ success: false }, 500);
    }

    const assistant = await db
      .select({
        total: Assistants.total,
      })
      .from(Assistants)
      .where(eq(Assistants.id, assistantId));

    const max = assistant[0]?.total ?? 0;

    if (max === 0) return c.json({ success: false }, 500);

    const schema = generateConciliationSchema(max);
    const body = await c.req.json();
    console.log(body);

    const result = schema.safeParse(body);

    if (!result.success) return c.json({ success: false }, 500);

    const setTotal= max - result.data.total;

    await db
      .update(Assistants)
      .set({ total: setTotal })
      .where(eq(Assistants.id, assistantId));


    return c.json({ success: true }, 200);
  })
  //update rate
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
  });
