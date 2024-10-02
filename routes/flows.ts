import type { authVariables } from "../types/auth";
import { Hono } from "hono";
import {
  Assistants,
  BankAccounts,
  Dates,
  Doctors,
  Files,
  Flows,
  Patients,
  Queries,
} from "../db/schemas";
import { eq, sql, and, isNull, ne, desc, isNotNull } from "drizzle-orm";
import { db } from "../db/db";
import { zValidator } from "@hono/zod-validator";
import { chargeSchemaAssistant, priceSchema } from "../schemas/flowsSchema";
import doctorIdentification from "../lib/identification";
import { bankAccountSchema } from "../schemas/flowsSchema";

export const flowsRoute = new Hono<{ Variables: authVariables }>()
  // end query
  .patch("/end/:querieId", zValidator("json", priceSchema), async (c) => {
    try {
      const user = c.get("user");
      if (!user || user.role !== "DOCTOR") {
        return c.json({ success: false, error: "No autorizado" }, 401);
      }

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId) {
        return c.json({ success: false, error: "No autorizado" }, 401);
      }

      const querieId = c.req.param("querieId");
      if (!querieId) {
        console.log("No id");
        return c.json({ success: false, error: "El id es requerido" }, 400);
      }

      // Find the query
      const queryFind = await db
        .select({
          dateId: Queries.dateId,
          doctorId: Queries.doctorId,
        })
        .from(Queries)
        .where(eq(Queries.id, querieId));

      if (queryFind.length === 0) {
        return c.json({ success: false, error: "No existe la consulta" }, 404);
      }

      if (queryFind[0].doctorId !== doctorId) {
        return c.json({ success: false, error: "No autorizado" }, 403);
      }

      const data = c.req.valid("json");

      // Start a transaction for updating records
      await db.transaction(async (tx) => {
        // Charge personally logic
        if (data.chargePersonally) {
          if (data.paymentMethod === "transfer") {
            if (data.bankAccountId === null) {
              return c.json(
                { success: false, error: "La cuenta bancaria es requerida" },
                404,
              );
            }

            // Validate bank account
            const bankAccountFind = await db
              .select({
                currency: BankAccounts.currency,
              })
              .from(BankAccounts)
              .where(
                and(
                  eq(BankAccounts.id, data.bankAccountId),
                  eq(BankAccounts.doctorId, doctorId),
                ),
              );

            if (bankAccountFind.length === 0) {
              return c.json(
                { success: false, error: "Cuenta bancaria no encontrada" },
                404,
              );
            }

            // Get the doctor's rate for currency conversion
            const rateData = await db
              .select({ rate: Doctors.rate })
              .from(Doctors)
              .where(eq(Doctors.id, doctorId));

            // Determine the values for the flow
            let cordobas = 0;
            let dollars = 0;

            // Assume currency is determined based on the bank account currency
            if (bankAccountFind[0].currency === "cor") {
              cordobas = data.price; // Charge in córdobas
            } else if (bankAccountFind[0].currency === "dol") {
              dollars = data.price / rateData[0].rate;
            }

            // Insert flow record for the transfer
            const flow = await tx
              .insert(Flows)
              .values({
                flow: "income",
                description: "query",
                doctorId: doctorId,
                chargeTo: user.id,
                total: data.price,
                cordobas,
                dollars,
                bankAccountId: data.bankAccountId,
              })
              .returning({ id: Flows.id });

            // Update the query with flowId
            await tx
              .update(Queries)
              .set({
                price: data.price,
                status: "end",
                flowId: flow[0].id,
              })
              .where(eq(Queries.id, querieId));
          }

          if (data.paymentMethod === "cash") {
            // Insert flow record for the cash
            const flow = await tx
              .insert(Flows)
              .values({
                flow: "income",
                description: "query",
                doctorId: doctorId,
                chargeTo: user.id,
                total: data.price,
                cordobas: data.cordobas ?? 0 - (data.change ?? 0),
                dollars: data.dollars ?? 0,
              })
              .returning({ id: Flows.id });

            // Update doctor's account for cash payment
            await tx
              .update(Doctors)
              .set({
                total: sql`${Doctors.total} + ${data.price}`,
                dollars: sql`${Doctors.dollars} + ${data.dollars ?? 0}`,
                cordobas: sql`${Doctors.cordobas} + ${
                  (data.cordobas ?? 0) - (data.change ?? 0)
                }`,
              })
              .where(eq(Doctors.id, doctorId));

            // Update the query with flowId
            await tx
              .update(Queries)
              .set({
                price: data.price,
                status: "end",
                flowId: flow[0].id,
              })
              .where(eq(Queries.id, querieId));
          }
        } else {
          // No personal charge, update query without flowId
          await tx
            .update(Queries)
            .set({
              price: data.price,
              status: "end",
              flowId: null,
            })
            .where(eq(Queries.id, querieId));
        }

        // Update the date status if applicable
        if (queryFind[0].dateId !== null) {
          await tx
            .update(Dates)
            .set({ status: "end" })
            .where(eq(Dates.id, queryFind[0].dateId));
        }
      });

      return c.json({ success: true, error: null }, 200);
    } catch (error) {
      console.error("Error ending query:", error);
      return c.json(
        { success: false, error: "Error al finalizar la consulta" },
        500,
      );
    }
  })
  //charge doctor
  .patch("/charged/:querieId", zValidator("json", priceSchema), async (c) => {
    try {
      const user = c.get("user");
      if (!user || user.role !== "DOCTOR") {
        return c.json({ success: false, error: "No autorizado" }, 401);
      }

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId) {
        return c.json({ success: false, error: "No autorizado" }, 401);
      }

      const querieId = c.req.param("querieId");
      if (!querieId) {
        return c.json({ success: false, error: "El id es requerido" }, 400);
      }

      const data = c.req.valid("json");

      await db.transaction(async (tx) => {
        const [query] = await tx
          .select({ doctorId: Queries.doctorId, price: Queries.price })
          .from(Queries)
          .where(
            and(
              eq(Queries.id, querieId),
              eq(Queries.status, "end"),
              isNull(Queries.flowId),
              eq(Queries.doctorId, doctorId),
            ),
          );

        if (!query) {
          throw new Error("Consulta no encontrada o no autorizada");
        }

        if (data.paymentMethod === "transfer") {
          if (data.bankAccountId === null) {
            return c.json(
              { success: false, error: "La cuenta bancaria es requerida" },
              404,
            );
          }
          const bankAccountFind = await tx
            .select({ currency: BankAccounts.currency })
            .from(BankAccounts)
            .where(
              and(
                eq(BankAccounts.id, data.bankAccountId),
                eq(BankAccounts.doctorId, doctorId),
              ),
            );

          if (bankAccountFind.length === 0) {
            throw new Error("Cuenta bancaria no encontrada");
          }

          const [rateData] = await tx
            .select({ rate: Doctors.rate })
            .from(Doctors)
            .where(eq(Doctors.id, doctorId));

          let cordobas = 0;
          let dollars = 0;

          if (bankAccountFind[0].currency === "cor") {
            cordobas = data.price;
          } else if (bankAccountFind[0].currency === "dol") {
            dollars = data.price / rateData.rate;
          }

          const [flow] = await tx
            .insert(Flows)
            .values({
              flow: "income",
              description: "query",
              doctorId: doctorId,
              chargeTo: user.id,
              total: data.price,
              cordobas,
              dollars,
              bankAccountId: data.bankAccountId,
            })
            .returning({ id: Flows.id });

          await tx
            .update(Queries)
            .set({
              flowId: flow.id,
            })
            .where(eq(Queries.id, querieId));
        } else if (data.paymentMethod === "cash") {
          const [flow] = await tx
            .insert(Flows)
            .values({
              flow: "income",
              description: "query",
              doctorId: doctorId,
              chargeTo: user.id,
              total: data.price,
              cordobas: data.cordobas ?? 0 - (data.change ?? 0),
              dollars: data.dollars ?? 0,
            })
            .returning({ id: Flows.id });

          await tx
            .update(Doctors)
            .set({
              total: sql`${Doctors.total} + ${data.price}`,
              dollars: sql`${Doctors.dollars} + ${data.dollars ?? 0}`,
              cordobas: sql`${Doctors.cordobas} + ${(data.cordobas ?? 0) - (data.change ?? 0)}`,
            })
            .where(eq(Doctors.id, doctorId));

          await tx
            .update(Queries)
            .set({
              flowId: flow.id,
            })
            .where(eq(Queries.id, querieId));
        }
      });

      return c.json({ success: true, error: null }, 200);
    } catch (error) {
      console.error("Error processing charge:", error);
      return c.json({ success: false, error: "Error processing charge" }, 500);
    }
  })
  // Charge query for assistant (cash only)
  .patch(
    "/chargea/:querieId",
    zValidator("json", chargeSchemaAssistant),
    async (c) => {
      try {
        const user = c.get("user");
        if (!user || user.role !== "ASSISTANT") {
          return c.json({ success: false, error: "No autorizado" }, 401);
        }

        const querieId = c.req.param("querieId");
        if (!querieId) {
          return c.json({ success: false, error: "El id es requerido" }, 400);
        }

        const doctorId = await doctorIdentification(user.id, user.role);
        if (!doctorId) {
          return c.json({ success: false, error: "No autorizado" }, 500);
        }

        const data = c.req.valid("json");

        const query = await db
          .select({ price: Queries.price })
          .from(Queries)
          .where(
            and(
              eq(Queries.id, querieId),
              eq(Queries.doctorId, doctorId),
              eq(Queries.status, "end"),
              isNull(Queries.flowId),
            ),
          );

        if (query.length === 0) {
          throw new Error("Consulta no encontrada o ya cobrada");
        }

        if (query[0].price === null) {
          throw new Error("Consulta no encontrada o ya cobrada");
        }

        const flow = await db
          .insert(Flows)
          .values({
            flow: "income",
            doctorId: doctorId,
            description: "query",
            chargeTo: user.id,
            total: query[0].price,
            cordobas: data.cordobas,
            dollars: data.dollars,
          })
          .returning({ id: Flows.id });

        await db
          .update(Assistants)
          .set({
            total: sql`${Assistants.total} + ${query[0].price}`,
            dollars: sql`${Assistants.dollars} + ${data.dollars}`,
            cordobas: sql`${Assistants.cordobas} + ${(data.cordobas ?? 0) - (data.change ?? 0)}`,
          })
          .where(eq(Assistants.userId, user.id));

        await db
          .update(Queries)
          .set({
            flowId: flow[0].id,
          })
          .where(eq(Queries.id, querieId));

        return c.json({ success: true, error: null }, 200);
      } catch (error) {
        console.error("Error processing charge:", error);
        return c.json(
          { success: false, error: "Error processing charge" },
          500,
        );
      }
    },
  )
  //list bank accounts
  .get("/bankaccounts", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    }

    const bankAccounts = await db
      .select({
        id: BankAccounts.id,
        name: BankAccounts.name,
        currency: BankAccounts.currency,
        color: BankAccounts.color,
      })
      .from(BankAccounts)
      .where(eq(BankAccounts.doctorId, doctorId));

    return c.json({ success: true, error: null, data: bankAccounts }, 200);
  })
  //new account
  .post("/bankaccounts", zValidator("json", bankAccountSchema), async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    await db.insert(BankAccounts).values({
      doctorId: doctorId,
      name: data.name,
      color: data.color,
      currency: data.currency,
    });

    return c.json({ success: true, error: null }, 200);
  })
  //list queries pending charges
  .get("/earrings", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const queries = await db
      .select({
        id: Queries.id,
        patientName: Patients.name,
        emergency: Queries.emergency,
        date: Queries.createdAt,
        price: Queries.price,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(
        and(
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          isNull(Queries.flowId),
        ),
      );

    return c.json({ success: true, error: null, data: queries }, 200);
  })
  //collect for the assistant
  .get("/collected", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const queries = await db
      .select({
        id: Queries.id,
        patientName: Patients.name,
        emergency: Queries.emergency,
        date: Queries.createdAt,
        price: Queries.price,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .innerJoin(Flows, eq(Flows.id, Queries.flowId))
      .where(
        and(
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          ne(Flows.chargeTo, user.id),
        ),
      );
    return c.json({ success: true, error: null, data: queries }, 200);
  })
  //list queries where process
  .get("/process", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const queries = await db
      .select({
        id: Queries.id,
        patientName: Patients.name,
        emergency: Queries.emergency,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(
        and(eq(Queries.doctorId, doctorId), eq(Queries.status, "process")),
      );

    return c.json({ success: true, error: null, data: queries }, 200);
  })
  .get("/recent", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );

    const queries = await db
      .select({
        id: Queries.id,
        patientName: Patients.name,
        pending: Queries.flowId,
        emergency: Queries.emergency,
        price: Queries.price,
        createdAt: Queries.createdAt,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(and(eq(Queries.doctorId, doctorId), eq(Queries.status, "end")))
      .limit(8)
      .orderBy(desc(Queries.createdAt));

    return c.json({ success: true, error: null, data: queries }, 200);
  })

  .get("/flowsbanks", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    }
    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401,
      );
    }
    const dateParam = c.req.query("dateParam");

    if (!dateParam) {
      return c.json(
        {
          success: false,
          error: "Formato de fecha inválido. Use YYYY-MM-DD",
          data: null,
        },
        400,
      );
    }

    const groupData = await db
      .select({
        bankAccountName: BankAccounts.name,
        bankCurrency: BankAccounts.currency,
        bankColor: BankAccounts.color,
        totalCordobas: sql<number>`sum(${Flows.cordobas})`,
        totalDollars: sql<number>`sum(${Flows.dollars})`,
        count: sql<number>`count(*)`,
      })
      .from(Flows)
      .innerJoin(Queries, eq(Flows.id, Queries.flowId))
      .innerJoin(BankAccounts, eq(Flows.bankAccountId, BankAccounts.id))
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(
        and(
          eq(Flows.flow, "income"),
          isNotNull(Queries.flowId),
          isNotNull(Flows.bankAccountId),
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          eq(sql`DATE(${Flows.createdAt})`, sql`DATE(${dateParam})`),
        ),
      )
      .groupBy(BankAccounts.name, BankAccounts.currency, BankAccounts.color);

    const listData = await db
      .select({
        queryId: Queries.id,
        patientName: Patients.name,
        price: Queries.price,
        bankAccountName: BankAccounts.name,
        bankCurrency: BankAccounts.currency,
        transactionDate: Flows.createdAt,
        cordobas: Flows.cordobas,
        dollars: Flows.dollars,
      })
      .from(Flows)
      .innerJoin(Queries, eq(Flows.id, Queries.flowId))
      .innerJoin(BankAccounts, eq(Flows.bankAccountId, BankAccounts.id))
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(
        and(
          eq(Flows.flow, "income"),
          isNotNull(Queries.flowId),
          isNotNull(Flows.bankAccountId),
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          eq(sql`DATE(${Flows.createdAt})`, sql`DATE(${dateParam})`),
        ),
      );

    return c.json(
      {
        success: true,
        error: null,
        data: {
          groupData,
          listData,
        },
      },
      200,
    );
  });
