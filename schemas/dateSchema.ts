import { z } from "zod";

const searchPatient = z.object({
  id: z.string(),
  fileId: z.string(),
  name: z.string(),
});

export const dateSchema = z
  .object({
    date: z.date({ required_error: "Este campo es requerido" }),
    start: z.string({ required_error: "Este campo es requerido" }).time(),
    end: z.string({ required_error: "Este campo es requerido" }).time(),
    patient: searchPatient,
  })
  .refine(
    (data) => {
      // HORA DE INICIO
      const { start, date } = data;
      const startDate = new Date(date);
      const [startHour, startMinute, startSecond] = start.split(":");
      startDate.setHours(
        parseInt(startHour),
        parseInt(startMinute),
        parseInt(startSecond)
      );
      const currentDate = new Date();
      return startDate >= currentDate;
    },
    {
      message: "Hora incorrecta",
      path: ["start"],
    }
  )
  .refine(
    (data) => {
      // HORA DE FINALIZACIÓN
      const { start, end, date } = data;
      const endDate = new Date(date);
      const [endHour, endMinute, endSecond] = end.split(":");
      endDate.setHours(
        parseInt(endHour),
        parseInt(endMinute),
        parseInt(endSecond)
      );
      const currentDate = new Date();
      return endDate >= currentDate;
    },
    {
      message: "Hora incorrecta",
      path: ["end"],
    }
  )
  .refine(
    (data) => {
      const { start, end } = data;
      const [startHour, startMinute, startSecond] = start.split(":");
      const timeStart = new Date();
      timeStart.setHours(
        parseInt(startHour),
        parseInt(startMinute),
        parseInt(startSecond)
      );

      const [endHour, endMinute, endSecond] = end.split(":");
      const timeEnd = new Date();
      timeEnd.setHours(
        parseInt(endHour),
        parseInt(endMinute),
        parseInt(endSecond)
      );

      // Validar que la hora de inicio sea menor que la hora de final
      return timeStart < timeEnd;
    },
    {
      message: "Horarios incorrectos",
      path: ["end"],
    }
  )
  .refine(
    (data) => {
      //VALIDAR  FECHA
      const { date } = data;

      const { start, end } = data;
      const [startHour, startMinute, startSecond] = start.split(":");

      date.setHours(
        parseInt(startHour),
        parseInt(startMinute),
        parseInt(startSecond)
      );
      const today = new Date();

      return date > today;
    },
    {
      message: "Fecha incorrecta",
      path: ["date"],
    }
  )
  .refine(
    (data) => {
      const { start, end } = data;
      const [startHour, startMinute, startSecond] = start.split(":");
      const timeStart = new Date();
      timeStart.setHours(
        parseInt(startHour),
        parseInt(startMinute),
        parseInt(startSecond)
      );

      const [endHour, endMinute, endSecond] = end.split(":");
      const timeEnd = new Date();
      timeEnd.setHours(
        parseInt(endHour),
        parseInt(endMinute),
        parseInt(endSecond)
      );

      // Validar que la duración esté entre 30 y 120 minutos
      const timeDiff = timeEnd.getTime() - timeStart.getTime();
      const minDiff = Math.round(timeDiff / 1000 / 60);
      return minDiff >= 30 && minDiff <= 120;
    },
    {
      message: "La duración debe ser de entre 30 y 120 minutos",
      path: ["end"],
    }
  )
  .refine(
    (data) => {
      const { start } = data;
      const [startHour, startMinute, startSecond] = start.split(":");
      const timeStart = new Date();
      timeStart.setHours(
        parseInt(startHour),
        parseInt(startMinute),
        parseInt(startSecond)
      );

      const currentDate = new Date();
      currentDate.setHours(6);

      const endCurrentDate = new Date();
      endCurrentDate.setHours(18);
      endCurrentDate.setMinutes(30);

      return timeStart >= currentDate && timeStart <= endCurrentDate;
    },
    {
      message: "6:00 AM - 6:30 PM",
      path: ["start"],
    }
  )
  .refine(
    (data) => {
      const { end } = data;
      const [endHour, endMinute, endSecond] = end.split(":");
      const timeEnd = new Date();
      timeEnd.setHours(
        parseInt(endHour),
        parseInt(endMinute),
        parseInt(endSecond)
      );

      const currentDate = new Date();
      currentDate.setHours(6);
      currentDate.setMinutes(30);

      const endCurrentDate = new Date();
      endCurrentDate.setHours(19);
      endCurrentDate.setMinutes(0);

      return timeEnd >= currentDate && timeEnd <= endCurrentDate;
    },
    {
      message: "6:30 AM - 7:00 PM",
      path: ["end"],
    }
  );

export type dateType = z.infer<typeof dateSchema>;
