import { getView, getProfile } from "../controllers/viewController.js";
import getErrorPage from "../utils/error.js";
import { StatusCodes } from "http-status-codes";

async function returnView(reply, statusCode, result) {
    if (statusCode === StatusCodes.OK)
        return reply.type('text/html').send(result);
    else
        return reply.code(statusCode).type('text/html').send(await getErrorPage(statusCode, result));
}

export default async function viewsRoutes(fastify) {
    // for non-dynamic sites: login, register
    fastify.get("/api/view/:name", async (request, reply) => {
        const [statusCode, result] = await getView(request.params.name);
        return await returnView(reply, statusCode, result);
    });
    fastify.get("/api/view/profile/:login", async (request, reply) => {
        const [statusCode, result] = await getProfile(request.params.login);
        return await returnView(reply, statusCode, result);
    });
}