import { Hono } from "hono";
import type { authVariables } from "../types/auth";
import { join } from "path";

export const helpsRoute = new Hono<{ Variables: authVariables }>()
  //helps
  .get("/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const datesFilePath = join(__dirname, `../markdown/${name}.md`);

      const fileContents = await Bun.file(datesFilePath).text();

      return c.text(fileContents, 200);
    } catch (error) {
      console.error("Error reading markdown file:", error);
      return c.text("Error loading dates file", 500);
    }
  });
