import z from "zod";

export const credentialSchema = z.object({
  credential: z
    .number({
      required_error: "Ingrese un número de credencial",
    })
    .max(99999999, { message: "Ingrese una credencial válida" })
    .min(1000, { message: "Ingrese una credencial válida" }),
});
export const fileTypeSchema = z.object({
  specialite: z.enum(["GENERAL", "PEDIATRIA"], {
    errorMap: () => ({ message: "Seleccione un especialidad" }),
  }),
});
export const specialitySchema = z.object({
  speciality: z.string(),
});
export const addAssitantSchema = z.object({
  assistantId: z.string({ required_error: "Seleccione un asistente" }),
});
export const socialsSchema = z.object({
  skills: z.string(),
});
export const diasesSchema = z.object({
  name: z.string().min(2).max(20),
});
