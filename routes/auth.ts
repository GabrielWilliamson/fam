import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { authVariables } from "../types/auth";
import { loginSchema, verifySchema } from "../schemas/authSchema";
import { db } from "../db/db";
import bcrypt from "bcryptjs";
import { setCookie, deleteCookie } from "hono/cookie";
import { Users } from "../db/schemas";
import { type userReturning } from "../types/auth";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { initializeLucia } from "../auth/lucia";

dotenv.config();



export const authRoute = new Hono<{ Variables: authVariables }>()
  // Ruta de inicio de sesión
  .post("/", zValidator("json", loginSchema), async (c) => {
    const data = c.req.valid("json");

    const user = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (!user) {
      return c.json({
        success: false,
        error: "Credenciales incorrectas",
      });
    }

    if (!user.emailVerifiedAt) {
      return c.json({
        success: false,
        error: "Verificación de correo pendiente",
      });
    }

    if (!user.status) {
      return c.json({ success: false, error: "Acceso denegado" });
    }

    const passwordsMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordsMatch) {
      return c.json({ success: false, error: "Credenciales incorrectas" });
    }

    if (!initializeLucia) {
      return c.json({ success: false, error: "Error de inicialización" });
    }

    const lucia = initializeLucia();
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    setCookie(
      c,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    return c.json({ success: true, error: "" });
  })

  // Ruta para verificar el usuario
  .get("/verify", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false }, 401);

    const userFind = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.id, user.id),
      with: {
        doctor: {
          columns: {
            specialtie: true,
            id: true,
          },
        },
        assistant: {
          columns: {
            id: true,
          },
        },
      },
    });

    if (!userFind) return c.json({ success: false }, 401);

    const data: userReturning = {
      id: userFind.id,
      name: userFind.name,
      email: userFind.email,
      role: userFind.role,
      doctor: userFind.doctor
        ? { id: userFind.doctor.id, specialtie: userFind.doctor.specialtie }
        : null,
      assistant: userFind.assistant ? { id: userFind.assistant.id } : null,
    };

    return c.json({ success: true, data });
  })

  // Ruta para cerrar sesión
  .get("/logout", async (c) => {
    const session = c.get("session");
    if (!session) return c.json({ success: false }, 401);

    if (!initializeLucia) {
      return c.json({ success: false, error: "Error de inicialización" });
    }

    const lucia = initializeLucia();
    lucia.invalidateSession(session.id);
    deleteCookie(c, lucia.sessionCookieName);
    return c.json({ success: true });
  })

  // Ruta para verificar el email
  .post("/verifyEmail", zValidator("json", verifySchema), async (c) => {
    const data = c.req.valid("json");

    const user = await db.query.Users.findFirst({
      where: (users, { eq }) => eq(users.email, data.email),
    });

    if (!user) return c.json({ error: "Ocurrio un error", success: false });
    if (user.emailVerifToken === null)
      return c.json({
        error: "Tu email ya ha sido verificado",
        success: false,
      });
    if (data.token !== user.emailVerifToken) {
      return c.json({ error: "Ocurrio un error", success: false });
    }

    await db.update(Users).set({
      emailVerifiedAt: new Date(),
      emailVerifToken: null,
    });

    return c.json({ success: true, error: "" });
  })

  //auth whatsapp service

  .get("/whatsapp", async (c) => {
    const session = c.get("session");
    if (!session) return c.json({ success: false, data: null }, 401);
    const secretKey = process.env.JWT_SECRET!;
    const token = jwt.sign({ data: session }, secretKey);
    return c.json({ data: token });
  });
