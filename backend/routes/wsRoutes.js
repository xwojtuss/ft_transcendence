import updateOnlineStatus from "../controllers/ws/updateStatus.js";

async function wsErrorHandler(error, socket, request) {
    console.error(error);
    return socket.send(error.message);
}

export default async function wsRoutes(fastify) {
    fastify.setErrorHandler(wsErrorHandler);
    fastify.get("/ws/status", { websocket: true }, updateOnlineStatus);
}