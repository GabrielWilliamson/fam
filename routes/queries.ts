import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { db } from "../db/db";
import {
  Assistants,
  Dates,
  Exams,
  Files,
  Patients,
  Prescriptions,
  Queries,
} from "../db/schemas";
import { eq, and, isNull, desc, ne, sum, sql, isNotNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import {
  antropometricsSchema,
  vitalsSchema,
  type antropometrics,
  type vitals,
} from "../schemas/vitalSchema";
import {
  autoSchema,
  chargeSchema,
  headSchema,
  priceSchema,
  toraxSchema,
} from "../schemas/querieSchema";
import doctorIdentification from "../lib/identification";
import { genSalt } from "bcryptjs";
import type { querieBase } from "../types/queries";
import { z } from "zod";

export const queriesRoute = new Hono<{ Variables: authVariables }>()

  //Create regular query
  .post("/:dateId", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, redirect: null, error: "No autorizado", role: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, redirect: null, error: "No autorizado", role: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, redirect: null, error: "No autorizado", role: null },
        401
      );

    const dateId = c.req.param("dateId");
    if (!dateId) {
      return c.json(
        {
          success: false,
          redirect: null,
          error: "El id es requerido",
          role: null,
        },
        500
      );
    }

    const dateInfo = await db
      .select({
        dateId: Dates.id,
        idFile: Files.id,
        doctorId: Dates.doctorId,
      })
      .from(Dates)
      .innerJoin(Files, eq(Files.patientId, Dates.patientId))
      .where(and(eq(Dates.id, dateId), eq(Dates.doctorId, doctorId)));

    if (dateInfo.length === 0) {
      console.log("No se encontro la cita");
      return c.json(
        {
          success: false,
          redirect: null,
          error: "No se encotro la cita",
          role: null,
        },
        500
      );
    }

    const findQuerie = await db
      .select()
      .from(Queries)
      .where(eq(Queries.dateId, dateId));

    if (findQuerie.length > 0) {
      return c.json(
        { success: true, redirect: findQuerie[0].id, error: null, role: null },
        500
      );
    }

    const result = await db
      .insert(Queries)
      .values({
        dateId: dateInfo[0].dateId!,
        idFile: dateInfo[0].idFile!,
        doctorId: dateInfo[0].doctorId!,
        status: "process",
      })
      .returning({
        querieId: Queries.id,
      });

    await db.insert(Exams).values({
      querieId: result[0].querieId,
    });

    await db
      .update(Dates)
      .set({ status: "process" })
      .where(eq(Dates.id, dateId));

    return c.json(
      {
        success: true,
        redirect: result[0].querieId,
        error: null,
        role: user.role,
      },
      200
    );
  })

  //Create query emergency

  //get current query
  .get("/data", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const uuidSchema = z.string().uuid();
    const result = uuidSchema.safeParse(querieId);

    if (!result.success)
      return c.json(
        { success: false, error: result.error.message, data: null },
        500
      );

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const QuerieData = await db
      .select({
        id: Queries.id,
        dateId: Queries.dateId,
        idFile: Queries.idFile,
        emergency: Queries.emergency,
        name: Patients.name,
        patientId: Patients.id,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .where(and(eq(Queries.id, querieId), eq(Queries.doctorId, doctorId)));

    return c.json({ success: true, error: null, data: QuerieData[0] }, 200);
  })
  //Obtener la consulta base para los (autosave)
  .get("/base", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const QuerieData = await db
      .select({
        querieId: Queries.id,
        interrogation: Queries.interrogation,
        reason: Queries.reason,
        history: Queries.history,
        observations: Queries.observations,
        diag: Queries.diag,
        aspects: Exams.aspects,
        skin: Exams.skin,
        abd: Exams.abd,
        exInf: Exams.exInf,
        exSup: Exams.exSup,
        anus: Exams.anus,
        genitu: Exams.genitu,
        neuro: Exams.neuro,
      })
      .from(Queries)
      .innerJoin(Exams, eq(Exams.querieId, Queries.id))
      .where(and(eq(Queries.id, querieId), eq(Queries.doctorId, doctorId)));

    return c.json({ success: true, data: QuerieData[0] as querieBase }, 200);
  })
  //obtener el examen fisico
  .get("/exam", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );
    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 500);
    }

    const queryFind = await db
      .select()
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);
    const query = queryFind[0];

    if (query.doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const examData = await db
      .select({
        vitals: Exams.vitals,
        antropometrics: Exams.antropometrics,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    const data = examData[0].vitals;
    const data2 = examData[0].antropometrics;

    if (data === null && data2 === null) {
      return c.json(
        {
          success: true,
          data: {
            vitals: null,
            antropometrics: null,
          },
        },
        200
      );
    }
    const result = JSON.stringify(data);
    const vitalsData: vitals = JSON.parse(result);

    const result2 = JSON.stringify(data2);
    const antropometricsData: antropometrics = JSON.parse(result2);

    return c.json(
      {
        success: true,
        data: {
          vitals: vitalsData,
          antropometrics: antropometricsData,
        },
      },
      200
    );
  })
  //save vitals
  .post("/vitals/:querieId", zValidator("json", vitalsSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    const newData = c.req.valid("json");

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const findQuerie = await db
      .select({
        status: Queries.status,
        doctorId: Queries.doctorId,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (findQuerie[0].doctorId !== doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    if (findQuerie.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);

    if (findQuerie[0].status === "end")
      return c.json({ success: false, error: "Consulta finalizada" }, 500);

    // Obtener los datos existentes
    const existingData = await db
      .select({
        vitals: Exams.vitals,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    // Recuperar el objeto existente de signos vitales
    const existingVitals = existingData[0]?.vitals || {};

    // Combinar datos existentes con los nuevos (actualizar campos existentes y agregar nuevos)
    const updatedVitals = {
      ...existingVitals,
      ...newData,
    };

    // Actualizar el registro
    await db
      .update(Exams)
      .set({
        vitals: updatedVitals,
      })
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, error: null }, 200);
  })
  //save antropometrics
  .post(
    "/antro/:querieId",
    zValidator("json", antropometricsSchema),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
      if (user.role === "ADMIN")
        return c.json({ success: false, error: "No autorizado" }, 401);

      const doctorId = await doctorIdentification(user.id, user.role);
      if (!doctorId)
        return c.json({ success: false, error: "No autorizado" }, 401);

      const newData = c.req.valid("json");

      const querieId = c.req.param("querieId");
      if (!querieId)
        return c.json({ success: false, error: "El id es requerido" }, 500);

      const findQuerie = await db
        .select({
          status: Queries.status,
          doctorId: Queries.doctorId,
        })
        .from(Queries)
        .where(eq(Queries.id, querieId));

      if (findQuerie[0].doctorId !== doctorId)
        return c.json({ success: false, error: "No autorizado" }, 401);

      if (findQuerie.length === 0)
        return c.json({ success: false, error: "No existe la consulta" }, 500);

      if (findQuerie[0].status === "end")
        return c.json({ success: false, error: "Consulta finalizada" }, 500);

      // Obtener los datos existentes
      const existingData = await db
        .select({
          antropometrics: Exams.antropometrics,
        })
        .from(Exams)
        .where(eq(Exams.querieId, querieId));

      // Recuperar el objeto existente de antropométricos
      const existingAntropometrics = existingData[0]?.antropometrics || {};

      // Combinar datos existentes con los nuevos (actualizar campos existentes y agregar nuevos)
      const updatedAntropometrics = {
        ...existingAntropometrics,
        ...newData,
      };

      // Actualizar el registro
      await db
        .update(Exams)
        .set({
          antropometrics: updatedAntropometrics,
        })
        .where(eq(Exams.querieId, querieId));

      return c.json({ success: true, error: null }, 200);
    }
  )
  //auto save inputs
  .patch("/auto/:querieId", zValidator("json", autoSchema), async (c) => {
    const user = c.get("user");

    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 500);
    }
    console.log("hello friend");

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const queryFind = await db
      .select({
        doctorId: Queries.doctorId,
        status: Queries.status,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);

    if (queryFind[0].doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }
    if (queryFind[0].status === "end")
      return c.json({ success: false, error: "Consulta finalizada" }, 500);

    const { data, autoType } = c.req.valid("json");

    if (autoType === "history") {
      await db
        .update(Queries)
        .set({ history: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "obs") {
      await db
        .update(Queries)
        .set({ observations: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "reason") {
      await db
        .update(Queries)
        .set({ reason: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "interrogation") {
      await db
        .update(Queries)
        .set({ interrogation: data })
        .where(eq(Queries.id, querieId));
    }
    if (autoType === "diag") {
      await db
        .update(Queries)
        .set({ diag: data })
        .where(eq(Queries.id, querieId));
    }

    if (autoType === "abd") {
      await db
        .update(Exams)
        .set({ abd: data })
        .where(eq(Exams.querieId, querieId));
    }

    if (autoType === "anus") {
      await db
        .update(Exams)
        .set({ anus: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "aspects") {
      await db
        .update(Exams)
        .set({ anus: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "exInf") {
      await db
        .update(Exams)
        .set({ exInf: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "exSup") {
      await db
        .update(Exams)
        .set({ exSup: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "gen") {
      await db
        .update(Exams)
        .set({ genitu: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "neu") {
      await db
        .update(Exams)
        .set({ neuro: data })
        .where(eq(Exams.querieId, querieId));
    }
    if (autoType === "skin") {
      await db
        .update(Exams)
        .set({ skin: data })
        .where(eq(Exams.querieId, querieId));
    }

    return c.json({ success: true, error: null }, 200);
  })
  //save head
  .patch("/head/:querieId", zValidator("json", headSchema), async (c) => {
    const user = c.get("user");

    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 500);
    }

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const queryFind = await db
      .select({
        doctorId: Queries.doctorId,
        status: Queries.status,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);
    const query = queryFind[0];

    if (query.doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    await db
      .update(Exams)
      .set({ hea: data })
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, error: null }, 200);
  })
  //save torax
  .patch("/torax/:querieId", zValidator("json", toraxSchema), async (c) => {
    const user = c.get("user");

    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role !== "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 500);
    }

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const queryFind = await db
      .select()
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);
    const query = queryFind[0];

    if (query.doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    await db
      .update(Exams)
      .set({ tor: data })
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, error: null }, 200);
  })
  //obtener head y torax
  .get("/grups", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const querieId = c.req.query("querieId");
    if (!querieId)
      return c.json(
        { success: false, error: "El id es requerido", data: null },
        500
      );

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        500
      );
    }

    const queryFind = await db
      .select({
        doctorId: Queries.doctorId,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (queryFind.length === 0)
      return c.json(
        { success: false, error: "No existe la consulta", data: null },
        500
      );
    const query = queryFind[0];

    if (query.doctorId !== doctorId) {
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    }

    const data = await db
      .select({
        head: Exams.hea,
        torax: Exams.tor,
      })
      .from(Exams)
      .where(eq(Exams.querieId, querieId));

    return c.json({ success: true, error: null, data: data[0] }, 200);
  })
  //save price data for the doctor
  .patch("/end/:querieId", zValidator("json", priceSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role != "DOCTOR")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    //find querie
    const queryFind = await db
      .select({
        dateId: Queries.dateId,
        doctorId: Queries.doctorId,
      })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    //check the doctor has access to the query

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);

    if (queryFind[0].doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    const data = c.req.valid("json");

    //if pay is true, the doctor is
    //the user who is going to charge

    //define cost and paiment status
    //save status as end

    await db
      .update(Queries)
      .set({
        price: data.price,
        status: "end",
        collector: data.pay ? user.id : null,
      })
      .where(eq(Queries.id, querieId));

    //change status in dates table
    await db
      .update(Dates)
      .set({ status: "end" })
      .where(eq(Dates.id, queryFind[0].dateId));

    return c.json({ success: true, error: null }, 200);
  })
  //charge querie
  .patch("/charge/:querieId", zValidator("json", chargeSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "No autorizado" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json({ success: false, error: "No autorizado" }, 401);

    const querieId = c.req.param("querieId");
    if (!querieId)
      return c.json({ success: false, error: "El id es requerido" }, 500);

    const data = c.req.valid("json");
    //find querie
    const queryFind = await db
      .select({
        doctorId: Queries.doctorId,
      })
      .from(Queries)
      .where(
        and(
          eq(Queries.id, querieId),
          eq(Queries.status, "end"),
          isNull(Queries.collector)
        )
      );

    //check the doctor has access to the query

    if (queryFind.length === 0)
      return c.json({ success: false, error: "No existe la consulta" }, 500);

    if (queryFind[0].doctorId !== doctorId) {
      return c.json({ success: false, error: "No autorizado" }, 401);
    }

    //save to pait query

    const result = await db
      .update(Queries)
      .set({ collector: user.id })
      .where(eq(Queries.id, querieId))
      .returning({
        price: Queries.price,
      });

    const price = result[0].price;

    //update total for the assistant
    await db
      .update(Assistants)
      .set({
        total: sql`${Assistants.total} + ${price}`,
        dollars: sql`${Assistants.dollars} + ${data.dolares}`,
        cordobas: sql`${Assistants.cordobas} + ${data.cordobas}`,
      })
      .where(eq(Assistants.userId, user.id));

    return c.json({ success: true, error: null }, 200);
  })
  //list queries pending charges
  .get("/earrings", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
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
          isNull(Queries.collector)
        )
      );

    return c.json({ success: true, error: null, data: queries }, 200);
  })
  //collect for the assistant
  .get("/collected", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role !== "DOCTOR")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
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
          ne(Queries.collector, user.id)
        )
      );
    return c.json({ success: true, error: null, data: queries }, 200);
  })
  //list queries where process
  .get("/process", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
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
        and(eq(Queries.doctorId, doctorId), eq(Queries.status, "process"))
      );

    return c.json({ success: true, error: null, data: queries }, 200);
  })
  .get("/recent", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );
    if (user.role === "ADMIN")
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId)
      return c.json(
        { success: false, error: "No autorizado", data: null },
        401
      );

    const queries = await db
      .select({
        id: Queries.id,
        patientName: Patients.name,
        pending: Queries.collector,
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
  });
