import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import doctorIdentification from "../lib/doctorIdentification";
import { zValidator } from "@hono/zod-validator";
import { addChageSchema } from "../schemas/servicesSchema";
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
        amount: sql`${Assistants.amount} + ${data.amount}`,
      })
      .where(eq(Assistants.id, assistant[0].assistantId));

    return c.json({ success: true });
  })

  .get("/money", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json({ success: false, change: null, total: null }, 401);
    if (user.role !== "ASSISTANT")
      return c.json({ success: false, change: null, total: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, change: null, total: null }, 401);
    }

    const data = await db
      .select({
        change: Assistants.amount,
      })
      .from(Assistants)
      .where(eq(Assistants.userId, user.id));

    //efectivo actual
    const result = await db
      .select({
        totalPrice: sum(Queries.price),
      })
      .from(Queries)
      .where(
        and(
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          eq(Queries.userChargeId, user.id),
          eq(Queries.conciliated, false)
        )
      );

    console.log(result);

    const totalPrice = result[0]?.totalPrice ?? 0;
    return c.json({ success: true, change: data[0].change ?? 0, total: totalPrice });
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
      .select({ amount: Assistants.amount, name: Users.name })
      .from(Assistants)
      .innerJoin(Users, eq(Assistants.userId, Users.id))
      .where(eq(Assistants.id, assistantId));

    return c.json({ success: true, data: assistant[0] });
  });
