import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser } from "../db/dbQuery.js";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS } from "../utils/config.js";

async function checkAuthHeader(fastify, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
        return [false, StatusCodes.UNAUTHORIZED, 'Missing or invalid Authorization header', null];
    }
    const userAccessToken = authHeader.split(' ')[1];

    try {
        const payload = await fastify.jwt.verify(userAccessToken, process.env.ACCESS_TOKEN_SECRET);
        return [true, StatusCodes.OK, ReasonPhrases.OK, payload];
    } catch (error) {
        return [false, StatusCodes.UNAUTHORIZED, 'Invalid or expired access token', null];
    }
}

async function checkRefreshToken(fastify, refreshToken) {
    if (!refreshToken) {
        return [false, StatusCodes.UNAUTHORIZED, 'Missing or invalid refresh token', null];
    }
    try {
        const payload = await fastify.jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        return [true, StatusCodes.OK, ReasonPhrases.OK, payload];
    } catch (error) {
        return [false, StatusCodes.UNAUTHORIZED, 'Invalid or expired refresh token', null];
    }
}

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

                const accessToken = fastify.jwt.sign({
                    username: user.nickname
                }, process.env.ACCESS_TOKEN_SECRET, {
                    expiresIn: ACCESS_TOKEN_EXPIRY
                });

                const refreshToken = fastify.jwt.sign({
                    username: user.nickname
                }, process.env.REFRESH_TOKEN_SECRET, {
                    expiresIn: REFRESH_TOKEN_EXPIRY
                });

                reply.setCookie('refreshToken', refreshToken, {
                    path: '/api/auth/refresh',
                    httpOnly: true,
                    secure: process.env.IS_PRODUCTION === 'true',
                    sameSite: 'Strict',
                    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS
                });

                // maybe store sessions on the backend in database?
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
                const accessToken = fastify.jwt.sign({
                    username: payload.nickname,
                }, process.env.ACCESS_TOKEN_SECRET, {
                    expiresIn: ACCESS_TOKEN_EXPIRY
                });

                const refreshToken = fastify.jwt.sign({
                    username: payload.nickname
                }, process.env.REFRESH_TOKEN_SECRET, {
                    expiresIn: REFRESH_TOKEN_EXPIRY
                });

                reply.setCookie('refreshToken', refreshToken, {
                    path: '/api/auth/refresh',
                    httpOnly: true,
                    secure: process.env.IS_PRODUCTION === 'true',
                    sameSite: 'Strict',
                    maxAge: REFRESH_TOKEN_EXPIRY_SECONDS
                });

                // maybe store sessions on the backend in database?
                return reply.send({ accessToken });
            } catch (error) {
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}