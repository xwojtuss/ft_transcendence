import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { updateController } from "../controllers/auth/update.js";
import HTTPError from "../utils/error.js";
import { getUserSession } from "../controllers/view/viewUtils.js";
import { loginController } from "../controllers/auth/login.js";
import { refreshController } from "../controllers/auth/refresh.js";
import { logoutController } from "../controllers/auth/logout.js";
import { registerController } from "../controllers/auth/register.js";
import { tfaController } from "../controllers/auth/tfa.js";

const loginRequestSchema = {
    body: {
        type: 'object',
        properties: {
            login: { type: 'string' },
            password: { type: 'string' }
        },
        required: ['login', 'password'],
        additionalProperties: false
    }
};

const registerRequestSchema = {
    body: {
        type: 'object',
        properties: {
            nickname: { type: 'string' },
            email: { type: 'string' },
            password: { type: 'string' }
        },
        required: ['nickname', 'email', 'password'],
        additionalProperties: false
    }
};

const tfaRequestSchema = {
    body: {
        type: 'object',
        properties: {
            code: { type: 'string' }
        },
        required: ['code'],
        additionalProperties: false
    }
};

async function loggedInPreHandler(req, reply) {
    try {
        const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
        if (!user) {
            throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        }
        req.currentUser = user;
    } catch (error) {
        return authErrorHandler(error, req, reply);
    }
}

async function loggedOutPreHandler(req, reply) {
    const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
    try {
        if (user) throw new HTTPError(StatusCodes.FORBIDDEN, 'Already logged in');
        req.currentUser = null;
    } catch (error) {
        return authErrorHandler(error, req, reply);
    }
}

async function loggedInOrOutPreHandler(req, reply) {
    const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
    req.currentUser = user ? user : null;
}

function authErrorHandler(error, req, reply) {
    if (error instanceof HTTPError) {
        return reply.status(error.code).send({ message: error.message });
    }
    console.error(error);
    return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: error.message });
}

export default function authRoutes(fastify) {
    fastify.setErrorHandler(authErrorHandler);
    fastify.post('/api/auth/login', { schema: loginRequestSchema, preHandler: loggedOutPreHandler, handler: loginController });

    fastify.post('/api/auth/register', { schema: registerRequestSchema, preHandler: loggedOutPreHandler, handler: registerController });

    fastify.post('/api/auth/refresh', { handler: refreshController });

    fastify.post('/api/auth/logout', { preHandler: loggedInPreHandler, handler: logoutController });

    fastify.post('/api/auth/update', { preHandler: loggedInPreHandler, handler: updateController });

    fastify.post('/api/auth/2fa', { schema: tfaRequestSchema, handler: tfaController });
}
