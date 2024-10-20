import z from "zod";
import { db } from "../db/db";
import { Assistants } from "../db/schemas";

export const addChageSchema = z.object({
  amount: z.number().positive().min(10),
});

export const rateSchema = z.object({
  rate: z.number().positive().min(35),
});
export type tRate = z.infer<typeof rateSchema>;

export function generateConciliationSchema(cordobas: number, dolares: number) {
  const conciliationSchema = z.object({
    cordobas: z.number().default(0),
    dolares: z.number().default(0),
    faltanteC: z.number().default(0),
    sobranteC: z.number().default(0),
    faltanteD: z.number().default(0),
    sobranteD: z.number().default(0),
  });
  return conciliationSchema;
}

export function generateExpencesSchema(cordobas: number, dolares: number) {
  const formSchema = z.object({
    description: z.string().min(1, "La descripción es requerida"),
    cordobas: z
      .number()
      .max(cordobas, "La cantidad supera el monto disponible")
      .default(0),
    dollars: z
      .number()
      .max(dolares, "La cantidad supera el monto disponible")
      .default(0),
  });
  return formSchema;
}
