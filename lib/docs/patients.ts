import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createPDFHeader, subTitle, title } from "../../lib/pdf";
import {
  calculateFullAge,
  transformAddress,
  transformOrigin,
} from "../../lib/patients";
import { Doctors, Patients, Files, Users, Specialties } from "../../db/schemas";
import { eq } from "drizzle-orm";
import { db } from "../../db/db";

async function loadData(doctorId: string) {
  const info = await db
    .select({
      specialty: Doctors.specialtie,
      name: Users.name,
    })
    .from(Doctors)
    .innerJoin(Users, eq(Doctors.userId, Users.id))
    .where(eq(Doctors.id, doctorId));

  const isGeneral = info[0].specialty === "GENERAL";

  const data = await db
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

  const formattedPatients = data.map((patient) => ({
    id: patient.id,
    name: patient.name,
    dni: patient.dni,
    date: patient.date,
    fileId: patient.fileId,
    address: transformAddress(patient.origin),
    origin: transformOrigin(patient.origin),
    sex: patient.sex,
    phone: patient.phone,
    createdAt: patient.createdAt,
    age: calculateFullAge(patient.date),
  }));

  // Sort patients by date of birth (ascending order)
  formattedPatients.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { data: formattedPatients, isGeneral, name: info[0].name };
}

export async function makePatientListDoc(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
  doctorId: string,
) {
  const doc = new jsPDF({
    orientation: "landscape",
  });
  const { data: patients, isGeneral, name } = await loadData(doctorId);

  createPDFHeader(doc, name, "Listado de mis Pacientes");
  let yPosition = 50;

  // Define table headers based on specialty
  const headers = [
    "#",
    "Nombre",
    "Fecha de Nacimiento",
    "Edad",
    "Sexo",
    "Dirección",
    "Origen",
    "N° Expediente",
  ];

  if (isGeneral) {
    headers.splice(2, 0, "DNI");
    headers.splice(6, 0, "Teléfono");
  }

  // Patient List Table
  autoTable(doc, {
    startY: yPosition,
    head: [headers],
    body: patients.map((patient, index) => {
      const row = [
        index + 1,
        patient.name,
        patient.date.toLocaleDateString(),
        patient.age,
        patient.sex,
        patient.address,
        patient.origin,
        patient.fileId,
      ];

      if (isGeneral) {
        row.splice(2, 0, patient.dni ?? "");
        row.splice(6, 0, patient.phone ?? "");
      }

      return row;
    }),
    theme: "grid",
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: { fontSize: 12, cellPadding: 1 },
  });

  // Footer
  const pageSize = doc.internal.pageSize;
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
    const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, pageHeight - 10, {
      align: "right",
    });
  }

  // Convert PDF to Buffer and send
  const pdfOutput = doc.output("arraybuffer");
  const pdfBuffer = Buffer.from(pdfOutput);
  dataCallback(pdfBuffer);
  endCallback();
}
