import { fastify } from "fastify";
import { getView } from "../controllers/viewController.js";
import getErrorPage from "../utils/error.js";
import { StatusCodes } from "http-status-codes";

export default async function viewsRoutes(fastify) {
    fastify.get("/api/view/:name", async (request, reply) => {
        const nameParam = request.params.name;
        const [statusCode, result] = await getView(nameParam);
        
        if (statusCode === StatusCodes.OK)
            return reply.type('text/html').send(result);
        else
            return reply.code(statusCode).type('text/html').send(await getErrorPage(statusCode));
    })
}