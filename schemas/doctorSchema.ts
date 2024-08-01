import z from "zod";

export const credentialSchema = z.object({
  credential: z
    .number({
      required_error: "Ingrese un número de credencial",
    })
    .max(99999999, { message: "Ingrese una credencial válida" })
    .min(1000, { message: "Ingrese una credencial válida" }),
});

export const specialiteSchema = z.object({
  specialite: z.enum(["GENERAL", "PEDIATRIA"], {
    errorMap: () => ({ message: "Seleccione un especialidad" }),
  }),
});

export const addAssitantShema = z.object({
  assistantId: z.string({ required_error: "Seleccione un asistente" }),
});

export const skillsSchema = z.object({
  skills: z.string(),
});
