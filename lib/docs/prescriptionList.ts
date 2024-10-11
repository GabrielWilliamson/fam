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

async function loadData(patientId: string) {
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
  const groupedData = data.reduce(
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

  const [patientInfo] = await db
    .select({
      name: Patients.name,
      fileId: Files.id,
    })
    .from(Patients)
    .innerJoin(Files, eq(Files.patientId, Patients.id))
    .where(eq(Patients.id, patientId));

  return {
    groupedData,
    fileId: patientInfo.fileId,
    name: patientInfo.name,
  };
}

export async function makePrescriptionListDoc(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
  patientId: string,
) {
  const doc = new jsPDF();
  const { groupedData, name, fileId } = await loadData(patientId);

  createPDFHeader(doc, "test", "Historial de Prescripciones");
  let yPosition = 50;

  // Patient Data Table
  autoTable(doc, {
    startY: yPosition,
    head: [["Datos del Paciente", ""]],
    body: [
      ["Paciente:", name],
      ["Expediente:", fileId],
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

  // Prescription Details for each date
  for (const [date, prescriptions] of Object.entries(groupedData)) {
    doc.setFontSize(14);
    doc.text(`Fecha: ${date}`, 14, yPosition);
    yPosition += 10;

    autoTable(doc, {
      startY: yPosition,
      head: [
        ["Medicamento", "Nombre Genérico", "Presentación", "Indicaciones"],
      ],
      body: prescriptions.map((prescription) => [
        prescription.tradeName,
        prescription.genericName,
        prescription.presentation,
        prescription.indications,
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

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

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
