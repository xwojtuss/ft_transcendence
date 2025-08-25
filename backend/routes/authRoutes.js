import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, addUser, getUserByEmail, updateUser, getTemp2FAsecret, commitTFAChange } from "../db/dbQuery.js";
import { check2FAHeader, checkAuthHeader, checkRefreshToken, generateTempTFAToken, generateTokens, setupTFAupdate } from "../controllers/authControllers.js";
import HTTPError from "../utils/error.js";
import User from "../utils/User.js";
import { getUserSession } from "./viewRoutes.js";
import fs from "fs";
import { authenticator } from "otplib";
import { loginSchema, updateSchema, registerSchema, updateNewPasswordSchema, TFAtypes } from '../utils/inputValidation.js';

// authenticator.options = {
//     algorithm: 'sha256',
//     digits: 6,
//     step: 30
// };

/**
 * A map of 2FA user id's to their pending update
 * Key: {number}
 * Value: {User}
 */
const pendingUpdates = new Map();

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
            try {
                await checkAuthHeader(fastify, req.headers['authorization']);
                return reply.code(StatusCodes.FORBIDDEN).send({ message: 'Already logged in' });
            } catch (error) {}
            try {
                const zodResult = loginSchema.safeParse(req.body);
                if (!zodResult.success) {
                    throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
                }
                const user = await getUser(req.body.login);
                if (user === null || await user.validatePassword(req.body.password) == false) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
                }
                if (user.typeOfTFA === 'disabled') {
                    const accessToken = generateTokens(fastify, user.nickname, reply);
                    return reply.send({ accessToken });
                } else {
                    const tfaToken = generateTempTFAToken(fastify, user.nickname, user.typeOfTFA, 'check');
                    return reply.code(StatusCodes.ACCEPTED).send({ tfaToken });
                }
            } catch (error) {
                if (error instanceof HTTPError) {
                    return reply.code(error.code).send({ message: error.message });
                }
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}

export async function registerRoute(fastify) {
    fastify.post('/api/auth/register', {
        schema: {
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
        },
        handler: async (req, reply) => {
            try {
                await checkAuthHeader(fastify, req.headers['authorization']);
                return reply.code(StatusCodes.FORBIDDEN).send({ message: 'Already logged in' });
            } catch (error) {}
            try {
                const zodResult = registerSchema.safeParse(req.body);
                if (!zodResult.success) {
                    throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
                }
                const user = await getUser(req.body.nickname) || await getUserByEmail(req.body.email);
                if (user !== null) {
                    return reply.code(StatusCodes.CONFLICT).send({ message: 'Nickname or Email already taken' });
                }
                const newUser = new User(req.body.nickname);
                await newUser.setPassword(req.body.password);
                newUser.email = req.body.email;
                await addUser(newUser);
                const accessToken = generateTokens(fastify, newUser.nickname, reply);
                return reply.send({ accessToken });
            } catch (error) {
                if (error instanceof HTTPError) {
                    return reply.code(error.code).send({ message: error.message });
                }
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
            try {
                await checkAuthHeader(fastify, req.headers['authorization']);
                return reply.code(StatusCodes.FORBIDDEN).send({ message: 'Access token is valid' });
            } catch (error) {}
            try {
                const payload = await checkRefreshToken(fastify, req.cookies.refreshToken);
                if (payload.nickname === undefined || !payload.nickname) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Refresh token is invalid' });
                }
                const accessToken = generateTokens(fastify, payload.nickname, reply);
                return reply.send({ accessToken });
            } catch (error) {
                if (error instanceof HTTPError) {
                    return reply.code(error.code).send({ message: error.message });
                }
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}

export async function updateRoute(fastify) {
    fastify.post('/api/auth/update', {
        handler: async (req, reply) => {
            try {
                const user = await getUserSession(fastify, req.cookies.refreshToken, req.headers);
                if (!user) {
                    throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
                }
                let zodResult, updatedUser, parts, buffer = null;
                const fields = {};
                try {
                    parts = req.parts();
                    for await (const part of parts) {
                        if (part.type === 'file') {
                            if (!['image/jpeg', 'image/png', 'image/webp'].includes(part.mimetype)) {
                                throw new HTTPError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Only JPEG, PNG and WEBP files are allowed');
                            }
                            buffer = await part.toBuffer();
                        } else {
                            // part.type === 'field'
                            fields[part.fieldname] = part.value;
                        }
                    }
                } catch (error) {
                    if (error instanceof HTTPError) throw new HTTPError(error.code, error.message);
                    console.log(error);
                    throw new HTTPError(StatusCodes.REQUEST_TOO_LONG, 'Image must be smaller than 5MB');
                }
                if (fields.newPassword) {
                    zodResult = updateNewPasswordSchema.safeParse(fields);
                    updatedUser = new User(fields.nickname);
                    await updatedUser.setPassword(fields.newPassword);
                } else {
                    zodResult = updateSchema.safeParse({
                        nickname: fields.nickname,
                        email: fields.email,
                        tfa: fields.tfa,
                        currentPassword: fields.currentPassword
                    });
                    updatedUser = new User(fields.nickname, user.password);
                }
                if (!zodResult.success) {
                    throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
                }
                if (await user.validatePassword(fields.currentPassword) == false) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
                }
                updatedUser.id = user.id;
                updatedUser.email = fields.email;
                updatedUser.typeOfTFA = fields.tfa;
                updatedUser.avatar = user.avatar;
                if (user.nickname === updatedUser.nickname && user.password === updatedUser.password
                    && user.email === updatedUser.email && user.typeOfTFA === updatedUser.typeOfTFA && !buffer) {
                    // if there are no changes to be made do not refresh the token
                    return reply.send({ accessToken: req.headers['authorization'].split(' ')[1] });
                }
                if ((user.nickname !== updatedUser.nickname && await getUser(fields.nickname))
                    || (user.email !== updatedUser.email && await getUserByEmail(fields.email))) {
                    return reply.code(StatusCodes.CONFLICT).send({ message: 'Nickname or Email already taken' });
                }
                if (!TFAtypes.has(fields.tfa)) {
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                }
                if (buffer) {
                    await saveImage(buffer, updatedUser);
                }
                if (user.typeOfTFA !== 'disabled') {
                    pendingUpdates.set(user.id, updatedUser);
                    const tfaToken = generateTempTFAToken(fastify, user.nickname, 'totp', 'check');
                    return reply.code(StatusCodes.ACCEPTED).send({ tfaToken });
                } else {
                    await updateUser(user, updatedUser);
                    try {
                        if (user.avatar && user.avatar !== updatedUser.avatar) fs.unlinkSync(user.avatar);
                    } catch (error) {}
                    const tfaToken = await setupTFAupdate(fastify, user, updatedUser);
                    if (tfaToken) return reply.code(StatusCodes.ACCEPTED).send({ tfaToken });
                }
                const accessToken = generateTokens(fastify, updatedUser.nickname, reply);
                return reply.send({ accessToken });
            } catch (error) {
                console.error(error);
                if (error instanceof HTTPError) {
                    return reply.code(error.code).send({ message: error.message });
                }
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}

export async function logoutRoute(fastify) {
    fastify.post('/api/auth/logout', {
        schema: {},
        handler: async (req, reply) => {
            try {
                reply.clearCookie('refreshToken', {
                        path: '/',
                        httpOnly: true,
                        secure: true,
                        sameSite: 'Strict'
                    });
            } catch (error) {
                fastify.log.error(error);
            }
            reply.code(StatusCodes.OK).send(ReasonPhrases.OK);
        }
    });
}

export async function TFARoute(fastify) {
    fastify.post('/api/auth/2fa', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    code: { type: 'string' }
                },
                required: ['code'],
                additionalProperties: false
            }
        },
        handler: async (req, reply) => {
            try {
                if (!req.headers['authorization'] || req.headers['authorization'] === 'Bearer null' || !req.headers['authorization'].startsWith('Bearer ')) {
                    throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
                }
                let user;
                const payloadTFA = await check2FAHeader(fastify, req.headers['authorization']);
                if (!payloadTFA || !payloadTFA.nickname || !req.body.code || !payloadTFA.type || !TFAtypes.has(payloadTFA.type))
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                user = await getUser(payloadTFA.nickname);
                if (!user)
                    throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
                let payloadRefresh;
                try {
                    payloadRefresh = await checkRefreshToken(fastify, req.cookies.refreshToken);
                } catch (error) {
                    payloadRefresh = null;
                }
                const token = String(req.body.code).padStart(6, '0');
                const temp2FAsecret = await getTemp2FAsecret(user.nickname);
                console.log(token);
                if (!payloadRefresh && payloadTFA.status === 'update') {
                    // user updating 2FA but logged out
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                } else if (!payloadRefresh && authenticator.check(token, user.TFAsecret)) {
                    // user logging in - valid code
                    const accessToken = generateTokens(fastify, user.nickname, reply);
                    return reply.send({ accessToken });
                } else if (!payloadRefresh) {
                    // user logging in - invalid code
                    throw new HTTPError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code');
                } else if (payloadRefresh && payloadTFA.status === 'check' && !pendingUpdates.has(user.id)) {
                    // verifying 2FA for /update changes but there is no update pending
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                } else if (payloadRefresh && payloadTFA.status === 'check') {
                    // verifying 2FA for /update changes
                    const updatedUser = pendingUpdates.get(user.id);
                    await updateUser(user, updatedUser);
                    const tfaToken = await setupTFAupdate(fastify, user, updatedUser);
                    pendingUpdates.delete(user);
                    if (tfaToken) return reply.code(StatusCodes.ACCEPTED).send({ tfaToken });
                    const accessToken = generateTokens(fastify, updatedUser.nickname, reply);
                    return reply.send({ accessToken });
                } else if (authenticator.check(token, temp2FAsecret)) {
                    // user updating 2FA - valid code
                    user.typeOfTFA = payloadTFA.type;
                    await commitTFAChange(user);
                } else {
                    // user updating 2FA - invalid code
                    throw new HTTPError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code');
                }
                return reply.send({ message: "OK" });
            } catch (error) {
                console.error(error);
                if (error instanceof HTTPError) {
                    return reply.code(error.code).send({ message: error.message });
                }
                console.error(error);
                return reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
            }
        }
    });
}