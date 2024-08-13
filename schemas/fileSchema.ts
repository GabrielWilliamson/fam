
import z from "zod";
export const values = [
  "Hepatitis",
  "S\u00EDfilis",
  "TB",
  "C\u00F3lera",
  "Amebiasis",
  "Tosferina",
  "Sarampi\u00F3n",
  "Varicela",
  "Rub\u00E9ola",
  "Parotiditis",
  "Meningitis",
  "Imp\u00E9tigo",
  "Fiebre tifoidea",
  "Escarlatina",
  "Malaria",
  "Escabiosis",
  "Pediculosis",
  "Ti\u00F1a",
] as const;

export const infectoSchema = z.object({
  infecto: z
    .array(z.enum(values))
    .min(1, "Debes seleccionar al menos una enfermedad")
    .max(7, "No puedes seleccionar más de 7 enfermedades"),
});

export type tInfecto = z.infer<typeof infectoSchema>;



export const hereditaryValues = [
  "Alergias",
  "Diabetes mellitus",
  "Hipertensi\u00F3n arterial",
  "Enfermedad reum\u00E1tica",
  "Enfermedades renales",
  "Enfermedades oculares",
  "Enfermedades cardiacas",
  "Enfermedad hep\u00E1tica",
  "Enfermedades musculares",
  "Malformaciones cong\u00E9nitas",
  "Des\u00F3rdenes mentales",
  "Enfermedades degenerativas del sistema nervioso central",
  "Anomal\u00EDas del crecimiento y desarrollo",
  "Errores innatos del metabolismo",
] as const;

export const hereditarySchema = z.object({
  hereditary: z
    .array(z.enum(hereditaryValues))
    .min(1, "Debes seleccionar al menos una enfermedad")
    .max(7, "No puedes seleccionar más de 7 enfermedades"),
});

export type tHereditary = z.infer<typeof hereditarySchema>;
