import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../utils/error.js";
import { getUserSession } from "../controllers/view/viewUtils.js";
import { getUser, getUserById } from "../db/dbQuery.js";
import { acceptPendingInvite, addFriendInvite, removeFriend, removePendingInvite } from "../db/friendQueries.js";

const generalFriendsSchema = {
    body: {
        type: 'object',
        properties: {
            userId: { type: 'number' }
        },
        required: ['userId'],
        additionalProperties: false
    }
};

const addFriendSchema = {
    body: {
        type: 'object',
        properties: {
            nickname: { type: 'string' }
        },
        required: ['nickname'],
        additionalProperties: false
    }
};

async function friendsPreHandler(req, reply) {
    try {
        const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
        if (!user) {
            throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        }
        req.currentUser = user;
        if (req.body.userId) {
            const bodyUser = await getUserById(req.body.userId);
            if (!bodyUser || bodyUser.id === user.id) {
                throw new HTTPError(StatusCodes.BAD_REQUEST, "Invalid id");
            }
            req.otherUser = bodyUser;
        }
    } catch (error) {
        if (error instanceof HTTPError) {
            return reply.code(error.code).send({ message: error.message });
        }
        return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
    }
}

export function errorHandler(error, req, reply) {
    if (error instanceof HTTPError) {
        return reply.code(error.code).send({ message: error.message });
    }
    console.error(error);
    return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
}

const generalFriendsOpts = { schema: generalFriendsSchema, preHandler: friendsPreHandler };

export function friendsRoutes(fastify) {
    fastify.setErrorHandler(errorHandler);
    fastify.post('/api/friends/invite', { schema: addFriendSchema, preHandler: friendsPreHandler }, async (req, reply) => {
        const userToInvite = await getUser(req.body.nickname);
        await addFriendInvite(req.currentUser.id, userToInvite ? userToInvite.id : undefined);
        return reply.send({ message: 'OK' });
    });
    fastify.post('/api/friends/accept', generalFriendsOpts, async (req, reply) => {
        await acceptPendingInvite(req.currentUser.id, req.otherUser.id);
        return reply.send({ message: 'OK' });
    });
    fastify.post('/api/friends/decline', generalFriendsOpts, async (req, reply) => {
        await removePendingInvite(req.currentUser.id, req.otherUser.id);
        return reply.send({ message: 'OK' });
    });
    fastify.post('/api/friends/cancel', generalFriendsOpts, async (req, reply) => {
        await removePendingInvite(req.otherUser.id, req.currentUser.id);
        return reply.send({ message: 'OK' });
    });
    fastify.delete('/api/friends', generalFriendsOpts, async (req, reply) => {
        await removeFriend(req.currentUser.id, req.otherUser.id);
        return reply.send({ message: 'OK' });
    });
}
