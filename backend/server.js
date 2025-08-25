import { initDb } from "./db/dbInit.js";
import deleteDatabase from "./db/dbDev.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import websocket from '@fastify/websocket';
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import testDatabase from "./test.js";
import * as Cheerio from 'cheerio';
import { getView } from "./controllers/viewController.js";
import { handleConnection, startLocalGameLoop } from './game/local/localGameServer.js';

const defaultPageName = process.env.DEFAULT_PAGE_NAME || 'index.html';

await deleteDatabase("test.sqlite");
export const db = await initDb("test.sqlite");
export const cheerio = Cheerio;

const fastify = Fastify({
    logger: true
});

await fastify.register(websocket);

fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'frontend')
});

fastify.get("/", async (req, reply) => {
    return reply.type('text/html').sendFile(defaultPageName);
});

testDatabase(db);

fastify.register(viewsRoutes);

// Game WebSocket endpoint
fastify.get('/ws/localGame', { websocket: true }, handleConnection);

// Start game loop
startLocalGameLoop();

fastify.setNotFoundHandler((req, reply) => {
    return reply.type('text/html').sendFile(defaultPageName);
});

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`ft_transcendence running at ${address}`)
});
