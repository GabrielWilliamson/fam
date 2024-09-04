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

export function generateConciliationSchema(total: number) {
  const conciliationSchema = z.object({
    total: z.number().positive().max(total),
  });
  return conciliationSchema;
}
