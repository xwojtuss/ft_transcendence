import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../utils/error.js";
import { getUserById } from "../db/dbQuery.js";
import { getUserSession } from "../controllers/view/viewUtils.js";
import fs from "fs";

function avatarErrorHandler(error, req, reply) {
    if (error instanceof HTTPError) {
        return reply.status(error.code).send({ message: error.message });
    }
    console.error(error);
    return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: error.message });
}

export default function avatarRoute(fastify) {
    fastify.setErrorHandler(avatarErrorHandler);
    fastify.get('/api/avatars/:userId', async (request, reply) => {
        const user = await getUserSession(fastify, request.cookies.refreshToken, request.headers);
        if (!user) {
            throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        }
        const { userId } = request.params;
        const parsedUserId = parseInt(userId, 10);
        if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
            throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
        }
        const avatarOwner = await getUserById(parsedUserId);
        if (!avatarOwner) {
            throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
        }
        let avatarPath = './frontend/assets/default-avatar.svg';
        let avatarMimetype = 'image/svg+xml';
        if (avatarOwner.avatar && fs.existsSync(avatarOwner.avatar)) {
            avatarPath = avatarOwner.avatar;
            avatarMimetype = 'image/webp';
        }
        const stream = fs.createReadStream(avatarPath);
        return reply.type(avatarMimetype).send(stream);
    });
}