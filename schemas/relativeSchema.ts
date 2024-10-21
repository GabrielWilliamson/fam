import z from "zod";

export const civil = [
  "SOLTERO",
  "SOLTERA",
  "CASADO",
  "CASADA",
  "DIVORCIADO",
  "DIVORCIADA",
  "VIUDO",
  "VIUDA",
] as const;

export const relations = [
  "MADRE",
  "PADRE",
  "HIJO",
  "HIJA",
  "ESPOSO",
  "ESPOSA",
  "TIA",
  "TIO",
  "HERMANO",
  "HERMANA",
  "ABUELO",
  "ABUELA",
  "CUÑADO",
  "CUÑADA",
  "SUEGRO",
  "SUEGRA",
] as const;

const country = z.object({
  country: z.string(),
  countryCode: z.number(),
  flag: z.string(),
});

export const RelativeSchema = z.object({
  name: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "Nombre incorrecto" })
    .max(130, { message: "Nombre incorrecto" }),
  phone: z
    .string({ required_error: "Este campo es requerido" })
    .min(8, { message: "Teléfono incorrecto" }),
  nationality: country,
  DNI: z
    .string({ required_error: "Este campo es requerido" })
    .max(16, { message: "Cédula incorrecta" })
    .min(16, { message: "Cédula incorrecta" }),
  relation: z.enum(relations, { required_error: "Este campo es requerido" }),
  civilStatus: z.enum(civil, { required_error: "Este campo es requerido" }),
  patientId: z.string(),
});

export type RelativeType = z.infer<typeof RelativeSchema>;
