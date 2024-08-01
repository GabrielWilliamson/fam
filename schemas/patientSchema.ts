import { z } from "zod";

const country = z.object({
  country: z.string(),
  countryCode: z.number(),
  flag: z.string(),
});

const basePatientSchema = z.object({
  name: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "Ingrese un nombre válido" })
    .max(130, { message: "Nombre incorrecto" }),
  sex: z.enum(["MASCULINO", "FEMENINO"], {
    required_error: "Este campo es requerido",
  }),
  nationality: country,
  department: z.string({ required_error: "Este campo es requerido" }),
  municipality: z.string({ required_error: "Este campo es requerido" }),
  date: z.date(),
  address: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "La dirección debe de tener almenos 10 caracteres" }),
  action: z.enum(["now", "date"]).nullable(),
});

//GENERAL
export const patientSchema = basePatientSchema.extend({
  phone: z.number().optional(),
  DNI: z
    .string({ required_error: "Este campo es requerido" })
    .min(14, { message: "Incorrecta" })
    .max(14, { message: "Incorrecta" }),
});
export type tPatientSchema = z.infer<typeof patientSchema>;

//PEDIATRICO
export const pediatricPatientSchema = basePatientSchema;
export type tPediatricPatientSchema = z.infer<typeof pediatricPatientSchema>;

//SMS
export const smsSchema = z.object({
  phones: z.array(z.string()).min(1, { message: "Mínimo 1" }),
  sms: z.string().min(4, { message: "Mínimo 4 caracteres" }),
});

export type tSms = z.infer<typeof smsSchema>;
