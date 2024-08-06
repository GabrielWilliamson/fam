import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import moment from "moment-timezone";

export const assistantRoute = new Hono<{ Variables: authVariables }>().get(
  "/test",
  (c) => {



    const today = moment.tz("America/Managua");
    const todayUTC = today.utc().format();

  
    
    return c.json({ hello: "esto deberia ser prohibitado" });
  }
);
