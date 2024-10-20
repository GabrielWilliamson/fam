import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import {
  generalSchema,
  pediatricSchema,
  type tPediatricSchema,
  type tgeneralSchema,
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
import doctorIdentification from "../lib/identification";
import { departmentsFull } from "../lib/locations";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

type ApiResponse<T = {}> = {
  success: boolean;
  error?: any;
  action: "now" | "date" | null;
  patientId?: string;
} & T;

type PaginatedResponse = {
  success: boolean;
  error: string;
  data: tablePatients[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

const address = z.object({ address: pediatricSchema.shape.address });
const phone = z.object({
  phone: z
    .string({ required_error: "Este campo es requerido" })
    .min(8, "Complete este campo"),
});
export const patientsRoute = new Hono<{ Variables: authVariables }>()

  .get("/all", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: [] }, 401);
    if (user.role === "ADMIN") return c.json({ success: false, data: [] }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);

    if (!doctorId) return c.json({ success: false, data: [] }, 401);

    const page = parseInt(c.req.query("page") || "1");
    const pageSize = parseInt(c.req.query("pageSize") || "10");

    const offset = (page - 1) * pageSize;

    const [data, totalCountResult] = await Promise.all([
      db
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
        .where(eq(Patients.doctorId, doctorId))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(Patients)
        .where(eq(Patients.doctorId, doctorId)),
    ]);
    const totalCount = totalCountResult[0].count;

    const formattedPatients = data.map((patient) => ({
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

    const response: PaginatedResponse = {
      success: true,
      error: "",
      data: formattedPatients,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };

    return c.json({
      success: true,
      data: response,
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
            sql`to_tsvector('simple', lower(${Patients.name})) @@ to_tsquery('simple', ${tsQuery})`,
          ),
        ),
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
        401,
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
        401,
      );
    }

    const body = await c.req.json();
    body.date = new Date(body.date);

    const result = pediatricSchema.safeParse(body);
    if (!result.success) {
      return c.json({
        success: false,
        error: result.error.message,
        action: null,
        patientId: "",
      });
    }

    const validData = result.data;

    let muny = "";
    if (validData.nationality.countryCode === 505) {
      const department = departmentsFull.find(
        (dep) => dep.name === validData.department,
      );

      const municipality = department?.municipalities.find(
        (municipality) => municipality.code === validData.municipality,
      );
      muny = municipality?.name!;
    } else {
      muny = validData.municipality;
    }

    const newAddres: addressType = {
      department: validData.department,
      nationality: validData.nationality.country,
      municipality: muny,
      address: validData.address,
    };

    try {
      const patient = await db
        .insert(Patients)
        .values({
          name: validData.name.toLocaleUpperCase(),
          address: newAddres,
          doctorId: doctorId,
          date: validData.date,
          sex: validData.sex,
        })
        .returning({ id: Patients.id });

      await db.insert(Files).values({
        id: NewId(),
        patientId: patient[0].id,
      });

      return c.json({
        success: true,
        action: validData.action,
        patientId: patient[0].id,
        error: "",
      });
    } catch (e) {
      console.log(e);
      return c.json({
        success: false,
        error: "Error al guardar el paciente",
        action: null,
        patientId: "",
      });
    }
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
        401,
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
        401,
      );
    }

    const body = await c.req.json();
    body.date = new Date(body.date);

    if (body.dateDni) {
      body.dateDni = new Date(body.dateDni);
    }

    const result = generalSchema.safeParse(body);
    if (!result.success) {
      return c.json({
        success: false,
        error: result.error.message,
        action: null,
        patientId: "",
      });
    }

    const validData = result.data;
    const cedula = validData.Dni ?? validData.foreign;

    if (!cedula) {
      return c.json({
        success: false,
        error: "Dato erroneo",
        action: null,
        patientId: "",
      });
    }

    const dnis = await db
      .select({
        dni: Patients.dni,
      })
      .from(Patients)
      .where(eq(Patients.dni, cedula));

    if (dnis.length > 0) {
      return c.json({
        success: false,
        error: "Esta cédula ya existe",
        action: null,
        patientId: "",
      });
    }

    if (validData.phone !== null) {
      const phones = await db
        .select({
          phones: Patients.phone,
        })
        .from(Patients)
        .where(eq(Patients.phone, (validData as tgeneralSchema).phone!));

      if (phones.length > 0) {
        return c.json({
          success: false,
          error: "Este teléfono ya existe",
          action: null,
          patientId: "",
        });
      }
    }

    let muny = "";
    if (validData.nationality.countryCode === 505) {
      const department = departmentsFull.find(
        (dep) => dep.name === validData.department,
      );

      const municipality = department?.municipalities.find(
        (municipality) => municipality.code === validData.municipality,
      );
      muny = municipality?.name!;
    } else {
      muny = validData.municipality;
    }

    const newAddres: addressType = {
      department: validData.department,
      nationality: validData.nationality.country,
      municipality: muny,
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
          name: validData.name.toUpperCase(),
          address: newAddres,
          doctorId: doctorId,
          date: validData.date,
          dni: cedula,
          phone: newPhone,
          sex: validData.sex,
        })
        .returning({ id: Patients.id });

      await db.insert(Files).values({
        id: NewId(),
        patientId: patient[0].id,
      });

      return c.json({
        success: true,
        action: validData.action,
        patientId: patient[0].id,
        error: "",
      });
    } catch (e) {
      console.log(e);
      return c.json({
        success: false,
        error: "Error al guardar el paciente",
        action: null,
        patientId: "",
      });
    }
  })

  // SEARCH FOR FILE ID
  .get("/file", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role === "ADMIN")
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
        500,
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
        500,
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
        500,
      );

    return c.json({ success: true, data: patient[0] as searchPatient });
  })

  .patch("/address/:id", zValidator("json", address), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "unauthorized" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "unauthorized" }, 401);

    const id = c.req.param("id");

    if (!id) return c.json({ success: false, error: "id requerido" }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, error: "unauthorized" }, 401);

    const data = c.req.valid("json");

    const [patient] = await db
      .select({
        address: Patients.address,
      })
      .from(Patients)
      .where(and(eq(Patients.doctorId, doctorId), eq(Patients.id, id)));

    if (!patient) return c.json({ success: false, error: "no found" }, 500);

    const res = JSON.stringify(patient.address);
    const oldAddress: addressType = JSON.parse(res);

    const updatedAddress: addressType = {
      nationality: oldAddress.nationality,
      department: oldAddress.department,
      municipality: oldAddress.municipality,
      address: data.address,
    };

    await db
      .update(Patients)
      .set({ address: updatedAddress })
      .where(eq(Patients.id, id));
    return c.json({ success: true, error: "" });
  })
  .patch("/phone/:id", zValidator("json", phone), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "unauthorized" }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, error: "unauthorized" }, 401);

    const id = c.req.param("id");

    if (!id) return c.json({ success: false, error: "id requerido" }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, error: "unauthorized" }, 401);

    const data = c.req.valid("json");

    const [patient] = await db
      .select({
        phone: Patients.phone,
      })
      .from(Patients)
      .where(and(eq(Patients.doctorId, doctorId), eq(Patients.id, id)));

    if (!patient) return c.json({ success: false, error: "no found" }, 500);

    await db
      .update(Patients)
      .set({ phone: data.phone })
      .where(eq(Patients.id, id));
    return c.json({ success: true, error: "" });
  });
