import z from "zod";

export const detailSchema = z.object({
  tradeName: z.string({ required_error: "Este campo es requerido" }),
  presentation: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, { message: "Error" }),
  indications: z
    .string({ required_error: "Este campo es requerido" })
    .min(1, { message: "Error" }),
  genericName: z.string().optional(),
  drugId: z.string(),
});

export const prescriptionDetailSchema = z.object({
  details: z.array(detailSchema),
});

export type detail = z.infer<typeof detailSchema>;
export type tPrescriptionDetail = z.infer<typeof prescriptionDetailSchema>;

export type drugSearch = {
  id: string;
  tradeName: string;
  genericName: string | null;
  presentations: string[];
};
