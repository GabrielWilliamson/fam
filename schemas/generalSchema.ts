import z from "zod";

export const tobacoSchema = z.object({
  tobaccoType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Complete este campo"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Complete este campo"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
});
export type tobaco = z.infer<typeof tobacoSchema>;

export const alcoholSchema = z.object({
  alcoholType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Complete este campo"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Complete este campo"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
});
export type alcohol = z.infer<typeof alcoholSchema>;

export const drogasSchema = z.object({
  drugType: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, "Complete este campo"),
  consumptionAmount: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  consumptionFrequency: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  startAge: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
  duration: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, "Complete este campo"),
});
export type drogas = z.infer<typeof drogasSchema>;

export const farmSchema = z.object({
  num: z.string({ required_error: "Este campo es requerido" }),
  posology: z.string({ required_error: "Este campo es requerido" }),
});
export type farm = z.infer<typeof farmSchema>;
