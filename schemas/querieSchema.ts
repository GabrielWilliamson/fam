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
export const priceSchema = z.object({
  price: z.number().min(200, "El precio debe ser mayor o igual a C$ 200.00"),
  pay: z.boolean().default(false),
});

export const chargeSchema = z.object({
  cordobas: z.number(),
  dolares: z.number(),
});

export type price = z.infer<typeof priceSchema>;

export type interrogation = z.infer<typeof interrogationSchema>;

export const autoSchema = z.object({
  data: z.string().max(700, { message: "Máximo 700 caracteres" }),
  autoType: z.enum([
    "history",
    "interrogation",
    "reason",
    "abd",
    "anus",
    "aspects",
    "diag",
    "exInf",
    "exSup",
    "gen",
    "neu",
    "obs",
    "skin",
  ]),
});
export type auto = z.infer<typeof autoSchema>;

export const headSchema = z.object({
  craneo: z.string().optional().nullable(),
  ojos: z.string().optional().nullable(),
  orejas: z.string().optional().nullable(),
  nariz: z.string().optional().nullable(),
  boca: z.string().optional().nullable(),
  cuello: z.string().optional().nullable(),
});

export type head = z.infer<typeof headSchema>;

export const toraxSchema = z.object({
  pulmonares: z.string().optional().nullable(),
  mamas: z.string().optional().nullable(),
  caja: z.string().optional().nullable(),
  cardiaco: z.string().optional().nullable(),
});

export type torax = z.infer<typeof toraxSchema>;
