import { z } from "zod";

export const userSchema = z.object({
  name: z
    .string({ required_error: "Este campo es requerido" })
    .min(10, { message: "Ingrese un nombre valido" })
    .max(130, { message: "Nombre incorrecto" }),

  password: z
    .string({ required_error: "Este campo es requerido" })
    .min(6, { message: "La clave debe de contener almenos 6 caracteres" })
    .max(12, { message: "La clave debe de tener 12 caracteres como maximo" }),

  email: z.string({ required_error: "Este campo es requerido" })
  .email({ message: "Ingrese un Email valido" }),

  rol: z.enum(["ASSISTANT", "DOCTOR"], {
    errorMap: () => ({ message: "Seleccione un rol" }),
  }),
});
export type tUserSchema = z.infer<typeof userSchema>;

export const changeSchema = z.object({
  id: z.string(),
  status: z.boolean(),
});
