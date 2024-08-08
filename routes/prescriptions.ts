import { db } from "../db/db";
import {
  Drugs,
  Prescriptions,
  PrescriptionsDetails,
  Queries,
} from "../db/schemas";
import { prescriptionDetailSchema } from "../schemas/prescriptionSchema";
import { eq, and, exists } from "drizzle-orm";
import type { authVariables } from "../types/auth";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import doctorIdentification from "../lib/doctorIdentification";
import type { detail } from "../schemas/prescriptionSchema";
export const prescriptionsRoute = new Hono<{ Variables: authVariables }>()

  //ADD PRESCRIPTION
  .post(
    "/create/:querieId",
    zValidator("json", prescriptionDetailSchema),
    async (c) => {
      const { details } = c.req.valid("json");
      const user = c.get("user");
      if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
      if (user.role !== "DOCTOR")
        return c.json({ success: false, error: "No autorizado" }, 401);

      const querieId = c.req.param("querieId");
      if (!querieId)
        return c.json({ success: false, error: "El id es requerido" }, 500);

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId)
        return c.json({ success: false, error: "No autorizado" }, 401);

      try {
        const findQuery = await db
          .select()
          .from(Queries)
          .where(
            and(eq(Queries.id, querieId), eq(Queries.doctorsId, doctorId))
          );

        if (!findQuery[0])
          return c.json({ success: false, error: "No autorizado" }, 401);

        const newPrescription = await db
          .insert(Prescriptions)
          .values({
            querieId: querieId,
          })
          .returning();

        // Iterate over each prescription detail
        for (const element of details) {
          const search = await db
            .select()
            .from(Drugs)
            .where(eq(Drugs.id, element.drugId));

          if (!search[0].presentations!.includes(element.presentation)) {
            // Verify if the new presentation exists, if not, add it
            await db
              .update(Drugs)
              .set({
                presentations: [
                  ...search[0].presentations!,
                  element.presentation,
                ],
              })
              .where(eq(Drugs.id, search[0].id));
          }

          // Check if there's a change in the generic name
          if (search[0].genericName !== element.genericName) {
            await db
              .update(Drugs)
              .set({
                genericName: element.genericName,
              })
              .where(eq(Drugs.id, search[0].id));
          }

          // Create a new prescription detail
          await db.insert(PrescriptionsDetails).values({
            prescriptionId: newPrescription[0].id,
            drugId: element.drugId,
            indications: element.indications,
            presentations: element.presentation,
          });
        }
        return c.json({ success: true, error: "" });
      } catch (e) {
        console.log("Error creating prescription: ", e);
        return c.json({ success: false, error: "Error creating prescription" });
      }
    }
  )

  //ADD PRESCRIPTION
  .put(
    "/:querieId",
    zValidator("json", prescriptionDetailSchema),
    async (c) => {
      const { details } = c.req.valid("json");
      const user = c.get("user");
      if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
      if (user.role !== "DOCTOR")
        return c.json({ success: false, error: "No autorizado" }, 401);

      const querieId = c.req.param("querieId");
      if (!querieId)
        return c.json({ success: false, error: "El id es requerido" }, 500);

      
      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId)
        return c.json({ success: false, error: "No autorizado" }, 401);

      try {
        const findQuery = await db
          .select({
            prescriptionId: Prescriptions.id,
          })
          .from(Queries)
          .innerJoin(Prescriptions, eq(Prescriptions.querieId, Queries.id))
          .where(
            and(eq(Queries.id, querieId), eq(Queries.doctorsId, doctorId))
          );

        if (!findQuery[0])
          return c.json({ success: false, error: "No autorizado" }, 401);

        //Delete old details
        await db
          .delete(PrescriptionsDetails)
          .where(
            eq(PrescriptionsDetails.prescriptionId, findQuery[0].prescriptionId)
          );

        // Iterate over each prescription detail
        for (const element of details) {          
          const search = await db
            .select()
            .from(Drugs)
            .where(eq(Drugs.id, element.drugId));

          if (!search[0].presentations!.includes(element.presentation)) {
            // Verify if the new presentation exists, if not, add it
            await db
              .update(Drugs)
              .set({
                presentations: [
                  ...search[0].presentations!,
                  element.presentation,
                ],
              })
              .where(eq(Drugs.id, search[0].id));
          }

          // Check if there's a change in the generic name
          if (search[0].genericName !== element.genericName) {
            await db
              .update(Drugs)
              .set({
                genericName: element.genericName,
              })
              .where(eq(Drugs.id, search[0].id));
          }

          // insert new details
          await db.insert(PrescriptionsDetails).values({
            prescriptionId: findQuery[0].prescriptionId,
            drugId: element.drugId,
            indications: element.indications,
            presentations: element.presentation,
          });
        }
        return c.json({ success: true, error: "" });
      } catch (e) {
        console.log("Error creating prescription: ", e);
        return c.json({ success: false, error: "Error creating prescription" });
      }
    }
  )

  //Obtener la prescripcion
  .get("/", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json({ exist: null, error: "No autorizado", data: null }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ exist: null, error: "No autorizado", data: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ exist: null, error: "No autorizado", data: null }, 401);

    const query = c.req.query("q");
    if (!query)
      return c.json({ exist: null, error: "id requerido", data: null }, 401);

    const prescription = await db
      .select({
        id: Prescriptions.id,
        querieId: Prescriptions.querieId,
        doctorId: Queries.doctorsId,
      })
      .from(Prescriptions)
      .innerJoin(Queries, eq(Prescriptions.querieId, Queries.id))
      .where(eq(Prescriptions.querieId, query));

    if (prescription.length > 0) {
      if (prescription[0].doctorId != doctorId) {
        return c.json({ exist: null, error: "No autorizado", data: null }, 401);
      }

      const result = await db
        .select({
          id: PrescriptionsDetails.id,
          drugId: PrescriptionsDetails.drugId,
          tradeName: Drugs.tradeName,
          genericName: Drugs.genericName,
          presentation: PrescriptionsDetails.presentations,
          indications: PrescriptionsDetails.indications,
        })
        .from(PrescriptionsDetails)
        .innerJoin(Drugs, eq(PrescriptionsDetails.drugId, Drugs.id))
        .where(eq(PrescriptionsDetails.prescriptionId, prescription[0].id));

      return c.json(
        { exist: true, data: result as detail[], error: null },
        200
      );
    } else {
      return c.json({ exist: false, error: null, data: null }, 401);
    }
  });
