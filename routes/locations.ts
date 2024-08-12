import type { authVariables } from "../types/auth";
import { Hono } from "hono";
import { countries } from "../lib/countries";
import { departmentsFull } from "../lib/locations";

//autenticar esto
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
  })

  .get("/find/:code", async (c) => {
    const code = c.req.param("code");

    if (code === null || code === undefined)
      return c.json({
        department: null,
        municipality: null,
      });

    for (const department of departmentsFull) {
      const foundMunicipality = department.municipalities.find(
        (municipality) => municipality.code === code
      );

      if (foundMunicipality) {
        return c.json({
          department: department.name,
          municipality: foundMunicipality,
        });
      }
    }

    return c.json({
      department: null,
      municipality: null,
    });
  });
