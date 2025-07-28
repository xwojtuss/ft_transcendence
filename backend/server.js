import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import testDatabase from "./test.js";

const fastify = Fastify({
    logger: true
});

fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'frontend'),
    wildcard: false
});

testDatabase();

fastify.register(viewsRoutes);

fastify.get("/*", async (req, reply) => {
    return reply.type('text/html').sendFile('index.html');
});

fastify.listen({ port: process.env.PORT }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`Simple page running at ${address}`)
});
