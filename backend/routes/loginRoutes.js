import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser } from "../db/dbQuery.js";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS } from "../utils/config.js";

export default async function loginRoutes(fastify) {
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
            try {
                try {
                    await req.jwtVerify();
                    return reply.code(StatusCodes.BAD_REQUEST).send({ message: 'Already logged in' });
                } catch (error) {}
                const user = await getUser(req.body.login);
                if (user === null || await user.validatePassword(req.body.password) == false) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
                }

                const accessToken = fastify.jwt.sign({
                    username: user.nickname,
                    email: user.email
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