import { initDb } from "./db/dbInit.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import * as Cheerio from 'cheerio';
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import loginRoute, { refreshRoute, registerRoute } from "./routes/authRoutes.js";
import fs from "fs";

let httpsSecrets = undefined;
let keySSL;
let certSSL;

try {
    if (fs.existsSync("./secrets/ft_transcendence.key") && fs.existsSync("./secrets/ft_transcendence.crt")) {
        httpsSecrets = {
            key: fs.readFileSync("./secrets/ft_transcendence.key"),
            cert: fs.readFileSync("./secrets/ft_transcendence.crt")
        };
    } else {
        console.error("SSL cert or key not found, exiting...");
        exit(1);
    }
    keySSL = fs.readFileSync("./secrets/ft_transcendence.key");
    certSSL = fs.readFileSync("./secrets/ft_transcendence.crt");
} catch (error) {
    console.error("Failed to read SSL cert or key, exiting...");
    exit(1);
}

// setup fastify and use the console logger
const fastify = Fastify({
    logger: true,
    https: {
        key: keySSL,
        cert: certSSL
    }
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
