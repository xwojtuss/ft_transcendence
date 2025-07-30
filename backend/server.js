import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import testDatabase from "./test.js";

const defaultPageName = process.env.DEFAULT_PAGE_NAME || 'index.html';

const fastify = Fastify({
    logger: true
});

fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'frontend')
});

fastify.get("/", async (req, reply) => {
    return reply.type('text/html').sendFile(defaultPageName);
});

testDatabase();

fastify.register(viewsRoutes);

fastify.setNotFoundHandler((req, reply) => {
    return reply.type('text/html').sendFile(defaultPageName);
});

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`Simple page running at ${address}`)
});
