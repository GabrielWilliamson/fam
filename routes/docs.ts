import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/db";
import { Doctors, Files, Patients, Relatives, Users } from "../db/schemas";
import { getResource } from "../lib/store";
import type { authVariables } from "../types/auth";
import { readFile } from "fs/promises";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createPDFHeader, subTitle, title } from "../lib/pdf";
import type {
  tPost,
  tPrenatales,
  psico,
  feeding,
  tParto,
  app,
} from "../schemas/fileSchema";
import { formatPhone } from "../lib/helpers";

interface Relative {
  id: string;
  name: string;
  dni: string | null;
  phone: string | null;
  relation: string;
  civilStatus: string;
}

interface PatientData {
  infecto: string[];
  hereditary: string[];
  prenatales: Record<string, string>;
  parto: Record<string, string>;
  postnatales: Record<string, string>;
  feeding: Record<string, string>;
  psico: Record<string, boolean | string>;
  app: Record<string, string>;
}

function addPatientInfo(doc: jsPDF, patient: any, yPosition: number): number {
  const birthDate = new Date(patient.date);
  const age = Math.floor(
    (new Date().getTime() - birthDate.getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  );

  const availableWidth = 190 - 10 - 60;

  autoTable(doc, {
    startY: yPosition,
    theme: "grid",
    styles: {
      fontSize: 12,
      font: "courier",
      textColor: "#000000",
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: "auto" },
    },
    body: [
      ["Paciente:", patient.name],
      ["Sexo:", patient.sex],
      ["Edad:", `${age} años`],
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

function addFamiliares(
  doc: jsPDF,
  relatives: Relative[],
  yPosition: number,
): number {
  // Si no hay datos, añadimos una fila con colspan
  const bodyData: (
    | string
    | { content: string; colSpan: number; styles: { halign: string } }
  )[][] =
    relatives.length > 0
      ? relatives.map((relative) => [
          relative.name || "N/A",
          relative.relation || "N/A",
          relative.civilStatus || "N/A",
          relative.dni || "N/A",
          relative.phone ? formatPhone(relative.phone) : "",
        ])
      : [
          // Fila que indica que no hay datos, abarcando todas las columnas con colspan
          [
            {
              content: "No hay datos para mostrar",
              colSpan: 5,
              styles: { halign: "center" },
            },
          ],
        ];

  autoTable(doc, {
    startY: yPosition,
    head: [["Nombre", "Parentesco", "Estado Civil", "Cédula", "Teléfono"]],
    body: bodyData as any, // Forzamos el tipo para que sea compatible
    styles: {
      fontSize: 10,
      font: "courier",
      cellPadding: 1,
      textColor: [0, 0, 0],
    },
    theme: "grid",
    pageBreak: "auto",
  });

  return (doc as any).lastAutoTable.finalY + 10;
}

function addAntecedentesFamiliares(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  autoTable(doc, {
    startY: yPosition,
    head: [
      ["Enfermedades Infecto – contagiosas:", "Enfermedades Hereditarias:"],
    ],
    body: [
      [
        patientData.infecto.join(", ") || "N/A",
        patientData.hereditary.join(", ") || "N/A",
      ],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 1,
      font: "courier",
      textColor: [0, 0, 0],
    },
    theme: "grid",
    pageBreak: "auto",
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

function addAntecedentesPrenatales(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const { prenatales } = patientData;

  const combinedEntries: Array<{ title: string; key: keyof tPrenatales }> = [
    { title: "Gesta:", key: "gesta" },
    { title: "Para:", key: "para" },
    { title: "Abortos (No. e intervalos):", key: "aborto" },
    { title: "Cesárea:", key: "cesarea" },
    { title: "FUM:", key: "fum" },
    { title: "Abortos:", key: "abortosInfo" },
    { title: "Cesáreas (motivos):", key: "cesareaMotivos" },
    { title: "Lugar de la/s cesárea/s:", key: "cesareaLugar" },
    { title: "Lugar y No. de CPN:", key: "cpnInfo" },
    {
      title: "Enf. Previas y/o crónicas de la madre:",
      key: "enfermedadesPrevias",
    },
    {
      title: "Enf. De la madre durante el embarazo:",
      key: "enfermedadesEmbarazo",
    },
    { title: "Medicación durante el embarazo:", key: "medicacionEmbarazo" },
    {
      title: "Hospitalizaciones y complicaciones durante el embarazo:",
      key: "hospitalizaciones",
    },
  ];

  // Filtramos las entradas donde hay valores definidos
  const bodyData: (
    | string
    | { content: string; colSpan?: number; styles: { halign: string } }
  )[][] = [];

  const hasData = combinedEntries.some(
    (entry) => prenatales[entry.key] && prenatales[entry.key] !== "",
  );

  if (hasData) {
    bodyData.push(
      ...combinedEntries
        .filter(
          (entry) => prenatales[entry.key] && prenatales[entry.key] !== "",
        )
        .map((entry) => [
          { content: entry.title, styles: { halign: "left" } },
          {
            content: prenatales[entry.key] as string,
            styles: { halign: "left" },
          },
        ]),
    );
  } else {
    // Fila que indica que no hay datos, abarcando todas las columnas con colspan
    bodyData.push([
      {
        content: "No hay datos para mostrar",
        colSpan: 2, // Ensure colSpan is only present in this row
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizamos la tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [["Aspecto", "Descripción"]],
    body: bodyData as any, // Forzamos el tipo para que sea compatible
    styles: {
      fontSize: 10,
      cellPadding: 1,
      font: "courier",
      textColor: [0, 0, 0],
    },
    theme: "grid",
    pageBreak: "auto",
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: "auto" },
    },
  });

  // Retornamos la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

function addAntecedentesParto(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const partoEntries: Array<{ title: string; key: keyof tParto }> = [
    { title: "Lugar de la atención del parto:", key: "lugarAtencionParto" },
    { title: "Fecha y hora del nacimiento:", key: "horaNacimiento" },
    { title: "Duración del parto:", key: "duracionParto" },
    { title: "Edad gestacional:", key: "edadGestacional" },
    { title: "Atención del parto:", key: "atencionParto" },
    { title: "Vía:", key: "viaParto" },
    { title: "Presentación:", key: "presentacion" },
    { title: "Eventualidades durante el parto:", key: "eventualidades" },
  ];

  const { parto } = patientData;

  // Filtramos las entradas donde hay valores definidos
  const bodyData: (
    | string
    | { content: string; colSpan?: number; styles: { halign: string } }
  )[][] = [];

  // Comprobamos si hay datos en parto
  const hasData = partoEntries.some(
    (entry) => parto[entry.key] && parto[entry.key] !== "",
  );

  if (hasData) {
    bodyData.push(
      ...partoEntries
        .filter((entry) => parto[entry.key] && parto[entry.key] !== "")
        .map((entry) => [
          { content: entry.title, styles: { halign: "left" } },
          {
            content: parto[entry.key] as string,
            styles: { halign: "left" },
          },
        ]),
    );
  } else {
    // Fila que indica que no hay datos, abarcando todas las columnas con colspan
    bodyData.push([
      {
        content: "No hay datos para mostrar",
        colSpan: 2, // Aplicamos colSpan solo en esta fila
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizamos la tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [["Aspecto", "Descripción"]],
    body: bodyData as any, // Forzamos el tipo para que sea compatible
    styles: {
      fontSize: 10,
      font: "courier",
      textColor: [0, 0, 0],
      cellPadding: 1,
    },
    theme: "grid",
    pageBreak: "auto",
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: "auto" },
    },
  });

  // Retornamos la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

function addAntecedentesPostnatales(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const postEntries: Array<{ title: string; key: keyof tPost }> = [
    { title: "APGAR: 1º:", key: "apgar1" },
    { title: "APGAR: 5º:", key: "apgar5" },
    { title: "Peso (gr):", key: "peso" },
    { title: "Talla (cm):", key: "talla" },
    { title: "Datos de Asfixia", key: "asfixia" },
    { title: "Especificación de Asfixia", key: "asfixiaEspecifique" },
    { title: "Alojamiento conjunto:", key: "alojamientoConjunto" },
    { title: "Tiempo junto a su madre:", key: "tiempoJuntoMadre" },
    { title: "Hospitalización (Lugar/Tiempo):", key: "hospitalizacion" },
  ];

  const { postnatales } = patientData;

  // Filtramos las entradas donde hay valores definidos
  const bodyData: (
    | string
    | { content: string; colSpan?: number; styles: { halign: string } }
  )[][] = [];

  // Comprobamos si hay datos en postnatales
  const hasData = postEntries.some(
    (entry) =>
      postnatales[entry.key] !== null &&
      postnatales[entry.key] !== undefined &&
      postnatales[entry.key] !== "",
  );

  if (hasData) {
    bodyData.push(
      ...postEntries
        .filter(
          (entry) =>
            postnatales[entry.key] !== null &&
            postnatales[entry.key] !== undefined &&
            postnatales[entry.key] !== "",
        )
        .map((entry) => {
          const value = postnatales[entry.key];

          let displayValue = "";

          // Manejo de booleanos
          if (typeof value === "boolean") {
            displayValue = value ? "Sí" : "No";
          }
          // Manejo de strings
          else if (typeof value === "string") {
            displayValue = value;
          }
          // Para valores null o undefined
          else {
            displayValue = "N/A";
          }

          return [
            { content: entry.title, styles: { halign: "left" } },
            { content: displayValue, styles: { halign: "left" } },
          ];
        }),
    );
  } else {
    // Fila que indica que no hay datos, abarcando todas las columnas con colspan
    bodyData.push([
      {
        content: "No hay datos para mostrar",
        colSpan: 2, // Aplicamos colSpan solo en esta fila
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizamos la tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [["Aspecto", "Descripción"]],
    body: bodyData as any, // Forzamos el tipo para que sea compatible
    styles: {
      fontSize: 10,
      font: "courier",
      textColor: [0, 0, 0],
      cellPadding: 1,
    },
    theme: "grid",
    pageBreak: "auto",
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: "auto" },
    },
  });

  // Retornamos la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

function addAlimentacion(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const feedingEntries: Array<{ title: string; key: keyof feeding }> = [
    { title: "Lactancia Materna Exclusiva:", key: "exclusiveBreastfeeding" },
    { title: "Lactancia Mixta:", key: "mixedFeeding" },
    {
      title: "Duración de lactancia exclusiva:",
      key: "exclusiveBreastfeedingDuration",
    },
    { title: "Duración de lactancia mixta:", key: "mixedFeedingDuration" },
    { title: "Ablactación", key: "weaning" },
  ];

  const { feeding } = patientData;

  // Cuerpo de la tabla
  const bodyData = feedingEntries
    .map((entry) => {
      const value = feeding[entry.key];

      // Para los valores booleanos, convertir a "Sí" o "No"
      if (typeof value === "boolean") {
        return [entry.title, value ? "Sí" : "No"];
      }

      // Para los valores opcionales o strings
      if (value && typeof value === "string") {
        return [entry.title, value];
      }

      // Si es null, undefined o vacío
      return null;
    })
    .filter((item) => item !== null); // Filtrar nulos

  // Si no hay datos, agregar un mensaje
  if (bodyData.length === 0) {
    bodyData.push([
      {
        content: "No hay datos de alimentación registrados.",
        colSpan: 2, // Aplicamos colSpan para ocupar ambas columnas
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizar la tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [["Alimentación", "Valor"]],
    body: bodyData as any,
    styles: {
      fontSize: 10,
      cellPadding: 1,
      textColor: [0, 0, 0],
      font: "courier",
    },
    theme: "grid",
    pageBreak: "auto",
  });

  // Retornar la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

function addDesarrolloPsicomotor(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const psicoEntries: Array<{
    title: string;
    key: keyof psico;
    ageKey: keyof psico;
  }> = [
    { key: "fixedGaze", ageKey: "fixedGazeAge", title: "Fijó la mirada" },
    { key: "heldHeadUp", ageKey: "heldHeadUpAge", title: "Sostuvo la cabeza" },
    { key: "smiled", ageKey: "smiledAge", title: "Se sonrió" },
    { key: "satUp", ageKey: "satUpAge", title: "Se sentó" },
    { key: "crawled", ageKey: "crawledAge", title: "Gateó" },
    { key: "walked", ageKey: "walkedAge", title: "Caminó" },
    { key: "projected", ageKey: "projectedAge", title: "Se proyectó" },
  ];

  const { psico } = patientData;

  // Generar el cuerpo de la tabla
  const bodyData = psicoEntries
    .map((entry) => {
      const achieved = psico[entry.key];
      const age = psico[entry.ageKey];

      // Convertir booleanos a "Sí" o "No", y manejar edades o valores no definidos
      return [
        entry.title,
        typeof achieved === "boolean" ? (achieved ? "Sí" : "No") : null,
        age !== undefined ? age.toString() : null,
      ];
    })
    .filter((item) => item[1] !== null || item[2] !== null); // Filtrar solo los que tienen datos

  // Si no hay datos, agregamos un mensaje indicando que no hay datos
  if (bodyData.length === 0) {
    bodyData.push([
      {
        content: "No hay desarrollo psicomotor registrado.",
        colSpan: 3, // Aplicamos colSpan para ocupar todas las columnas
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizar la tabla con autoTable
  autoTable(doc, {
    startY: yPosition,
    head: [["Habilidad", "Logrado", "Edad"]],
    body: bodyData,
    styles: {
      fontSize: 10,
      font: "courier",
      textColor: [0, 0, 0],
      cellPadding: 1,
    },
    theme: "grid",
    pageBreak: "auto",
  });

  // Retornar la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

function addApp(
  doc: jsPDF,
  patientData: PatientData,
  yPosition: number,
): number {
  const { app } = patientData;
  const antecedentesEntries: Array<{ title: string; key: keyof app }> = [
    { title: "Infecciones", key: "infections" },
    { title: "Enfermedades Crónicas", key: "chronicDiseases" },
    { title: "Cirugías", key: "surgeries" },
    { title: "Hospitalizaciones", key: "hospitalizations" },
    { title: "Otros", key: "others" },
  ];

  // Mapeo de los datos con títulos correspondientes, filtrando valores undefined
  const bodyData = antecedentesEntries
    .map(({ title, key }) => (app[key] ? [title, app[key]] : null)) // Retorna null si el valor es undefined
    .filter((item) => item !== null); // Filtra los nulls

  // Si no hay datos, agregamos un mensaje indicando que no hay datos
  if (bodyData.length === 0) {
    bodyData.push([
      {
        content: "No hay antecedentes personales patológicos registrados.",
        colSpan: 2, // Aplicamos colSpan para ocupar ambas columnas
        styles: { halign: "center" },
      },
    ]);
  }

  // Renderizamos la tabla con los antecedentes
  autoTable(doc, {
    startY: yPosition,
    head: [["Antecedente", "Descripción"]],
    body: bodyData,
    styles: {
      fontSize: 10,
      cellPadding: 1,
      textColor: [0, 0, 0],
      font: "courier",
    },
    theme: "grid",
    pageBreak: "auto",
  });

  // Retornamos la posición final Y
  return (doc as any).lastAutoTable.finalY + 10;
}

async function makeDoc(
  dataCallback: (chunk: Buffer) => void,
  endCallback: () => void,
  relatives: Relative[],
  patient: any,
  doctorName: string,
  patientData: PatientData,
): void {
  const doc = new jsPDF();

  let yPosition = 50;
  createPDFHeader(doc, doctorName, `Expediente pediátrico #${patient.fileId}`);

  //content

  yPosition = addPatientInfo(doc, patient, yPosition);
  title(doc, yPosition, "Familiares");
  yPosition = addFamiliares(doc, relatives, yPosition + 10);
  title(doc, yPosition, "Antecedentes familiares patológicos");
  yPosition = addAntecedentesFamiliares(doc, patientData, yPosition + 10);
  title(doc, yPosition, "Antecedentes Personales no Patológicos");
  subTitle(doc, yPosition + 10, "Antecedentes Prenatales");
  yPosition = addAntecedentesPrenatales(doc, patientData, yPosition + 15);
  subTitle(doc, yPosition + 5, "Antecedentes del Parto");
  yPosition = addAntecedentesParto(doc, patientData, yPosition + 10);
  subTitle(doc, yPosition + 5, "Antecedentes Postnatales");
  yPosition = addAntecedentesPostnatales(doc, patientData, yPosition + 10);
  subTitle(doc, yPosition + 5, "Alimentación");
  yPosition = addAlimentacion(doc, patientData, yPosition + 10);
  subTitle(doc, yPosition + 5, "Desarrollo psicomotor");
  yPosition = addDesarrolloPsicomotor(doc, patientData, yPosition + 10);
  title(doc, yPosition, "Antecedentes Personales Patológicos");
  yPosition = addApp(doc, patientData, yPosition + 15);

  var pageSize = doc.internal.pageSize;
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    var pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

    doc.text(`Página ${i} de ${totalPages}`, 190, pageHeight - 10, {
      align: "right",
    });
  }

  // Convertir el PDF a un ArrayBuffer
  const pdfOutput = doc.output("arraybuffer");

  // Convertir ArrayBuffer a Buffer y enviar
  const pdfBuffer = Buffer.from(pdfOutput);
  dataCallback(pdfBuffer);
  endCallback();
}

export const docsRoute = new Hono<{ Variables: authVariables }>().get(
  "/pediatric",
  async (c) => {
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
        app: Files.app,
        apnp: Files.apnp,
      })
      .from(Patients)
      .innerJoin(Files, eq(Patients.id, Files.patientId))
      .innerJoin(Doctors, eq(Patients.doctorId, Doctors.id))
      .innerJoin(Users, eq(Doctors.userId, Users.id))
      .where(eq(Patients.id, patientId))
      .limit(1);

    console.log(patient[0].origin);

    if (!patient || patient.length === 0) {
      return c.json({ success: false, data: null }, 404);
    }

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
        makeDoc(
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
  },
);
