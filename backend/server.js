import { initDb } from "./db/dbInit.js";
import deleteDatabase from "./db/dbDev.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import testDatabase from "./test.js";
import * as Cheerio from 'cheerio';
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import loginRoute, { refreshRoute, registerRoute } from "./routes/authRoutes.js";

// setup fastify and use the console logger
const fastify = Fastify({
    logger: true
});

fastify.register(fastifyJwt, {
    secret: process.env.ACCESS_TOKEN_SECRET
});

fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET,
    parseOptions: {}
});

// await deleteDatabase("database.sqlite");
export const db = await initDb("database.sqlite");
export const cheerio = Cheerio;

fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'frontend')
});

if (process.env.IS_PRODUCTION !== 'true')
    testDatabase();// TEMP delete on PROD

// register the server routes
fastify.register(loginRoute);
fastify.register(registerRoute);
fastify.register(refreshRoute);
fastify.register(viewsRoutes);

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`ft_transcendence running at ${address}`)
});
