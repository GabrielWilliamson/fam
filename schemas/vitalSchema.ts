import { z } from "zod";

import { z } from "zod";

export const vitalsSchema = z.object({
  FC: z
    .number()
    .int()
    .min(30, { message: "La frecuencia cardíaca mínima es 30" })
    .max(220, { message: "La frecuencia cardíaca máxima es 220" })
    .nullable()
    .optional(),
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
    .min(10, { message: "La frecuencia respiratoria mínima es 10" })
    .max(60, { message: "La frecuencia respiratoria máxima es 60" })
    .nullable()
    .optional(),
  T: z
    .number()
    .min(30, { message: "La temperatura mínima es 30°C" })
    .max(45, { message: "La temperatura máxima es 45°C" })
    .nullable()
    .optional(),
  PA: z
    .object({
      a: z
        .number()
        .min(10, { message: "La presión sistólica mínima es 10" })
        .max(300, { message: "La presión sistólica máxima es 300" })
        .nullable()
        .optional(),
      b: z
        .number()
        .min(10, { message: "La presión diastólica mínima es 10" })
        .max(300, { message: "La presión diastólica máxima es 300" })
        .nullable()
        .optional(),
    })
    .superRefine((data, ctx) => {
      const { a, b } = data;

      if (a !== null && a !== undefined && (b === null || b === undefined)) {
        ctx.addIssue({
          path: ["b"],
          code: z.ZodIssueCode.custom,
          message:
            "La presión diastólica es obligatoria si se proporciona la sistólica.",
        });
      }

      if (b !== null && b !== undefined && (a === null || a === undefined)) {
        ctx.addIssue({
          path: ["a"],
          code: z.ZodIssueCode.custom,
          message:
            "La presión sistólica es obligatoria si se proporciona la diastólica.",
        });
      }
    })
    .nullable()
    .optional(),
});

export type vitals = z.infer<typeof vitalsSchema>;
export const antropometricsSchema = z.object({
  // Índice de Masa Corporal (IMC)
  IMC: z.number().nullable().optional(),

  // Peso
  W: z
    .number()
    .min(1, "El peso mínimo es 1 kg")
    .max(300, "El peso máximo es 300 kg")
    .nullable()
    .optional(),

  // Talla (Altura)
  TL: z
    .number()
    .min(30, { message: "La talla mínima es 30 cm" })
    .max(300, { message: "La talla máxima es 300 cm" }) // Para adultos
    .nullable()
    .optional(),

  // Perímetro Cefálico
  PC: z
    .number()
    .min(25, { message: "El perímetro cefálico mínimo es 25 cm" }) // Para pediátricos
    .max(60, { message: "El perímetro cefálico máximo es 60 cm" }) // Para adultos
    .nullable()
    .optional(),

  // Perímetro Abdominal
  PRA: z
    .number()
    .min(40, { message: "El perímetro abdominal mínimo es 40 cm" }) // Para pediátricos
    .max(150, { message: "El perímetro abdominal máximo es 150 cm" }) // Para adultos
    .nullable()
    .optional(),

  // Área Superficial Corporal (ASC)
  ASC: z
    .number()
    .min(0.5, { message: "El área superficial corporal mínima es 0.5 m²" }) // Para pediátricos
    .max(3.0, { message: "El área superficial corporal máxima es 3.0 m²" }) // Para adultos
    .nullable()
    .optional(),

  // Perímetro Torácico
  PT: z
    .number()
    .min(60, { message: "El perímetro torácico mínimo es 60 cm" }) // Para pediátricos
    .max(140, { message: "El perímetro torácico máximo es 140 cm" }) // Para adultos
    .nullable()
    .optional(),
});

export type antropometrics = z.infer<typeof antropometricsSchema>;
