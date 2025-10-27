import Fastify from "fastify";
import fastifyStatic from "@fastify/static"
import path from "path";
import viewsRoutes from "./routes/viewRoutes.js";
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import avatarRoute from "./routes/protectedFilesRoutes.js";
import fs from "fs";
import { friendsRoutes } from "./routes/friendsRoutes.js";
import { initDb } from "./db/dbInit.js";
import * as Cheerio from 'cheerio';
import deleteDatabase from "./db/dbDev.js";
import authRoutes from "./routes/authRoutes.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import fastifyWebsocket from "@fastify/websocket";
import wsRoutes from "./routes/wsRoutes.js";
import tournamentRoutes from "./routes/tournamentRoutes.js";  //^^^^^ TRDM ^^^^^
import gameRoutes from "./routes/gameRoutes.js";
import { startLocalGameLoop } from "./controllers/ws/game/local/localGameServer.js";
import { startRemoteGameLoop } from "./controllers/ws/game/remote/remoteGameServer.js";
import { cleanupInactiveSessions } from "./controllers/ws/game/local/sessionManager.js";

export const cheerio = Cheerio;

// await deleteDatabase("database.sqlite");
export let db = await initDb(process.env.NODE_ENV === 'test' ? ":memory:" : "database.sqlite");

export default function buildApp(logger) {
    const keySSL = fs.readFileSync("./secrets/ft_transcendence.key");
    const certSSL = fs.readFileSync("./secrets/ft_transcendence.crt");

    // setup fastify and use the console logger
    const fastify = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            file: process.env.LOG_FILE || path.join(defaultLogDir, "ft_transcendence.jsonl"),
        },
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

    fastify.register(fastifyWebsocket);

    // register the server routes
    fastify.register(authRoutes);
    fastify.register(avatarRoute);
    fastify.register(viewsRoutes);
    fastify.register(friendsRoutes);
    fastify.register(wsRoutes);
    fastify.register(tournamentRoutes);                           //^^^^^ TRDM ^^^^^
    fastify.register(gameRoutes);
    
    fastify.setErrorHandler((error, request, reply) => {
        fastify.log.error(error);
        reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
    });

    if (process.env.NODE_ENV !== 'test') {
        startLocalGameLoop();
        startRemoteGameLoop();
        setInterval(cleanupInactiveSessions, 10 * 1000);
    }

    return fastify;
}

export async function clearTestDatabase() {
    await deleteDatabase(":memory:");
    db = await initDb(":memory:");
}