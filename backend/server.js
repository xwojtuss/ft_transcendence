import { initDb } from "./db/dbInit.js";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import * as Cheerio from 'cheerio';
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import loginRoute, { logoutRoute, refreshRoute, registerRoute, TFARoute, updateRoute } from "./routes/authRoutes.js";
import multipart from "@fastify/multipart";
import avatarRoute from "./routes/protectedFilesRoutes.js";
import { runSecretsTest } from "./test.js";
import fs from "fs";
import { friendsRoutes } from "./routes/friendsRoutes.js";

runSecretsTest();

const keySSL = fs.readFileSync("./secrets/ft_transcendence.key");
const certSSL = fs.readFileSync("./secrets/ft_transcendence.crt");

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

fastify.register(multipart, {
    limits: {
        fieldNameSize: 100, // Max field name size in bytes
        fieldSize: 100,     // Max field value size in bytes
        fields: 10,         // Max number of non-file fields
        fileSize: 5242880,  // For multipart forms, the max file size in bytes
        files: 1,           // Max number of file fields
        headerPairs: 2000,  // Max number of header key=>value pairs
        parts: 1000         // For multipart forms, the max number of parts (fields + files)
  }
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
fastify.register(logoutRoute);
fastify.register(updateRoute);
fastify.register(TFARoute);
fastify.register(avatarRoute);
fastify.register(viewsRoutes);
fastify.register(friendsRoutes);

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`ft_transcendence running at ${address}`)
});
