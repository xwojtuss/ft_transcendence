import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../utils/error.js";
import { getUserById } from "../db/dbQuery.js";
import { getUserSession } from "./viewRoutes.js";
import fs from "fs";

export default function avatarRoute(fastify) {
    fastify.get('/api/avatars/:userId', async (request, reply) => {
        try {
            const user = await getUserSession(fastify, request.cookies.refreshToken, request.headers);
            if (!user) {
                throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
            }
            const { userId } = request.params;
            if (parseInt(userId) != userId || userId <= 0) {
                throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
            }
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
        } catch (error) {
            console.error(error);
            if (error instanceof HTTPError) {
                return reply.code(error.code).send({ message: error.message });
            }
            return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
        }
    });
}