import z from "zod";

export const reasonSchema = z.object({
  reason: z.string().max(700, { message: "Máximo 15 caracteres" }),
});

export type reason = z.infer<typeof reasonSchema>;

export const historySchema = z.object({
  history: z.string().max(700, { message: "Máximo 700 caracteres" }),
});

export type history = z.infer<typeof historySchema>;

export const interrogationSchema = z.object({
  interrogation: z.string().max(700, { message: "Máximo 700 caracteres" }),
});

export type interrogation = z.infer<typeof interrogationSchema>;
