import z from "zod";

export const vitalsSchema = z.object({
  FR: z.number().int().max(60, { message: "Máximo 60" }).optional(),
  FC: z.number().int().optional(),
  T: z.number().max(50, { message: "Máximo 300" }).optional(),
  PA: z
    .object({
      a: z.number().int().max(300, { message: "Máximo 300" }).optional(),
      b: z.number().int().max(300, { message: "Máximo 300" }).optional(),
    })
    .optional()
    .superRefine((data, ctx) => {
      if (!data) return;
      const { a, b } = data;
      if (
        (a !== undefined && b === undefined) ||
        (a === undefined && b !== undefined)
      ) {
        if (a === undefined) {
          ctx.addIssue({
            path: ["a"],
            code: z.ZodIssueCode.custom,
            message: "Dato incorrecto",
          });
        }
        if (b === undefined) {
          ctx.addIssue({
            path: ["b"],
            code: z.ZodIssueCode.custom,
            message: "Dato incorrecto",
          });
        }
      }
    }),
  IMC: z.number().optional(),
});

export type vitals = z.infer<typeof vitalsSchema>;
