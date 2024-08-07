import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import {
  patientSchema,
  pediatricPatientSchema,
  type tPatientSchema,
  type tPediatricPatientSchema,
} from "../schemas/patientSchema";
import { db } from "../db/db";
import { Patients, Files, Doctors, Users, Relatives } from "../db/schemas";
import { and, eq, or, sql } from "drizzle-orm";
import type {
  tablePatients,
  addressType,
  patientFile,
  searchPatient,
  smsTable,
} from "../types/patient";
import {
  NewId,
  calculateFullAge,
  transformAddress,
  transformOrigin,
} from "../lib/patients";
import doctorIdentification from "../lib/doctorIdentification";
import type { z } from "zod";

type ApiResponse<T = {}> = {
  success: boolean;
  error?: any;
  action: "now" | "date" | null;
  patientId?: string;
} & T;

export const patientsRoute = new Hono<{ Variables: authVariables }>()

  .get("/all", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const patients = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        dni: Patients.dni,
        date: Patients.date,
        fileId: Files.id,
        origin: Patients.address,
        sex: Patients.sex,
        phone: Patients.phone,
        createdAt: Patients.createdAt,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .where(eq(Patients.doctorId, doctorId));

    const formattedPatients = patients.map((patient) => ({
      id: patient.id,
      name: patient.name,
      dni: patient.dni,
      date: patient.date.toString(),
      fileId: patient.fileId,
      address: transformAddress(patient.origin),
      origin: transformOrigin(patient.origin),
      sex: patient.sex,
      phone: patient.phone,
      createdAt: patient.createdAt.toString(),
    }));
    if (formattedPatients.length === 0)
      return c.json({ success: true, data: [] });

    return c.json({
      success: true,
      data: formattedPatients as tablePatients[],
    });
  })

  .get("/search", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const query = c.req.query("q");
    if (!query) return c.json({ success: false, data: [] }, 401);

    const normalizedQuery = query.trim().toLowerCase();
    const tsQuery = normalizedQuery.split(" ").join(" & ");

    //patient name search
    let patients = await db
      .select({
        id: Patients.id,
        doctorId: Patients.doctorId,
        name: Patients.name,
        fileId: Files.id,
        dni: Patients.dni,
      })
      .from(Patients)
      .where(
        and(
          eq(Patients.doctorId, doctorId),
          or(
            sql`${Patients.name} ILIKE ${"%" + normalizedQuery + "%"}`,
            sql`to_tsvector('simple', lower(${Patients.name})) @@ to_tsquery('simple', ${tsQuery})`
          )
        )
      )
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .limit(10);
    return c.json({ success: true, data: patients as searchPatient[] });
  })

  // NEW PEDIATRIC PATIENT
  .post("/pediatric", async (c) => {
    const user = c.get("user");
    if (!user || user.role === "ADMIN") {
      return c.json(
        {
          success: false,
          error: "user not found",
          action: null,
          patientId: "",
        },
        401
      );
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json(
        {
          success: false,
          error: "user not found",
          action: null,
          patientId: "",
        },
        401
      );
    }

    const body = await c.req.json();
    body.date = new Date(body.date);

    const response = await handlePatientInsertion(
      body,
      doctorId,
      pediatricPatientSchema
    );
    return c.json(response);
  })

  // NEW GENERAL PATIENT
  .post("/general", async (c) => {
    const user = c.get("user");
    if (!user || user.role === "ADMIN") {
      return c.json(
        {
          success: false,
          error: "user not found",
          action: null,
          patientId: "",
        },
        401
      );
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json(
        {
          success: false,
          error: "user not found",
          action: null,
          patientId: "",
        },
        401
      );
    }

    const body = await c.req.json();
    body.date = new Date(body.date);

    const response = await handlePatientInsertion(
      body,
      doctorId,
      patientSchema
    );
    return c.json(response);
  })

  // SEARCH FOR FILE ID
  .get("/file", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role != "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);

    const id = c.req.query("id");
    if (!id)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const patient = await db
      .select({
        name: Patients.name,
        sex: Patients.sex,
        date: Patients.date,
        address: Patients.address,
        id: Patients.id,
        phone: Patients.phone,
        dni: Patients.dni,
        createdAt: Patients.createdAt,
        idFile: Files.id,
      })
      .from(Patients)
      .where(and(eq(Files.id, id), eq(Patients.doctorId, doctorId)))
      .innerJoin(Files, eq(Patients.id, Files.patientId));

    if (!patient)
      return c.json(
        { success: false, error: "No se encontro el paciente", data: null },
        500
      );

    const address = JSON.stringify(patient[0].address);
    const resultAdress: addressType = JSON.parse(address);

    const resultPatient: patientFile = {
      id: patient[0].id,
      fileId: patient[0].idFile,
      name: patient[0].name,
      dni: patient[0].dni,
      country: resultAdress.nationality,
      dapartment: resultAdress.department,
      municipaly: resultAdress.municipality,
      age: calculateFullAge(patient[0].date),
      date: patient[0].date,
      address: resultAdress.address,
      sex: patient[0].sex,
      phone: patient[0].phone,
      createdAt: patient[0].createdAt,
    };

    return c.json({ success: true, data: resultPatient });
  })

  //SEARCH FOR SEND SMS
  .get("/sms", async (c) => {
    const user = c.get("user");
    if (!user)
      return c.json({ success: false, error: "No autorizado", data: [] }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "No autorizado", data: [] }, 401);

    const id = c.req.query("id");
    if (!id)
      return c.json({ success: false, error: "id requerido", data: [] }, 500);

    let patient = await db
      .select({
        doctorId: Patients.doctorId,
        id: Patients.id,
        name: Patients.name,
        phone: Patients.phone,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .where(eq(Patients.id, id))
      .limit(1);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) {
      return c.json({ success: false, error: "No autorizado", data: [] }, 401);
    }

    //No puedes enviar sms a pacientes agenos a tu doctor
    if (doctorId != patient[0].doctorId) {
      return c.json({ success: false, error: "No autorizado", data: [] }, 401);
    }

    let data: smsTable[] = [];

    data.push({
      id: patient[0].id,
      name: patient[0].name,
      phone: patient[0].phone?.toString()!,
      isPatient: true,
      relative: "",
    });

    const relatives = await db
      .select({
        id: Relatives.id,
        name: Relatives.name,
        phone: Relatives.phone,
        relation: Relatives.relation,
      })
      .from(Relatives)
      .where(eq(Relatives.patientId, id));

    if (relatives.length > 0) {
      relatives.forEach((relative) => {
        if (relative.phone) {
          data.push({
            id: relative.id,
            name: relative.name,
            phone: relative.phone,
            isPatient: false,
            relative: relative.relation,
          });
        }
      });
    }
    if (!patient)
      return c.json(
        { success: false, error: "No se encontro el paciente", data: [] },
        500
      );

    return c.json({ success: true, data: data });
  })

  //SEARCH FOR PATIENT
  .get("/id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, data: null }, 401);

    const id = c.req.query("id");
    if (!id)
      return c.json({ success: false, error: "id requerido", data: null }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);

    let patient = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        fileId: Files.id,
        dni: Patients.dni,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .where(and(eq(Patients.id, id), eq(Patients.doctorId, doctorId)))
      .limit(1);

    if (!patient)
      return c.json(
        { success: false, error: "No se encontro el paciente", data: null },
        500
      );

    return c.json({ success: true, data: patient[0] as searchPatient });
  });

async function handlePatientInsertion<
  T extends tPatientSchema | tPediatricPatientSchema
>(data: T, doctorId: string, schema: z.ZodSchema<T>): Promise<ApiResponse> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error, action: null };
  }

  const validData = result.data;

  const newAddres: addressType = {
    department: validData.department,
    nationality: validData.nationality.country,
    municipality: validData.municipality,
    address: validData.address,
  };

  let newPhone: string | null = null;
  if ("phone" in validData && validData.phone) {
    newPhone = validData.nationality.countryCode + validData.phone.toString();
  }

  try {
    const patient = await db
      .insert(Patients)
      .values({
        name: validData.name.toLocaleUpperCase(),
        address: newAddres,
        doctorId: doctorId,
        date: validData.date,
        dni: (validData as tPatientSchema).DNI,
        phone: newPhone,
        sex: validData.sex,
      })
      .returning({ id: Patients.id });

    await db.insert(Files).values({
      id: NewId(),
      patientId: patient[0].id,
    });

    return {
      success: true,
      action: validData.action,
      patientId: patient[0].id,
    };
  } catch (error) {
    return { success: false, error: error, action: null };
  }
}
