import type { authVariables } from "../types/auth";
import { Hono } from "hono";
import type { option } from "../types/controls";
import { countries } from "../lib/countries";
import { departmentsFull } from "../lib/locations";

export const locationsRoute = new Hono<{ Variables: authVariables }>()

  .get("/countries", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ success: false, countries: [] }, 401);
    if (user.role === "ADMIN")
      return c.json({ success: false, countries: [] }, 401);
    const query = c.req.query("q");
    if (!query) return c.json({ success: false, countries: [] });
    const q = query.toLowerCase();
    const result = countries.filter((x) => x.country.toLowerCase().includes(q));
    return c.json({ success: true, countries: result });
  })

  .get("/municipalities", async (c) => {
    const department = c.req.query("department");
    if (!department) return c.json([]);

    const foundDepartment = departmentsFull.find(
      (dep) => dep.name.toLowerCase() === department.toLowerCase()
    );
    if (!foundDepartment) return c.json([]);

    const municipalities = foundDepartment.municipalities;
    return c.json(municipalities || []);
  });
