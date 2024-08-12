import z from "zod";

export const addChageSchema = z.object({
  amount: z.number().positive().min(10),
});
