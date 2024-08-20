import { z } from "zod";

const country = z.object({
  country: z.string(),
  countryCode: z.number(),
  flag: z.string(),
});

// PEDIATRICOS
export const pediatricSchema = z.object({
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
  address: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "La dirección debe de tener al menos 10 caracteres" }),
  action: z.enum(["now", "date"]).nullable(),
  date: z.date().refine(
    (date) => {
      const today = new Date();
      const birthDate = new Date(date);

      // Set hours to 0 for accurate comparison
      today.setHours(0, 0, 0, 0);
      birthDate.setHours(0, 0, 0, 0);

      // Calculate the age
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      const dayDifference = today.getDate() - birthDate.getDate();

      // Adjust age if the birthdate hasn't occurred yet this year
      const isBirthdayPassed =
        monthDifference > 0 || (monthDifference === 0 && dayDifference >= 0);
      const adjustedAge = isBirthdayPassed ? age : age - 1;

      return birthDate <= today && adjustedAge <= 18;
    },
    {
      message:
        "La fecha de nacimiento debe indicar que el paciente tiene 18 años o menos",
    }
  ),
});

export type tPediatricSchema = z.infer<typeof pediatricSchema>;

//GENERAL
export const generalSchema = z.object({
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
  address: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "La dirección debe de tener al menos 10 caracteres" }),
  action: z.enum(["now", "date"]).nullable(),
  date: z.date({ required_error: "Este campo es requerido" }).refine(
    (date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minimumDate = new Date(today);
      minimumDate.setFullYear(today.getFullYear() - 16);
      return date <= minimumDate;
    },
    {
      message: "Debe tener al menos 16 años",
    }
  ),
  phone: z
    .string()
    .min(8, { message: "El número debe de tener al menos 8 caracteres" })
    .max(8, { message: "El número debe de tener 8 caracteres como máximo" })
    .optional()
    .nullable(),
  Dni: z
    .string()
    .length(16, "Complete la Cédula")
    .refine((value) => /^[A-Za-z]$/.test(value[value.length - 1]), {
      message: "El último carácter debe ser una letra",
    })
    .optional()
    .nullable(),
  foreign: z.string().optional().nullable(),
  dateDni: z.date().optional().nullable(),
});
export type tgeneralSchema = z.infer<typeof generalSchema>;

//SMS
export const smsSchema = z.object({
  phones: z.array(z.string()).min(1, { message: "Mínimo 1" }),
  sms: z.string().min(4, { message: "Mínimo 4 caracteres" }),
});

export type tSms = z.infer<typeof smsSchema>;
