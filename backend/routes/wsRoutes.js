import { handleConnection } from "../controllers/ws/game/local/localGameServer.js";
import { handleRemoteConnection } from '../controllers/ws/game/remote/remoteGameServer.js';
import updateOnlineStatus from "../controllers/ws/updateStatus.js";

async function wsErrorHandler(error, socket, request) {
    console.error(error);
    return socket.send(error.message);
}

export default async function wsRoutes(fastify) {
    fastify.setErrorHandler(wsErrorHandler);
    fastify.get("/ws/status", { websocket: true }, updateOnlineStatus);
    fastify.get("/ws/localGame", { websocket: true }, handleConnection);
    fastify.get("/ws/remoteGame", { websocket: true }, handleRemoteConnection);
}