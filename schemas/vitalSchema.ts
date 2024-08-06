import z from "zod";

export const vitalsSchema = z.object({
  FC: z.number().int().nullable().optional(),
  SA: z
    .number()
    .int()
    .min(0, { message: "Mínimo 0" })
    .max(10, { message: "Máximo 10" })
    .nullable()
    .optional(),
  FR: z
    .number()
    .int()
    .max(60, { message: "Máximo 60" })
    .min(10, { message: "Mínimo 10" })
    .nullable()
    .optional(),

  T: z.number().max(50, { message: "Máximo 50" }).optional(),
  PA: z
    .object({
      a: z.number().max(300, { message: "Máximo 300" }).nullable(),
      b: z.number().max(300, { message: "Máximo 300" }).nullable(),
    })
    .nullable()
    .superRefine((data, ctx) => {
      if (!data) return;
      const { a, b } = data;
      if (
        (a !== null && b === null) ||
        (a === null && b !== null)
      ) {
        if (a === null) {
          ctx.addIssue({
            path: ["a"],
            code: z.ZodIssueCode.custom,
            message: "Dato incorrecto",
          });
        }
        if (b === null) {
          ctx.addIssue({
            path: ["b"],
            code: z.ZodIssueCode.custom,
            message: "Dato incorrecto",
          });
        }
      }
    }),
});

export type vitals = z.infer<typeof vitalsSchema>;

export const antropometricsSchema = z.object({
  IMC: z.number().nullable().optional(),
  W: z
    .object({
      peso: z.number().nullable().optional(),
      unit: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  TL: z.number().nullable().optional(),
  PC: z.number().nullable().optional(),
  PRA: z.number().nullable().optional(),
  ASC: z.number().nullable().optional(),
  PT: z.number().nullable().optional(),
});

export type antropometrics = z.infer<typeof antropometricsSchema>;
