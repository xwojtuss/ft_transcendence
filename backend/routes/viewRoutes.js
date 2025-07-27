import { fastify } from "fastify";
import { getView } from "../controllers/viewController.js";

export default async function viewsRoutes(fastify) {
    fastify.get("/api/view/:name", async (request, reply) => {
        const nameParam = request.params.name;
        const [statusCode, result] = await getView(nameParam);
        
        if (statusCode == 200)
            return reply.type('text/html').send(result);
        else
            return reply.code(statusCode).send({ error: result });
    })
}