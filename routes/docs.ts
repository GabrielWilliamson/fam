import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db";
import { Doctors, Files, Patients, Relatives, Users } from "../db/schemas";
import doctorIdentification from "../lib/identification";
import { getResource } from "../lib/store";
import type { authVariables } from "../types/auth";
import { jsPDF } from "jspdf";

interface relatives {
  id: string;
  name: string;
  dni: string | null;
  phone: string | null;
  relation: string;
  civilStatus: string;
}

export function createTestPDF(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
) {
  const doc = new jsPDF();

  // Título del PDF
  doc.setFontSize(25);
  doc.text("Some title from jsPDF", 20, 30);

  // Espacio antes de la tabla
  doc.text(" ", 20, 40); // Espacio en blanco

  // Datos de ejemplo para la tabla
  const tableHeaders = ["Columna 1", "Columna 2", "Columna 3"];
  const tableRows = [
    ["Fila 1 Col 1", "Fila 1 Col 2", "Fila 1 Col 3"],
    ["Fila 2 Col 1", "Fila 2 Col 2", "Fila 2 Col 3"],
    ["Fila 3 Col 1", "Fila 3 Col 2", "Fila 3 Col 3"],
  ];

  // Dibujar la tabla
  const startY = 50;
  const rowHeight = 10;

  // Dibujar encabezados
  tableHeaders.forEach((header, index) => {
    doc.text(header, 20 + index * 50, startY);
  });

  // Dibujar filas
  tableRows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      doc.text(cell, 20 + cellIndex * 50, startY + (rowIndex + 1) * rowHeight);
    });
  });

  // Convertir el PDF a un Blob
  const pdfOutput = doc.output("arraybuffer"); // Obtener como ArrayBuffer

  // Convertir el ArrayBuffer a Buffer y enviar
  const pdfBuffer = Buffer.from(pdfOutput);
  dataCallback(pdfBuffer);
  endCallback();
}

export const docsRoute = new Hono<{ Variables: authVariables }>()
  //
  .get("/file", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, data: null }, 401);
    if (user.role != "DOCTOR")
      return c.json({ success: false, data: null }, 401);

    const doctorId = await doctorIdentification(user.id, user.role);
    if (doctorId === null) {
      return c.json({ success: false, data: null }, 500);
    }

    const patientId = c.req.query("patientId");
    if (!patientId) return c.json({ success: false, data: null }, 500);

    const dataName = await db
      .select({
        doctorName: Users.name,
      })
      .from(Patients)
      .innerJoin(Doctors, eq(Patients.doctorId, Doctors.id))
      .innerJoin(Users, eq(Users.id, Doctors.userId))
      .where(eq(Patients.id, patientId));

    if (dataName.length <= 0) {
      return c.json({ success: false, data: null }, 500);
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

    const my = await db
      .select({
        infecto: Files.infecto,
        hereditary: Files.hereditary,
        image: Patients.image,
        app: Files.app,
        apnp: Files.apnp,
      })
      .from(Files)
      .innerJoin(Patients, eq(Files.patientId, Patients.id))
      .where(eq(Files.patientId, patientId));

    const file = my[0];
    if (file.image) {
      const image = await getResource(file.image);
      file.image = image;
    }

    const name = dataName[0].doctorName;

    return c.json({ success: true, data: { file, relatives, name } });
  })

  .get("/pediatric", async (c) => {
    const readableStream = new ReadableStream({
      start(controller) {
        createTestPDF(
          (chunk) => controller.enqueue(chunk),
          () => controller.close(),
        );
      },
    });

    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", "attachment; filename=invoice.pdf");

    return c.body(readableStream);
  });
