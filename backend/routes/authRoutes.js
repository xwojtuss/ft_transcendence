import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser } from "../db/dbQuery.js";
import { checkAuthHeader, checkRefreshToken, generateTokens } from "../controllers/authControllers.js";

export default async function loginRoute(fastify) {
    fastify.post('/api/auth/login', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    login: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['login', 'password'],
                additionalProperties: false
            }
        },
        handler: async (req, reply) => {
            const [isValid, statusCode, reason, payload] = await checkAuthHeader(fastify, req.headers['authorization']);
            if (isValid)
                return reply.code(StatusCodes.BAD_REQUEST).send({ message: 'Already logged in' });
            try {
                const user = await getUser(req.body.login);
                if (user === null || await user.validatePassword(req.body.password) == false) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
                }
                const accessToken = generateTokens(fastify, user.nickname, reply);
                return reply.send({ accessToken });
            } catch (error) {
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}

export async function refreshRoute(fastify) {
    fastify.post('/api/auth/refresh', {
        schema: {},
        handler: async (req, reply) => {
            let [isValid, statusCode, reason, payload] = await checkAuthHeader(fastify, req.headers['authorization']);
            if (isValid)
                return reply.code(StatusCodes.BAD_REQUEST).send({ message: 'Access token is valid' });
            [isValid, statusCode, reason, payload] = await checkRefreshToken(fastify, req.cookies.refreshToken);
            if (!isValid)
                return reply.code(statusCode).send({ message: reason });
            try {
                console.log(payload);
                if (payload.nickname === undefined || !payload.nickname) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Refresh token is invalid' });
                }
                const accessToken = generateTokens(fastify, payload.nickname, reply);
                return reply.send({ accessToken });
            } catch (error) {
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}