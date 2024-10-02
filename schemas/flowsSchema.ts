import z from "zod";

export const bankAccountSchema = z.object({
  name: z.string().max(100).min(3),
  currency: z.enum(["cor", "dol"]),
  // agrega un input de type color que pueda usar facilmente con taiwind
  color: z.string(),
});
export const priceSchema = z
  .object({
    price: z.number().positive(),
    chargePersonally: z.boolean(),
    paymentMethod: z.enum(["cash", "transfer"]).nullable(),
    bankAccountId: z.string().nullable(),
    cordobas: z.number().nonnegative().nullable(),
    dollars: z.number().nonnegative().nullable(),
    change: z.number().nonnegative().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "transfer" && !data.bankAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El banco es requerido si el pago es por transferencia",
        path: ["bankAccountId"],
      });
    }

    if (
      data.paymentMethod === "cash" &&
      data.cordobas === null &&
      data.dollars === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Se requiere el monto en córdobas o dólares si el pago es en efectivo",
        path: ["cordobas", "dollars"],
      });
    }

    if (data.change !== null) {
      const totalPayment = (data.cordobas ?? 0) + (data.dollars ?? 0) * 20;
      if (data.change > totalPayment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El cambio no puede ser mayor que el monto pagado",
          path: ["change"],
        });
      }
    }
  });
export const chargeSchemaAssistant = z.object({
  cordobas: z.number(),
  dollars: z.number(),
  change: z.number().nonnegative().nullable(),
});
