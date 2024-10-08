import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createPDFHeader, subTitle, title } from "../../lib/pdf";
import { getResource } from "../store";
import type { vitals, antropometrics } from "../../schemas/vitalSchema";
import { calculateFullAge } from "../../lib/patients";
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

  return { prescriptionDetails };
}
type Head = {
  craneo: string | null;
  ojos: string | null;
  orejas: string | null;
  nariz: string | null;
  boca: string | null;
  cuello: string | null;
};

type Torax = {
  pulmonares: string | null;
  mamas: string | null;
  caja: string | null;
  cardiaco: string | null;
};

type QueryData = {
  interrogation: string | null;
  resources: unknown[] | null;
  reason: string | null;
  history: string | null;
  observations: string | null;
  diag: string | null;
  aspects: string | null;
  skin: string | null;
  abd: string | null;
  exInf: string | null;
  exSup: string | null;
  anus: string | null;
  genitu: string | null;
  neuro: string | null;
  id: string;
  dateId: string | null;
  idFile: string;
  vitals: Record<string, any>;
  antropometrics: Record<string, any>;
  emergency: boolean | null;
  name: string;
  createdAt: unknown;
  patientId: string;
  head: Record<string, any>;
  torax: Record<string, any>;
};

type Resource = {
  id: string;
  name: string;
};

type Patient = {
  name: string;
  sex: string;
  date: string;
  origin: {
    nationality: string;
    department: string;
    municipality: string;
    address: string;
  };
  image: string | null;
};

const vitalSignsMap: Record<string, string> = {
  FC: "Frecuencia cardíaca",
  SA: "Silverman Andersen",
  FR: "Frecuencia respiratoria",
  T: "Temperatura",
  PA: "Presión arterial",
};

const anthropometricDataMap: Record<string, string> = {
  IMC: "Indice de masa  (IMC)",
  w: "Altura",
  TL: "Talla",
  PC: "Perímetro cefálico",
  PRA: "Perímetro abdominal",
  ASC: "Área superficial corporal (ASC)",
  PT: "Perímetro torácico",
};

function addPatientInfo(doc: jsPDF, patient: any, yPosition: number): number {
  const birthDate = new Date(patient.date);

  const availableWidth = 190 - 10 - 60;

  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    styles: {
      fontSize: 12,
      font: "helvetica",
      textColor: "#000000",
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: "auto" },
    },
    body: [
      ["Paciente:", patient.name],
      ["Sexo:", patient.sex],
      ["Edad:", `${calculateFullAge(patient.date)}`],
      ["Fecha de Nacimiento:", birthDate.toLocaleDateString()],
      ["Nacionalidad:", patient.origin.nationality],
      [
        "Origen:",
        patient.origin.department + ", " + patient.origin.municipality,
      ],
      ["Dirección:", patient.origin.address],
    ],
    tableWidth: availableWidth,
    didParseCell: function (data) {
      if (data.column.index > 0) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  if (patient.image != null) {
    const imgProps = doc.getImageProperties(patient.image);
    const maxWidth = 50;
    const maxHeight = 40;

    const widthScale = maxWidth / imgProps.width;
    const heightScale = maxHeight / imgProps.height;
    const scale = Math.min(widthScale, heightScale);

    const imgWidth = imgProps.width * scale;
    const imgHeight = imgProps.height * scale;

    doc.addImage(patient.image, "JPEG", 140, yPosition, imgWidth, imgHeight);
  }

  return (doc as any).lastAutoTable.finalY + 10;
}

function addData(doc: jsPDF, q: QueryData, yPosition: number): number {
  autoTable(doc, {
    startY: yPosition,
    columnStyles: {
      0: { minCellWidth: doc.internal.pageSize.getWidth() / 2 - 20 },
      1: { minCellWidth: doc.internal.pageSize.getWidth() / 2 - 20 },
    },
    styles: { fontSize: 12 },
    head: [["Motivo de la consulta:", "Historia de la Enfermedad Actual:"]],
    body: [[q.reason, q.history]],
  });

  yPosition = (doc as any).lastAutoTable.finalY + 5;

  autoTable(doc, {
    startY: yPosition,
    styles: { fontSize: 12 },
    head: [["Interrogatorio por aparatos y sistemas:"]],
    body: [[q.interrogation]],
  });

  yPosition = (doc as any).lastAutoTable.finalY + 5;

  const vitals = q.vitals as vitals;

  yPosition += 10;

  // Generar el contenido de la tabla con todos los signos vitales
  const vitalSigns: [string, string][] = [
    [
      vitalSignsMap["PA"] || "Presión Arterial", // Asegura que siempre hay un label
      vitals?.PA ? `${vitals.PA?.a ?? ""}/${vitals.PA?.b ?? ""}` : "",
    ],
    [
      vitalSignsMap["FC"] || "Frecuencia Cardíaca",
      vitals?.FC != null ? `${vitals.FC}` : "", // Usa != null para cubrir ambos null y undefined
    ],
    [
      vitalSignsMap["FR"] || "Frecuencia Respiratoria",
      vitals?.FR != null ? `${vitals.FR}` : "",
    ],
    [
      vitalSignsMap["T"] || "Temperatura",
      vitals?.T != null ? `${vitals.T} °C` : "",
    ],
    [
      vitalSignsMap["SA"] || "Silverman Andersen",
      vitals?.SA != null ? `${vitals.SA} cm` : "",
    ],
  ];

  // Crear la tabla de signos vitales
  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    head: [["Signos vitales:", "Valores"]],
    styles: { fontSize: 12 },
    body: vitalSigns,
  });

  yPosition = (doc as any).lastAutoTable.finalY + 5;

  const antro = q.antropometrics as antropometrics;
  const anthropometricData: [string, string][] = [
    [
      anthropometricDataMap["w"],
      antro?.W !== undefined && antro?.W !== null ? `${antro.W} kg}` : "",
    ],
    [
      anthropometricDataMap["TL"],
      antro?.TL !== undefined && antro?.TL !== null ? `${antro.TL} cm` : "",
    ],
    [
      anthropometricDataMap["PC"],
      antro?.PC !== undefined && antro?.PC !== null ? `${antro.PC} cm` : "",
    ],
    [
      anthropometricDataMap["PT"],
      antro?.PT !== undefined && antro?.PT !== null ? `${antro.PT} cm` : "",
    ],
    [
      anthropometricDataMap["PRA"],
      antro?.PRA !== undefined && antro?.PRA !== null ? `${antro.PRA} cm` : "",
    ],
    [
      anthropometricDataMap["ASC"],
      antro?.ASC !== undefined && antro?.ASC !== null ? `${antro.ASC} m²` : "",
    ],
    [
      anthropometricDataMap["IMC"],
      antro?.IMC !== undefined && antro?.IMC !== null
        ? `${antro.IMC} kg/m²`
        : "",
    ],
  ];

  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    head: [["Datos antropométricos:", "Valores"]],
    styles: { fontSize: 12 },
    body: anthropometricData,
  });

  yPosition = (doc as any).lastAutoTable.finalY + 5;

  // Otros datos
  const otherData = [
    ["Aspecto General:", q.aspects],
    ["Piel y mucosas:", q.skin],
    ["Abdomen y Pelvis:", q.abd],
  ];

  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    styles: { fontSize: 12 },
    body: otherData,
  });

  return (doc as any).lastAutoTable.finalY + 10;
}
type resource = {
  id: string;
  name: string;
};

async function addPrescription(
  doc: jsPDF,
  q: QueryData,
  yPosition: number,
): Promise<number> {
  const { prescriptionDetails } = await loadData(q.id);

  title(doc, yPosition, "Prescripción");
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

  return (doc as any).lastAutoTable.finalY + 10;
}

async function addResources(
  doc: jsPDF,
  q: QueryData,
  yPosition: number,
): Promise<number> {
  const resourcesArray: resource[] = (q.resources as resource[]) || [];

  title(doc, yPosition + 10, "Archivos adjuntos");
  if (!resourcesArray.length) return yPosition;

  const images: Array<{ data: string; type: string; name: string }> = [];
  const otherResources: string[] = [];

  for (const resource of resourcesArray) {
    try {
      const fileId = resource.id.split(".").shift() || "";
      const imageData = await getResource(fileId);
      const response = await fetch(imageData);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = uint8Array.reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        );
        const base64 = btoa(binaryString);
        const contentType =
          response.headers.get("Content-Type") || "image/jpeg";
        const base64Image = `data:${contentType};base64,${base64}`;

        const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (acceptedTypes.includes(contentType)) {
          images.push({
            data: base64Image,
            type: contentType.split("/")[1].toUpperCase(),
            name: resource.name,
          });
        } else {
          otherResources.push(resource.name);
        }
      } else {
        console.error("Error al obtener el recurso:", response.status);
        otherResources.push(resource.name);
      }
    } catch (error) {
      console.error("Error al procesar el recurso:", error);
      otherResources.push(resource.name);
    }
  }

  // Mostrar imágenes en tablas individuales
  if (images.length > 0) {
    yPosition += 10;
    const maxWidth = 150;
    const maxHeight = 150;

    let p = yPosition;

    for (const img of images) {
      autoTable(doc, {
        startY: p,
        theme: "plain",
        head: [[""]],
        body: [[img.name]],
        pageBreak: "always",
        styles: { fontSize: 12 },
        columnStyles: { 0: { cellWidth: 180 } },
        didDrawCell: function (data) {
          if (data.section === "body") {
            const cellHeight = data.row.height - data.cell.padding("vertical");
            const textPos = data.cell.getTextPos();

            // Obtener las propiedades de la imagen
            const imgProps = doc.getImageProperties(img.data);

            // Calcular las dimensiones manteniendo la relación de aspecto
            const widthScale = maxWidth / imgProps.width;
            const heightScale = maxHeight / imgProps.height;
            const scale = Math.min(widthScale, heightScale);

            const imgWidth = imgProps.width * scale;
            const imgHeight = imgProps.height * scale;

            // Calcular la posición para centrar la imagen en la celda
            const xOffset = (maxWidth - imgWidth) / 2;
            const yOffset = (maxHeight - imgHeight) / 2;

            // Añadir la imagen
            doc.addImage(
              img.data,
              img.type,
              textPos.x + xOffset,
              textPos.y + 5 + yOffset,
              imgWidth,
              imgHeight,
            );
            p = p + imgHeight;
          }
        },
      });
    }
  }

  // Mostrar otros recursos
  if (otherResources.length > 0) {
    yPosition = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: yPosition,
      pageBreak: "always",
      head: [["Otros recursos"]],
      body: otherResources.map((name) => [name]),
      styles: { fontSize: 12 },
    });
  }
  yPosition = (doc as any).lastAutoTable.finalY + 10;
  return yPosition;
}

function addEnd(doc: jsPDF, yPosition: number, q: QueryData): number {
  const end = [
    ["Extremidades inferiores:", q.exInf],
    ["Extremidades superiores:", q.exSup],
    ["Ano y recto:", q.anus],
    ["Genitourinario:", q.genitu],
    ["Examen neurológico:", q.neuro],
    ["Observaciones y Análisis:", q.observations],
    ["Diagnósticos o Problemas:", q.diag],
  ];
  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    styles: { fontSize: 12 },
    body: end,
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

function addHeadAndTorax(doc: jsPDF, yPosition: number, q: QueryData): number {
  const head: Head = q.head as Head;
  const torax: Torax = q.torax as Torax;

  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    columnStyles: {
      0: { minCellWidth: doc.internal.pageSize.getWidth() / 2 - 20 },
      1: { minCellWidth: doc.internal.pageSize.getWidth() / 2 - 20 },
    },
    head: [["Cabeza y Cuello", "Tórax"]],
    body: [
      [
        { content: "Cráneo y cuero cabelludo", styles: { fontStyle: "bold" } },
        { content: "Caja torácica", styles: { fontStyle: "bold" } },
      ],
      [head?.craneo || "", torax?.caja || ""],
      [
        { content: "Ojos", styles: { fontStyle: "bold" } },
        { content: "Mamas", styles: { fontStyle: "bold" } },
      ],
      [head?.ojos || "", torax?.mamas || ""],
      [
        { content: "Orejas y oídos", styles: { fontStyle: "bold" } },
        { content: "Cardíaco", styles: { fontStyle: "bold" } },
      ],
      [head?.orejas || "", torax?.cardiaco || ""],
      [
        { content: "Nariz", styles: { fontStyle: "bold" } },
        { content: "Campos Pulmonares", styles: { fontStyle: "bold" } },
      ],
      [head?.nariz || "", torax?.pulmonares || ""],
      [{ content: "Boca", styles: { fontStyle: "bold" } }, { content: "" }],
      [head?.boca || "", ""],
      [{ content: "Cuello", styles: { fontStyle: "bold" } }, { content: "" }],
      [head?.cuello || "", ""],
    ],
    styles: {
      cellPadding: 2,
      fontSize: 10,
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;
  return yPosition;
}

export async function makeQuerieDoc(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
  querie: QueryData,
  patient: Patient,
) {
  const doc = new jsPDF();
  let yPosition = 50;
  createPDFHeader(doc, patient.name, "Consulta");

  yPosition = addPatientInfo(doc, patient, yPosition);
  yPosition = addData(doc, querie, yPosition);
  yPosition = addHeadAndTorax(doc, yPosition, querie);
  yPosition = await addResources(doc, querie, yPosition);
  yPosition = addEnd(doc, yPosition, querie);
  yPosition = await addPrescription(doc, querie, yPosition);

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

  // Convertir el PDF a un ArrayBuffer y luego a Buffer
  const pdfOutput = doc.output("arraybuffer");
  const pdfBuffer = Buffer.from(pdfOutput);
  dataCallback(pdfBuffer);
  endCallback();
}
