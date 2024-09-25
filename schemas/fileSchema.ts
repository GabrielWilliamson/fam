import z from "zod";

export const infectoSchema = z.object({
  infecto: z
    .array(z.string())
    .min(1, "Debes seleccionar al menos una enfermedad")
    .max(10, "No puedes seleccionar mas de 10 enfermedades"),
});

export const hereditarySchema = z.object({
  hereditary: z
    .array(z.string())
    .min(1, "Debes seleccionar al menos una enfermedad")
    .max(10, "No puedes seleccionar mas de 10 enfermedades"),
});

//pediatric
export const prenatalesSchema = z.object({
  gesta: z.string().max(300, "error").nullable().optional(),
  para: z.string().max(300, "error").nullable().optional(),
  aborto: z.string().max(300, "error").nullable().optional(),
  cesarea: z.string().max(300, "error").nullable().optional(),
  fum: z.string().max(300, "error").nullable().optional(),
  abortosInfo: z.string().max(300, "error").nullable().optional(),
  cesareaMotivos: z.string().max(300, "error").nullable().optional(),
  cesareaLugar: z.string().max(300, "error").nullable().optional(),
  cpnInfo: z.string().max(300, "error").nullable().optional(),
  enfermedadesPrevias: z.string().max(300, "error").nullable().optional(),
  enfermedadesEmbarazo: z.string().max(300, "error").nullable().optional(),
  medicacionEmbarazo: z.string().max(300, "error").nullable().optional(),
  hospitalizaciones: z.string().max(300, "error").nullable().optional(),
});

export const partoSchema = z.object({
  lugarAtencionParto: z.string({ required_error: "Este campo es requerido" }),
  horaNacimiento: z.date({ required_error: "Este campo es requerido" }),
  duracionParto: z.string({ required_error: "Este campo es requerido" }),
  edadGestacional: z
    .number({ required_error: "Este campo es requerido" })
    .min(22, "La edad gestacional debe ser al menos 22 semanas")
    .max(42, "La edad gestacional no puede exceder 42 semanas"),
  atencionParto: z.string({ required_error: "Este campo es requerido" }),
  viaParto: z.enum(["Vaginal", "Cesárea"], {
    errorMap: () => ({
      message: "Debe seleccionar la vía del parto (Vaginal o Cesárea)",
    }),
  }),
  presentacion: z.string().optional().nullable(),
  eventualidades: z.string().optional(),
});

export const postSchema = z
  .object({
    apgar1: z.string().min(1, "APGAR 1° es requerido"),
    apgar5: z.string().min(1, "APGAR 5° es requerido"),
    peso: z.string().min(1, "Peso es requerido"),
    talla: z.string().min(1, "Talla es requerida"),
    asfixia: z.boolean(),
    asfixiaEspecifique: z.string().optional().nullable(),
    alojamientoConjunto: z.boolean(),
    tiempoJuntoMadre: z.enum(["Permanente", "Transitorio"]).optional(),
    horasJuntoMadre: z.string().optional(),
    hospitalizacion: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.asfixia && !data.asfixiaEspecifique) {
        return false;
      }
      return true;
    },
    {
      message: "Si asfixia es true, debe especificar",
      path: ["asfixiaEspecifique"],
    },
  )
  .refine(
    (data) => {
      if (data.alojamientoConjunto && !data.tiempoJuntoMadre) {
        return false;
      }
      return true;
    },
    {
      message:
        "Si alojamiento conjunto es true, debe especificar el tiempo junto a la madre",
      path: ["tiempoJuntoMadre"],
    },
  )
  .refine(
    (data) => {
      if (data.tiempoJuntoMadre === "Transitorio" && !data.horasJuntoMadre) {
        return false;
      }
      return true;
    },
    {
      message:
        "Si el tiempo junto a la madre es Transitorio, debe especificar las horas",
      path: ["horasJuntoMadre"],
    },
  );

export const fedingSchema = z.object({
  exclusiveBreastfeeding: z.boolean({
    required_error: "Este campo es requerido",
  }),
  mixedFeeding: z.boolean({ required_error: "Este campo es requerido" }),
  exclusiveBreastfeedingDuration: z.string().optional(),
  mixedFeedingDuration: z.string().optional(),
  weaning: z.string().optional(),
});

export const psicoSchema = z.object({
  fixedGaze: z.boolean().optional(),
  fixedGazeAge: z.number().int().min(0).optional(),
  heldHeadUp: z.boolean().optional(),
  heldHeadUpAge: z.number().int().min(0).optional(),
  smiled: z.boolean().optional(),
  smiledAge: z.number().int().min(0).optional(),
  satUp: z.boolean().optional(),
  satUpAge: z.number().int().min(0).optional(),
  crawled: z.boolean().optional(),
  crawledAge: z.number().int().min(0).optional(),
  walked: z.boolean().optional(),
  walkedAge: z.number().int().min(0).optional(),
  projected: z.boolean().optional(),
  projectedAge: z.number().int().min(0).optional(),
});

export const extendedPsicoSchema = psicoSchema.superRefine((data, ctx) => {
  const fields = [
    "fixedGaze",
    "heldHeadUp",
    "smiled",
    "satUp",
    "crawled",
    "walked",
    "projected",
  ];

  fields.forEach((field) => {
    if (
      data[field as keyof typeof data] === true &&
      data[`${field}Age` as keyof typeof data] === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Por favor, complete la edad`,
        path: [`${field}Age`],
      });
    }
  });
});

export const appSchema = z.object({
  infections: z.string().optional(),
  chronicDiseases: z.string().optional(),
  surgeries: z.string().optional(),
  hospitalizations: z.string().optional(),
  others: z.string().optional(),
});

export type app = z.infer<typeof appSchema>;
export type psico = z.infer<typeof psicoSchema>;
export type feeding = z.infer<typeof fedingSchema>;
export type tPost = z.infer<typeof postSchema>;
export type tParto = z.infer<typeof partoSchema>;
export type tPrenatales = z.infer<typeof prenatalesSchema>;

export type tInfecto = z.infer<typeof infectoSchema>;
export type tHereditary = z.infer<typeof hereditarySchema>;
