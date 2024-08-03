import { z } from "zod";

export const loginSchema = z.object({
  password: z
    .string({ required_error: "Este campo es requerido" })
    .min(6, { message: "La clave debe de contener almenos 6 caracteres" })
    .max(12, { message: "La clave debe de tener 12 caracteres como maximo" }),

  email: z.string(
    { required_error: "Este campo es requerido" },
  ).email({ message: "Ingrese un Email valido" }),
});
export type tloginSchema = z.infer<typeof loginSchema>;

export const verifySchema = z.object({
  email: z.string().email({ message: "Ingrese un Email valido" }),
  token: z.string(),
});
export type tVerifySchema = z.infer<typeof verifySchema>;
