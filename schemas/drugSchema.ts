import z from "zod";

export const drugsSchema = z.object({
  genericName: z.string().min(4, { message: "Mínimo 4 caracteres" }).optional(),
  tradeName: z
    .string({ required_error: "Este campo es requerido" })
    .min(4, { message: "Mínimo 4 caracteres" }),
  presentations: z.string().array(),
});
export type drugsType = z.infer<typeof drugsSchema>;
