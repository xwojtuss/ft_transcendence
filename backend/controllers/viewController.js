import path from "path";
import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

const allowedNames = new Set(["test", "home", ""]);

export async function getView(name) {
    if (allowedNames.has(name) === false)
        return [StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND];
    if (name === "")
        name = "home";
    const viewPath = path.join(process.cwd(), `backend/views/${name}.html`);
    try {
        const view = await fs.readFile(viewPath, "utf-8");
        return [StatusCodes.OK, view];
    } catch (error) {
        return [StatusCodes.INTERNAL_SERVER_ERROR, StatusCodes.INTERNAL_SERVER_ERROR];
    }
}
