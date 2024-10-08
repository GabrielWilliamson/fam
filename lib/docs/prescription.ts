import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createPDFHeader, subTitle, title } from "../../lib/pdf";
import {
  Doctors,
  Drugs,
  Prescriptions,
  PrescriptionsDetails,
  Patients,
  Files,
  Queries,
  Users,
} from "../../db/schemas";
import { eq, and, exists } from "drizzle-orm";
import { db } from "../../db/db";

async function loadData(querieId: string) {
  const prescription = await db
    .select({
      id: Prescriptions.id,
      querieId: Prescriptions.querieId,
      doctorId: Queries.doctorId,
      doctorName: Users.name,
      patientName: Patients.name,
      createdAt: Prescriptions.createdAt,
    })
    .from(Prescriptions)
    .innerJoin(Queries, eq(Prescriptions.querieId, Queries.id))
    .innerJoin(Files, eq(Queries.idFile, Files.id))
    .innerJoin(Patients, eq(Files.patientId, Patients.id))
    .innerJoin(Doctors, eq(Queries.doctorId, Doctors.id))
    .innerJoin(Users, eq(Doctors.userId, Users.id))
    .where(eq(Prescriptions.querieId, querieId));

  const prescriptionDetails = await db
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

  return { prescription: prescription[0], prescriptionDetails };
}

export async function makePrescriptionDoc(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
  querieId: string,
) {
  const doc = new jsPDF();
  const { prescription, prescriptionDetails } = await loadData(querieId);

  createPDFHeader(doc, prescription.doctorName, "Prescripción");
  let yPosition = 50;

  // Patient Data Table
  autoTable(doc, {
    startY: yPosition,
    head: [["Datos del Paciente", ""]],
    body: [
      ["Paciente:", prescription.patientName],
      ["Fecha:", new Date(prescription.createdAt).toLocaleDateString()],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: "auto" } },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Prescription Details
  doc.setFontSize(14);
  doc.text("Detalles de la Prescripción", 14, yPosition);
  yPosition += 10;

  autoTable(doc, {
    startY: yPosition,
    head: [["Medicamento", "Nombre Genérico", "Presentación", "Indicaciones"]],
    body: prescriptionDetails.map((detail) => [
      detail.tradeName,
      detail.genericName,
      detail.presentation,
      detail.indications,
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: "auto" },
    },
  });

  // Footer
  const pageSize = doc.internal.pageSize;
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
    doc.text(`Página ${i} de ${totalPages}`, 190, pageHeight - 10, {
      align: "right",
    });
  }
  // Convert PDF to Buffer and send
  const pdfOutput = doc.output("arraybuffer");
  const pdfBuffer = Buffer.from(pdfOutput);
  dataCallback(pdfBuffer);
  endCallback();
}
