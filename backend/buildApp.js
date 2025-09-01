import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import loginRoute, { logoutRoute, refreshRoute, registerRoute, TFARoute, updateRoute } from "./routes/authRoutes.js";
import multipart from "@fastify/multipart";
import avatarRoute from "./routes/protectedFilesRoutes.js";
import fs from "fs";
import { friendsRoutes } from "./routes/friendsRoutes.js";
import { initDb } from "./db/dbInit.js";
import * as Cheerio from 'cheerio';
import deleteDatabase from "./db/dbDev.js";

export const cheerio = Cheerio;

export let db = process.env.NODE_ENV === 'test' ? await initDb(":memory:") : await initDb("database.sqlite");

export default function buildApp(logger) {
    const keySSL = fs.readFileSync("./secrets/ft_transcendence.key");
    const certSSL = fs.readFileSync("./secrets/ft_transcendence.crt");

    // setup fastify and use the console logger
    const fastify = Fastify({
        logger: logger,
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
    
    return fastify;
}

export async function clearTestDatabase() {
    await deleteDatabase(":memory:");
    db = await initDb(":memory:");
}