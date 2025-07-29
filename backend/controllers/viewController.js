import path from "path";
import fs from "fs/promises";

const allowedNames = new Set(["test", "home", ""]);

export async function getView(name) {
    if (allowedNames.has(name) === false)
        return [404, "Page does not exist"];
    console.log(name);
    if (name === "")
        name = "home";
    const viewPath = path.join(process.cwd(), `backend/views/${name}.html`);
    try {
        const view = await fs.readFile(viewPath, "utf-8");
        return [200, view];
    } catch (error) {
        return [500, "Failed to load page"];
    }
}