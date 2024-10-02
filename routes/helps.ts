import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { join } from "path";
import { z } from "zod";
import doctorIdentification from "../lib/identification";
import { Doctors } from "../db/schemas";
import { eq } from "drizzle-orm/expressions";
import { db } from "../db/db";

// Definir los roles y permisos
const roleSchema = z.object({
  DOCTOR: z.enum([
    "patients",
    "upcoming",
    "general",
    "session",
    "services",
    "dates",
    "pediatric",
    "profile",
    "reset",
    "drugs",
    "sms",
  ]),
  ASSISTANT: z.enum(["patients", "profile", "reset", "sms"]),
  ADMIN: z.enum(["profile", "reset", "users", "settings"]),
});

// Validar archivo según el rol del usuario
const validateFileForRole = (
  role: "DOCTOR" | "ASSISTANT" | "ADMIN",
  name: string,
) => roleSchema.shape[role].safeParse(name).success;

// Función auxiliar para buscar un archivo
async function searchFile(name: string): Promise<string | null> {
  try {
    const filePath = join(__dirname, `../markdown/${name}.md`);
    return await Bun.file(filePath).text();
  } catch (error) {
    console.error("Error leyendo el archivo markdown:", error);
    return null;
  }
}

// Lógica principal del endpoint
export const helpsRoute = new Hono<{ Variables: authVariables }>().get(
  "/:name",
  async (c) => {
    const user = c.get("user");
    const name = c.req.param("name");

    if (!name) return c.text("No se especificó el nombre del archivo", 400);
    if (name === "forgot")
      return c.text(
        (await searchFile("forgot")) ?? "Error al buscar el archivo",
        500,
      );

    if (name === "login")
      return c.text(
        (await searchFile("login")) ?? "Error al buscar el archivo",
        500,
      );

    if (name === "reset")
      return c.text(
        (await searchFile("reset")) ?? "Error al buscar el archivo",
        500,
      );

    // Verificar si hay un usuario autenticado
    if (!user) return c.text("forbidden: no user", 403);

    // Validar archivo según el rol del usuario
    if (!validateFileForRole(user.role, name)) {
      return c.text("forbidden: file not allowed for your role", 403);
    }

    // Procesar la lógica según el nombre y rol del usuario
    const result = await handleFileRequest(name, user);

    return result
      ? c.text(result, 200)
      : c.text("Ocurrió un error al buscar el archivo", 500);
  },
);

// Función para manejar la lógica según el archivo y rol
async function handleFileRequest(
  name: string,
  user: { id: string; role: string },
) {
  if (name === "patients") {
    const doctorId = await doctorIdentification(user.id, user.role);
    if (!doctorId) return null;

    const doctor = await db.query.Doctors.findFirst({
      where: eq(Doctors.id, doctorId),
      columns: { specialtie: true },
    });

    if (!doctor) return null;

    const fileName =
      doctor.specialtie === "GENERAL"
        ? "patientsG"
        : doctor.specialtie === "PEDIATRIA"
          ? "patientsP"
          : name;

    return await searchFile(fileName);
  }

  if (name === "profile") {
    const profileFile = user.role === "DOCTOR" ? "profileD" : "profile";
    return await searchFile(profileFile);
  }

  return await searchFile(name);
}
