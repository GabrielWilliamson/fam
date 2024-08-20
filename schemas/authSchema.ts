import { z } from "zod";

export const loginSchema = z.object({
  password: z
    .string({ required_error: "Este campo es requerido" })
    .min(6, { message: "La clave debe contener al menos 6 caracteres" })
    .max(12, { message: "La clave debe tener 12 caracteres como máximo" }),

  email: z
    .string({ required_error: "Este campo es requerido" })
    .email({ message: "Ingrese un email válido" }),
});
export type tLoginSchema = z.infer<typeof loginSchema>;

export const verifySchema = z.object({
  email: z.string().email({ message: "Ingrese un email válido" }),
  token: z.string().length(32, { message: "Token de verificación incorrecto" }),
});
export type tVerifySchema = z.infer<typeof verifySchema>;

//reset password
export const sendEmailForgotSchema = z.object({
  email: z
    .string({ required_error: "Este campo es requerido" })
    .email({ message: "Ingrese un email válido" }),
});
export type tSendEmailForgotSchema = z.infer<typeof sendEmailForgotSchema>;

export const resetSchema = z
  .object({
    email: z.string().email({ message: "Ingrese un email válido" }),
    token: z
      .string()
      .length(64, { message: "Token de verificación incorrecto" }),
    newPassword: z
      .string({ required_error: "Este campo es requerido" })
      .min(6, { message: "La clave debe contener al menos 6 caracteres" })
      .max(12, { message: "La clave debe tener 12 caracteres como máximo" }),

    confirmPass: z
      .string({ required_error: "Este campo es requerido" })
      .min(6, { message: "La clave debe contener al menos 6 caracteres" })
      .max(12, { message: "La clave debe tener 12 caracteres como máximo" }),
  })
  .refine((data) => data.newPassword === data.confirmPass, {
    message: "Las claves no coinciden",
    path: ["confirmPass"],
  });
export type tResetSchema = z.infer<typeof resetSchema>;
