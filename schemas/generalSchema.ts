import z from "zod";

export const tobacoSchema = z.object({
  tobaccoType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
});
export type tobaco = z.infer<typeof tobacoSchema>;

export const alcoholSchema = z.object({
  alcoholType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
});
export type alcohol = z.infer<typeof alcoholSchema>;

export const drogasSchema = z.object({
  drugType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Mínimo 4 caracteres"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Mínimo 1 caracterer"),
});
export type drogas = z.infer<typeof drogasSchema>;
