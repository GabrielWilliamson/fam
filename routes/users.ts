import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import CryptoHasher from "bun";
import { db } from "../db/db";
import { eq, sql } from "drizzle-orm";
import { changeSchema, userSchema } from "../schemas/usersSchema";
import hashPassword from "../lib/hash";
import { sendVerificationEmail } from "../lib/email";
import { Users, Doctors, Assistants } from "../db/schemas";
import type { usersTable } from "../types/users";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateEmailVerificationToken } from "../lib/hash";
import { join, extname } from "path";
import { existsSync } from "fs";
import { unlink } from "node:fs/promises";

const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const fileSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      {
        message: "El archivo debe ser una imagen JPEG, PNG o WebP",
      },
    )
    .refine((file) => file.size <= 1024 * 1024 * 3, {
      message: "El archivo no debe superar los 3MB",
    }),
});

const name = z.object({ name: userSchema.shape.name });
const email = z.object({ email: userSchema.shape.email });
const password = z
  .object({
    old: userSchema.shape.password,
    new: userSchema.shape.password,
    confirmPass: userSchema.shape.password,
  })
  .refine((data) => data.new === data.confirmPass, {
    message: "Las claves no coinciden",
    path: ["confirmPass"],
  })
  .refine((data) => data.old != data.new, {
    message: "La clave nueva no puede ser igual a la actual",
    path: ["new"],
  });

type PaginatedResponse = {
  success: boolean;
  error: string;
  data: usersTable[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export const usersRoute = new Hono<{ Variables: authVariables }>()

  .post("/register", zValidator("json", userSchema), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false, error: "No autorizado" }, 401);
    if (myuser.role !== "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const data = c.req.valid("json");

    try {
      const isEmailExists = await db
        .select()
        .from(Users)
        .where(eq(Users.email, data.email));

      if (isEmailExists.length > 0)
        return c.json({ success: false, error: "Este email ya existe" });

      const hashed = await hashPassword(data.password);
      const verificationToken = generateEmailVerificationToken();

      const user = await db
        .insert(Users)
        .values({
          name: data.name,
          role: data.rol,
          email: data.email,
          password: hashed,
          emailVerifToken: verificationToken,
        })
        .returning({ role: Users.role, id: Users.id, email: Users.email });

      if (user[0].role === "DOCTOR") {
        //add diasses

        const hereditary = [
          "alergias",
          "diabetes mellitus",
          "hipertensión arterial",
          "enfermedad reumática",
          "enfermedades renales",
          "enfermedades oculares",
          "enfermedades cardiacas",
          "enfermedad hepática",
          "enfermedades musculares",
          "malformaciones congénitas",
          "desórdenes mentales",
          "enfermedades degenerativas del sistema nervioso central",
          "anomalías del crecimiento y desarrollo",
          "errores innatos del metabolismo",
        ];

        const infecto = [
          "hepatitis",
          "sífilis",
          "tb",
          "cólera",
          "amebiasis",
          "tosferina",
          "sarampión",
          "varicela",
          "rubeola",
          "parotiditis",
          "meningitis",
          "impétigo",
          "fiebre tifoidea",
          "escarlatina",
          "malaria",
          "escabiosis",
          "pediculosis",
          "tiña",
        ];

        const re = await db
          .insert(Doctors)
          .values({
            userId: user[0].id,
            rate: 36,
            hereditary: hereditary,
            infecto: infecto,
          })
          .returning({ id: Doctors.id });
      }

      //create bucket

      if (user[0].role === "ASSISTANT") {
        await db.insert(Assistants).values({
          userId: user[0].id,
        });
      }

      try {
        await sendVerificationEmail(user[0].email, verificationToken);
      } catch (e) {
        console.log("Error al enviar el email");
        return c.json({
          success: false,
          error:
            "Ocurrió un error al enviar el email, solicite ayuda al administrador",
        });
      }

      return c.json({ success: true, error: "Usuario Creado Correctamente" });
    } catch (error) {
      console.log("Error al registrar el usuario");
      return c.json({ success: false, error: "Error al registrar el usuario" });
    }
  })

  .get("/", async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ data: null }, 401);
    if (myuser.role !== "ADMIN") return c.json({ data: null }, 401);

    const page = parseInt(c.req.query("page") || "1");
    const pageSize = parseInt(c.req.query("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    const [list, total] = await Promise.all([
      db.select().from(Users).offset(offset).limit(pageSize),
      db.select({ count: sql<number>`cast(count(*) as integer)` }).from(Users),
    ]);

    const totalCount = total[0].count;

    const response: PaginatedResponse = {
      success: true,
      error: "",
      data: list as usersTable[],
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };

    return c.json({ data: response });
  })

  .patch("/change", zValidator("json", changeSchema), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false, error: "No autorizado" }, 401);
    if (myuser.role !== "ADMIN")
      return c.json({ success: false, error: "No autorizado" }, 401);

    const data = c.req.valid("json");

    try {
      const user = await db.query.Users.findFirst({
        where: eq(Users.id, data.id),
      });

      if (!user)
        return c.json({ success: false, error: "Usuario no encontrado" }, 401);

      if (user?.role === "ADMIN") {
        return c.json({
          success: false,
          error:
            "No se puede bloquear un usuario con permisos de administrador",
        });
      }

      await db
        .update(Users)
        .set({ status: data.status })
        .where(eq(Users.id, data.id));

      return c.json({ success: true, error: "" });
    } catch (e) {
      console.log(e);
      return c.json({ success: false, error: "Ocurrió un error" });
    }
  })

  .patch("/name", zValidator("json", name), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false }, 401);
    const data = c.req.valid("json");
    await db
      .update(Users)
      .set({ name: data.name })
      .where(eq(Users.id, myuser.id));
    return c.json({ success: true });
  })

  .patch("/email", zValidator("json", email), async (c) => {
    const myuser = c.get("user");
    if (!myuser) return c.json({ success: false }, 401);
    const data = c.req.valid("json");

    const verificationToken = generateEmailVerificationToken();
    await db
      .update(Users)
      .set({
        email: data.email,
        emailVerifiedAt: null,
        emailVerifToken: verificationToken,
      })
      .where(eq(Users.id, myuser.id));

    try {
      await sendVerificationEmail(data.email, verificationToken);
    } catch (e) {
      return c.json({
        success: false,
        error:
          "Ocurrió un error al enviar el email, solicite ayuda al administrador",
      });
    }
    return c.json({ success: true });
  })

  .patch("/pass", zValidator("json", password), async (c) => {
    const myuser = c.get("user");
    if (!myuser)
      return c.json({ success: false, error: "No autenticado" }, 401);
    const data = c.req.valid("json");

    const user = await db
      .select({ password: Users.password })
      .from(Users)
      .where(eq(Users.id, myuser.id));

    const passwordsMatch = await bcrypt.compare(data.old, user[0].password);
    if (!passwordsMatch) {
      return c.json({ success: false, error: "old error" });
    }

    const hashed = await hashPassword(data.new);

    await db
      .update(Users)
      .set({ password: hashed })
      .where(eq(Users.id, myuser.id));

    return c.json({ success: true, error: null });
  })

  .post("/picture", zValidator("form", fileSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, error: "unauthorized" }, 401);

    try {
      const { file } = c.req.valid("form");

      const picturesDir = join(process.cwd(), "pictures"); // Usa una ruta absoluta para el directorio de imágenes

      // Borrar la imagen anterior solo si existe
      if (user.image !== null) {
        const previousImagePath = join(picturesDir, user.image); // Ruta absoluta de la imagen anterior
        try {
          await unlink(previousImagePath);
        } catch (error) {
          console.error("Error al eliminar la imagen anterior:", error);
        }
      }

      const extension = file.name.split(".").pop();
      const name = CryptoHasher.hash(file.name, 32).toString();
      const fileName = `${name}.${extension}`;

      // Guarda (o sobrescribe) el archivo en la carpeta 'pictures'
      const filePath = join(picturesDir, fileName); // Ruta absoluta para guardar el archivo
      await Bun.write(filePath, await file.arrayBuffer());

      // Actualizar la imagen en la base de datos
      await db
        .update(Users)
        .set({ image: fileName })
        .where(eq(Users.id, user.id));

      return c.json({ success: true, error: "" });
    } catch (error) {
      console.error("Error al guardar el archivo:", error);
      return c.json(
        { success: false, error: "Error al procesar el archivo" },
        500,
      );
    }
  })

  .get("/pictures", async (c) => {
    const user = c.get("user");

    if (user === null)
      return c.json({ success: false, error: "No autorizado" }, 401);

    if (user.image === null || user.image === "") {
      return c.json({ success: true, error: "No imagen cargada" }, 200);
    }

    const filePath = join(__dirname, `../pictures/${user.image}`);

    // Validate file extension
    const fileExtension = extname(user.image).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return c.text("Invalid file type", 400);
    }

    // Validate that the file is within the pictures directory
    const normalizedPath = join(filePath);
    const picturesDir = join(__dirname, "../pictures");
    if (!normalizedPath.startsWith(picturesDir)) {
      return c.text("Access denied", 403);
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return c.text("File not found", 404);
    }

    // Serve the file
    const file = Bun.file(filePath);
    return new Response(file);
  });
