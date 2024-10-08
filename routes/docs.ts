import { eq, sql, and } from "drizzle-orm";
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
} from "../db/schemas";
import { getResource } from "../lib/store";
import type { authVariables } from "../types/auth";
import { makePediatricFileDoc } from "../lib/docs/pediatric";
import doctorIdentification from "../lib/identification";
import { makeQuerieDoc } from "../lib/docs/querie";
import { makePrescriptionDoc } from "../lib/docs/prescription";
import { makePatientListDoc } from "../lib/docs/patients";

export const docsRoute = new Hono<{ Variables: authVariables }>()

  //patients list
  .get("/list", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    const readableStream = new ReadableStream({
      start(controller) {
        makePatientListDoc(
          (chunk) => controller.enqueue(chunk),
          () => controller.close(),
          doctorId,
        );
      },
    });

    // Configurar las cabeceras para enviar un archivo PDF
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", "attachment; filename=patient_report.pdf");

    // Enviar el stream del archivo PDF
    return c.body(readableStream);
  })
  //pediatric file
  .get("/pediatric", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const patient = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        dni: Patients.dni,
        date: Patients.date,
        fileId: Files.id,
        origin: Patients.address,
        sex: Patients.sex,
        phone: Patients.phone,
        doctorName: Users.name,
        infecto: Files.infecto,
        hereditary: Files.hereditary,
        image: Patients.image,
        doctorId: Patients.doctorId,
        app: Files.app,
        apnp: Files.apnp,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .innerJoin(Doctors, eq(Patients.doctorId, Doctors.id))
      .innerJoin(Users, eq(Doctors.userId, Users.id))
      .where(eq(Patients.id, patientId))
      .limit(1);

    if (!patient || patient.length === 0) {
      return c.json({ success: false, data: null }, 404);
    }

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    if (patient[0].image) {
      const imageData = await getResource(patient[0].image);
      if (imageData) {
        const response = await fetch(imageData);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convertir el Uint8Array en una cadena base64 en trozos
          let binaryString = "";
          const chunkSize = 8192; // Tamaño del chunk
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
          }
          const base64 = btoa(binaryString);
          const contentType =
            response.headers.get("Content-Type") || "image/jpeg"; // Proveer un valor por defecto si es necesario
          const base64Image = `data:${contentType};base64,${base64}`;

          patient[0].image = base64Image;
        } else {
          console.error("Error al obtener la imagen:", response.status);
        }
      } else {
        console.log("No se encontró una imagen para el paciente");
        patient[0].image = null;
      }
    }

    if (patient[0].doctorId !== doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    // Obtener los familiares del paciente desde la base de datos
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
      if (!str) return ""; // Devuelve una cadena vacía si el valor es nulo o indefinido
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const formattedRelatives = relatives.map((relative) => ({
      ...relative,
      relation: capitalizeFirstLetter(relative.relation),
      civilStatus: capitalizeFirstLetter(relative.civilStatus),
    }));

    // Antecedentes personales patológicos
    const appDataSt = JSON.stringify(patient[0].app);
    const appData = JSON.parse(appDataSt ? appDataSt : "{}");

    // Antecedentes personales no patológicos
    const apnpDataSt = JSON.stringify(patient[0]?.apnp);
    const apnpData = JSON.parse(apnpDataSt ? apnpDataSt : "{}") || {};

    // Crear un ReadableStream para enviar el archivo PDF
    const readableStream = new ReadableStream({
      start(controller) {
        makePediatricFileDoc(
          (chunk) => controller.enqueue(chunk),
          () => controller.close(),
          formattedRelatives,
          patient[0],
          patient[0].doctorName,
          {
            infecto: patient[0].infecto || [],
            hereditary: patient[0].hereditary || [],
            prenatales: apnpData.prenatales || {},
            parto: apnpData.parto || {},
            postnatales: apnpData.postnatales || {},
            feeding: apnpData.feeding || {},
            psico: apnpData.psico || {},
            app: appData || {},
          },
        );
      },
    });

    // Configurar las cabeceras para enviar un archivo PDF
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", "attachment; filename=patient_report.pdf");

    // Enviar el stream del archivo PDF
    return c.body(readableStream);
  })
  //one query
  .get("/querie", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const querieId = c.req.query("querieId");
    if (!querieId) return c.json({ success: false, data: null }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    const [QuerieData] = await db
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
        dateId: Queries.dateId,
        idFile: Queries.idFile,
        vitals: Exams.vitals,
        antropometrics: Exams.antropometrics,
        emergency: Queries.emergency,
        name: Patients.name,
        createdAt:
          sql`to_char(${Queries.createdAt}, 'YYYY-MM-DD HH12:MI:SS AM')`.as(
            "createdAt",
          ),
        patientId: Patients.id,
      })
      .from(Queries)
      .innerJoin(Files, eq(Files.id, Queries.idFile))
      .innerJoin(Patients, eq(Patients.id, Files.patientId))
      .innerJoin(Exams, eq(Exams.querieId, Queries.id))
      .where(and(eq(Queries.id, querieId), eq(Queries.doctorId, doctorId)));

    const [Patient] = await db
      .select({
        id: Patients.id,
        name: Patients.name,
        dni: Patients.dni,
        date: Patients.date,
        fileId: Files.id,
        origin: Patients.address,
        sex: Patients.sex,
        phone: Patients.phone,
        doctorName: Users.name,
        image: Patients.image,
        doctorId: Patients.doctorId,
        credential: Doctors.credential,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .innerJoin(Doctors, eq(Patients.doctorId, Doctors.id))
      .innerJoin(Users, eq(Doctors.userId, Users.id))
      .where(eq(Patients.id, QuerieData.patientId));

    if (Patient.image) {
      const imageData = await getResource(Patient.image);
      if (imageData) {
        const response = await fetch(imageData);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convertir el Uint8Array en una cadena base64 en trozos
          let binaryString = "";
          const chunkSize = 8192; // Tamaño del chunk
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, chunk);
          }
          const base64 = btoa(binaryString);
          const contentType =
            response.headers.get("Content-Type") || "image/jpeg"; // Proveer un valor por defecto si es necesario
          const base64Image = `data:${contentType};base64,${base64}`;

          Patient.image = base64Image;
        } else {
          console.error("Error al obtener la imagen:", response.status);
        }
      } else {
        console.log("No se encontró una imagen para el paciente");
        Patient.image = null;
      }
    }

    const readableStream = new ReadableStream({
      start(controller) {
        makeQuerieDoc(
          (chunk) => controller.enqueue(chunk),
          () => controller.close(),
          QuerieData,
          Patient,
        );
      },
    });

    // Configurar las cabeceras para enviar un archivo PDF
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", "attachment; filename=patient_report.pdf");

    // Enviar el stream del archivo PDF
    return c.body(readableStream);
  })
  //one prescription
  .get("/prescription", async (c) => {
    const user = c.get("user");
    if (!user || user.role !== "DOCTOR") return c.json({ success: false }, 401);

    const querieId = c.req.query("querieId");
    if (!querieId) return c.json({ success: false, data: null }, 500);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return c.json({ success: false, data: null }, 401);

    const [querie] = await db
      .select({ doctorId: Queries.doctorId })
      .from(Queries)
      .where(eq(Queries.id, querieId));

    if (!querie) return c.json({ success: false, data: null }, 404);

    if (querie.doctorId !== doctorId) {
      return c.json({ success: false, data: null }, 401);
    }

    const [Prescription] = await db
      .select()
      .from(Prescriptions)
      .where(eq(Prescriptions.querieId, querieId));

    if (!Prescription) return c.json({ success: false, data: null }, 404);

    const readableStream = new ReadableStream({
      start(controller) {
        makePrescriptionDoc(
          (chunk) => controller.enqueue(chunk),
          () => controller.close(),
          querieId,
        );
      },
    });

    // Configurar las cabeceras para enviar un archivo PDF
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", "attachment; filename=patient_report.pdf");

    // Enviar el stream del archivo PDF
    return c.body(readableStream);
  });
