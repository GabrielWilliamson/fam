import { Hono } from "hono";
import type { authVariables } from "../types/auth";

export const assistantRoute = new Hono<{ Variables: authVariables }>().get("/mydoctors", (c) => {
  return c.json({ hello: "esto deberia ser prohibitado" });
});
