import { eq, sql, and, isNotNull, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db";
import {
  Doctors,
  Files,
  Patients,
  Relatives,
  Users,
  Queries,
  Exams,
  Prescriptions,
  PrescriptionsDetails,
  Drugs,
  Flows,
} from "../db/schemas";
import { getResource } from "../lib/store";
import type { authVariables } from "../types/auth";
import doctorIdentification from "../lib/identification";
import type {
  InternalDoc,
  ExternalDoc,
  PediatricData,
  Relative,
  Resource,
  GeneralPatient,
  PediatricPatient,
  AddressType,
  GeneralData,
  QueryData,
  PrescriptionDetails,
  Prescription,
  PrescriptionList,
  PatientPrescriptionList,
  Incomes,
  Conciliations,
} from "../types/pdf";

type PaginatedResponse = {
  success: boolean;
  error: string;
  data: Conciliations[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

async function loadDoctorInternal(doctorId: string): Promise<InternalDoc> {
  const [doctor] = await db
    .select({
      doctorName: Users.name,
      doctorEspeciality: Doctors.specialityName,
      doctorCredential: Doctors.credential,
    })
    .from(Doctors)
    .innerJoin(Users, eq(Doctors.userId, Users.id))
    .where(eq(Doctors.id, doctorId));

  return doctor;
}
async function loadDoctorExternal(doctorId: string): Promise<ExternalDoc> {
  const [doctor] = await db
    .select({
      doctorName: Users.name,
      doctorEspeciality: Doctors.specialityName,
      doctorCredential: Doctors.credential,
      socials: Doctors.socials,
    })
    .from(Doctors)
    .innerJoin(Users, eq(Doctors.userId, Users.id))
    .where(eq(Doctors.id, doctorId));

  // Retornar el objeto que cumple con ExternalDoc
  return {
    doctorName: doctor.doctorName,
    doctorEspeciality: doctor.doctorEspeciality,
    doctorCredential: doctor.doctorCredential,
    socials: doctor.socials,
  };
}

export const pdfRoute = new Hono<{ Variables: authVariables }>()
  //internal header
  .get("/internal", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);
    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);
    const result = await loadDoctorInternal(doctorId);
    return c.json({ success: true, data: result });
  })
  //external header
  .get("/external", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);
    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);
    return c.json({ success: true, data: await loadDoctorExternal(doctorId) });
  })
  //pediatric file
  .get("/pediatric", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const [patient] = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        date: Patients.date,
        fileId: Files.id,
        address: Patients.address,
        sex: Patients.sex,
        infecto: Files.infecto,
        hereditary: Files.hereditary,
        image: Patients.image,
        app: Files.app,
        apnp: Files.apnp,
        doctorId: Patients.doctorId,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .where(eq(Patients.id, patientId))
      .limit(1);

    if (!patient) {
      return c.json({ success: false, data: null }, 404);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    if (patient.image) {
      const imageData = await getResource(patient.image);
    }

    if (patient.doctorId !== doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const relatives = await db
      .select({
        id: Relatives.id,
        name: Relatives.name,
        dni: Relatives.dni,
        phone: Relatives.phone,
        relation: Relatives.relation,
        civilStatus: Relatives.civilStatus,
      })
      .from(Relatives)
      .where(eq(Relatives.patientId, patientId));

    const capitalizeFirstLetter = (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const formattedRelatives = relatives.map((relative) => ({
      ...relative,
      relation: capitalizeFirstLetter(relative.relation),
      civilStatus: capitalizeFirstLetter(relative.civilStatus),
    }));

    // Antecedentes personales patológicos
    const appDataSt = JSON.stringify(patient?.app);
    const appData = JSON.parse(appDataSt ? appDataSt : "{}");

    // Antecedentes personales no patológicos
    const apnpDataSt = JSON.stringify(patient?.apnp);
    const apnpData = JSON.parse(apnpDataSt ? apnpDataSt : "{}") || {};

    const readyRelatives: Relative[] = formattedRelatives as Relative[];
    const readyPatientData: PediatricData = {
      infecto: patient.infecto || [],
      hereditary: patient.hereditary || [],
      prenatales: apnpData.prenatales || {},
      parto: apnpData.parto || {},
      postnatales: apnpData.postnatales || {},
      feeding: apnpData.feeding || {},
      psico: apnpData.psico || {},
      app: appData || {},
    };

    const origin: AddressType = JSON.parse(JSON.stringify(patient.address));

    const urlImage = patient.image ? await getResource(patient.image) : null;

    const readyPatient: PediatricPatient = {
      name: patient.name,
      sex: patient.sex,
      date: patient.date.toString(),
      fileId: patient.fileId,
      origin: origin,
      image: urlImage,
    };

    return c.json({
      success: true,
      data: {
        patient: readyPatient,
        relatives: readyRelatives,
        patientData: readyPatientData,
      },
    });
  })
  //general file
  .get("/general", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const [patient] = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        date: Patients.date,
        fileId: Files.id,
        address: Patients.address,
        phone: Patients.phone,
        dni: Patients.dni,
        sex: Patients.sex,
        infecto: Files.infecto,
        hereditary: Files.hereditary,
        image: Patients.image,
        app: Files.app,
        apnp: Files.apnp,
        doctorId: Patients.doctorId,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .where(eq(Patients.id, patientId))
      .limit(1);

    if (!patient) {
      return c.json({ success: false, data: null }, 404);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    if (patient.image) {
      const imageData = await getResource(patient.image);
    }

    if (patient.doctorId !== doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const relatives = await db
      .select({
        id: Relatives.id,
        name: Relatives.name,
        dni: Relatives.dni,
        phone: Relatives.phone,
        relation: Relatives.relation,
        civilStatus: Relatives.civilStatus,
      })
      .from(Relatives)
      .where(eq(Relatives.patientId, patientId));

    const capitalizeFirstLetter = (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const formattedRelatives = relatives.map((relative) => ({
      ...relative,
      relation: capitalizeFirstLetter(relative.relation),
      civilStatus: capitalizeFirstLetter(relative.civilStatus),
    }));

    // Antecedentes personales patológicos
    const appDataSt = JSON.stringify(patient?.app);
    const appData = JSON.parse(appDataSt ? appDataSt : "{}");

    // Antecedentes personales no patológicos
    const apnpDataSt = JSON.stringify(patient?.apnp);
    const apnpData = JSON.parse(apnpDataSt ? apnpDataSt : "{}") || {};

    const readyRelatives: Relative[] = formattedRelatives as Relative[];

    //FALTA
    const readyPatientData: GeneralData = {
      infecto: patient.infecto || [],
      hereditary: patient.hereditary || [],
      app: appData || {},
      Tabaco: apnpData.Tabaco || {},
      Alcohol: apnpData.Alcohol || {},
      Drogas: apnpData.Drogas || {},
    };

    const origin: AddressType = JSON.parse(JSON.stringify(patient.address));
    const urlImage = patient.image ? await getResource(patient.image) : null;

    const readyPatient: GeneralPatient = {
      name: patient.name,
      sex: patient.sex,
      date: patient.date.toString(),
      dni: patient.dni,
      phone: patient.phone,
      fileId: patient.fileId,
      origin: origin,
      image: urlImage,
    };

    return c.json({
      success: true,
      data: {
        patient: readyPatient,
        relatives: readyRelatives,
        patientData: readyPatientData,
      },
    });
  })
  //query
  .get("/query", async (c) => {
    const user = c.get("user");

    if (!user || user.role !== "DOCTOR") {
      return c.json(
        { success: false, data: null, message: "Unauthorized" },
        401,
      );
    }

    const queryId = c.req.query("queryId");

    if (!queryId) {
      return c.json(
        { success: false, data: null, message: "Missing queryId" },
        400,
      );
    }

    try {
      const prescription = await db
        .select({
          id: Prescriptions.id,
        })
        .from(Prescriptions)
        .innerJoin(Queries, eq(Prescriptions.querieId, Queries.id))
        .where(eq(Prescriptions.querieId, queryId));

      const prescriptionDetails: PrescriptionDetails[] =
        prescription.length > 0
          ? await db
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
              .where(
                eq(PrescriptionsDetails.prescriptionId, prescription[0].id),
              )
          : [];

      const queryData = await db
        .select({
          interrogation: Queries.interrogation,
          resources: Queries.resources,
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
          head: Exams.hea,
          torax: Exams.tor,
          neuro: Exams.neuro,
          id: Queries.id,
          idFile: Queries.idFile,
          vitals: Exams.vitals,
          antropometrics: Exams.antropometrics,
          emergency: Queries.emergency,
          name: Patients.name,
          date: Patients.date,
          fileId: Files.id,
          address: Patients.address,
          sex: Patients.sex,
          image: Patients.image,
          phone: Patients.phone,
          dni: Patients.dni,
          createdAt:
            sql`to_char(${Queries.createdAt}, 'DD-MM-YYYY HH12:MI:SS AM')`.as(
              "createdAt",
            ),
        })
        .from(Queries)
        .innerJoin(Files, eq(Files.id, Queries.idFile))
        .innerJoin(Patients, eq(Patients.id, Files.patientId))
        .innerJoin(Exams, eq(Exams.querieId, Queries.id))
        .where(eq(Queries.id, queryId))
        .limit(1);

      if (!queryData.length) {
        return c.json(
          { success: false, data: null, message: "Query not found" },
          404,
        );
      }

      const data = queryData[0];
      const urlImage = data.image ? await getResource(data.image) : null;

      const readyPatient: GeneralPatient = {
        name: data.name,
        sex: data.sex,
        date: data.date.toISOString(),
        fileId: data.fileId,
        origin: JSON.parse(JSON.stringify(data.address)),
        image: urlImage,
        dni: data.dni,
        phone: data.phone,
      };

      const resourcesArray: Resource[] = (data.resources as Resource[]) || [];
      let resources: Resource[] = [];

      for (const resource of resourcesArray) {
        const fileId = resource.id.split(".").shift() || "";
        resources.push({
          id: await getResource(fileId),
          name: resource.name,
        });
      }

      const readyQuery: QueryData = {
        interrogation: data.interrogation,
        resources: resources,
        reason: data.reason,
        history: data.history,
        observations: data.observations,
        diag: data.diag,
        aspects: data.aspects,
        skin: data.skin,
        abd: data.abd,
        exInf: data.exInf,
        exSup: data.exSup,
        anus: data.anus,
        genitu: data.genitu,
        head: data.head || {},
        torax: data.torax || {},
        neuro: data.neuro,
        id: data.id,
        idFile: data.idFile,
        vitals: data.vitals || {},
        antropometrics: data.antropometrics || {},
        emergency: data.emergency,
        createdAt: data.createdAt,
      };

      return c.json({
        success: true,
        data: {
          patient: readyPatient,
          query: readyQuery,
          details: prescriptionDetails,
        },
      });
    } catch (error) {
      return c.json(
        { success: false, data: null, message: "Internal Server Error" },
        500,
      );
    }
  })
  //prescrition
  .get("/prescription", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const querieId = c.req.query("querieId");
    if (!querieId) return c.json({ success: false, data: null }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    const prescription = await db
      .select({
        id: Prescriptions.id,
        patientName: Patients.name,
        createdAt: Prescriptions.createdAt,
      })
      .from(Prescriptions)
      .innerJoin(Queries, eq(Prescriptions.querieId, Queries.id))
      .innerJoin(Files, eq(Queries.idFile, Files.id))
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(
        and(
          eq(Prescriptions.querieId, querieId),
          eq(Queries.doctorId, doctorId),
        ),
      );

    if (!prescription) {
      return c.json({ success: false, data: null }, 404);
    }

    const prescriptionDetails: PrescriptionDetails[] =
      prescription.length > 0
        ? await db
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
            .where(eq(PrescriptionsDetails.prescriptionId, prescription[0].id))
        : [];

    return c.json({
      success: true,
      data: {
        prescription: prescription[0] as Prescription,
        details: prescriptionDetails,
      },
    });
  })
  //prescriptions
  .get("/prescriptions", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    const [patientInfo] = await db
      .select({
        name: Patients.name,
        fileId: Files.id,
      })
      .from(Patients)
      .innerJoin(Files, eq(Files.patientId, Patients.id))
      .where(and(eq(Patients.id, patientId), eq(Patients.doctorId, doctorId)));

    if (!patientInfo) return c.json({ success: false, data: null }, 404);

    const data = await db
      .select({
        createdAt: Queries.createdAt,
        tradeName: Drugs.tradeName,
        genericName: Drugs.genericName,
        presentation: PrescriptionsDetails.presentations,
        indications: PrescriptionsDetails.indications,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Prescriptions, eq(Queries.id, Prescriptions.querieId))
      .innerJoin(
        PrescriptionsDetails,
        eq(Prescriptions.id, PrescriptionsDetails.prescriptionId),
      )
      .innerJoin(Drugs, eq(PrescriptionsDetails.drugId, Drugs.id))
      .where(eq(Files.patientId, patientId))
      .orderBy(Queries.createdAt);

    // Group prescriptions by date
    const groupedData: PrescriptionList = data.reduce(
      (acc, curr) => {
        const date = new Date(curr.createdAt).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(curr);
        return acc;
      },
      {} as Record<string, typeof data>,
    );

    return c.json({
      success: true,
      data: {
        prescriptions: groupedData,
        patient: patientInfo as PatientPrescriptionList,
      },
    });
  })
  // incomes
  .get("/incomes", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR")
      return c.json({ success: false, data: null, error: "unautorized" }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId)
      return c.json({ success: false, data: null, error: "unautorized" }, 401);

    const fromDat = c.req.query("from");
    const toDat = c.req.query("to");

    if (!fromDat || !toDat) {
      return c.json({ success: false, data: null, error: "error" }, 400);
    }

    const fromDate = new Date(fromDat);
    const toDate = new Date(toDat);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 0);

    const data = await db
      .select({
        date: sql<string>`to_char(${Flows.createdAt}, 'DD-MM-YYYY')`,
        patient: Patients.name,
        price: Queries.price,
        method: Flows.bankAccountId,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .innerJoin(Flows, eq(Queries.flowId, Flows.id))
      .where(
        and(
          eq(Queries.doctorId, doctorId),
          eq(Queries.status, "end"),
          isNotNull(Queries.flowId),
          gte(sql`DATE(${Flows.createdAt})`, sql`DATE(${fromDate})`),
          lte(Flows.createdAt, sql`${toDate}::timestamp + interval '1 day'`),
        ),
      );

    return c.json({ success: true, data: data as Incomes[], error: "" }, 200);
  })
  .get("/conciliations", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") {
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) {
      return c.json({ success: false, data: null, error: "unauthorized" }, 401);
    }

    const m = c.req.query("month");
    const y = c.req.query("year");

    if (!m || !y) {
      return c.json({ success: false, data: null, error: "error" }, 400);
    }

    const month = parseInt(m, 10);
    const year = parseInt(y, 10);

    // Validar mes y año
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 2000) {
      return c.json({ success: false, data: null, error: "error" }, 400);
    }

    // Calcular las fechas de inicio y fin del mes
    const fromDate = new Date(year, month - 1, 1); // Primer día del mes
    const toDate = new Date(year, month, 0, 23, 59, 59); // Último día del mes

    const page = parseInt(c.req.query("page") || "1");
    const pageSize = parseInt(c.req.query("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    const [list, total] = await Promise.all([
      db
        .select({
          userName: Users.name,
          date: sql<string>`to_char(${Flows.createdAt}, 'DD-MM-YYYY')`,
          total: Flows.total,
          cordobas: Flows.cordobas,
          dollars: Flows.dollars,
        })
        .from(Flows)
        .innerJoin(Users, eq(Flows.chargeTo, Users.id))
        .where(
          and(
            eq(Flows.doctorId, doctorId),
            eq(Flows.flow, "conciliation"),
            gte(sql`DATE(${Flows.createdAt})`, sql`DATE(${fromDate})`),
            lte(Flows.createdAt, sql`${toDate}::timestamp`),
          ),
        )
        .offset(offset)
        .limit(pageSize),
      db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(Flows)
        .where(
          and(
            eq(Flows.doctorId, doctorId),
            eq(Flows.flow, "conciliation"),
            gte(sql`DATE(${Flows.createdAt})`, sql`DATE(${fromDate})`),
            lte(Flows.createdAt, sql`${toDate}::timestamp`),
          ),
        ),
    ]);

    const totalCount = total[0].count;

    const response: PaginatedResponse = {
      success: true,
      error: "",
      data: list as Conciliations[],
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
    return c.json(
      { success: true, data: response as PaginatedResponse, error: "" },
      200,
    );
  });
