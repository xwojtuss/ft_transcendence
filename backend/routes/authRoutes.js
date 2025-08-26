import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, addUser, getUserByEmail, updateUser, addPendingUpdate, commitPendingUpdate, getUserById, isNicknamePending, isEmailPending, hasPendingUpdate, removePendingUpdate } from "../db/dbQuery.js";
import { check2FAHeader, checkAuthHeader, checkRefreshToken, generateTokens, saveImage } from "../controllers/authControllers.js";
import HTTPError from "../utils/error.js";
import User from "../utils/User.js";
import { getUserSession } from "./viewRoutes.js";
import fs from "fs";
import { loginSchema, updateSchema, registerSchema, updateNewPasswordSchema } from '../utils/inputValidation.js';
import TFA from "../utils/TFA.js";

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
                const currentTFA = await TFA.getUsersTFA(user.id);
                if (currentTFA.typeOfTFA === 'disabled') {
                    const accessToken = generateTokens(fastify, user.id, reply);
                    return reply.send({ accessToken });
                } else {
                    return reply.code(StatusCodes.ACCEPTED).send({
                        tfaToken: currentTFA.generateJWT(fastify, 'check')
                    });
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
                newUser.id = await addUser(newUser);
                const accessToken = generateTokens(fastify, newUser.id, reply);
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
                if (payload.id === undefined || !payload.id) {
                    return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Refresh token is invalid' });
                }
                const accessToken = generateTokens(fastify, payload.id, reply);
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
                updatedUser.avatar = user.avatar;
                const currentTFA = await TFA.getUsersTFA(user.id);
                if (user.nickname === updatedUser.nickname && user.password === updatedUser.password
                    && user.email === updatedUser.email && currentTFA.type === fields.tfa && !buffer) {
                    // if there are no changes to be made do not refresh the token
                    return reply.send({ accessToken: req.headers['authorization'].split(' ')[1] });
                }
                await removePendingUpdate(user.id); // to stop previous "Cancel" from blocking the email or nickname
                if ((user.nickname !== updatedUser.nickname && (await getUser(fields.nickname) || await isNicknamePending(fields.nickname)))
                    || (user.email !== updatedUser.email && (await getUserByEmail(fields.email) || await isEmailPending(fields.nickname)))) {
                    return reply.code(StatusCodes.CONFLICT).send({ message: 'Nickname or Email already taken' });
                }
                if (!TFA.TFAtypes.has(fields.tfa)) {
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                }
                if (buffer) {
                    await saveImage(buffer, updatedUser);
                }
                const updatedTFA = new TFA(currentTFA.userId, fields.tfa);
                if (currentTFA.type !== 'disabled') {
                    await addPendingUpdate(user, updatedUser);
                    return reply.code(StatusCodes.ACCEPTED).send({
                        tfaToken: updatedTFA.generateJWT(fastify, 'check')
                    });
                } else {
                    await updateUser(user, updatedUser);
                    try {
                        if (user.avatar && user.avatar !== updatedUser.avatar) fs.unlinkSync(user.avatar);
                    } catch (error) {}
                    updatedTFA.generateSecret();
                    if (await updatedTFA.makePending(currentTFA)) {
                        return reply.code(StatusCodes.ACCEPTED).send({
                            tfaToken: updatedTFA.generateJWT(fastify, 'update')
                        });
                    }
                }
                const accessToken = generateTokens(fastify, updatedUser.id, reply);
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
                if (!payloadTFA || !payloadTFA.id || !req.body.code || !payloadTFA.type || !TFA.TFAtypes.has(payloadTFA.type))
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                user = await getUserById(payloadTFA.id);
                if (!user)
                    throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
                let payloadRefresh;
                try {
                    payloadRefresh = await checkRefreshToken(fastify, req.cookies.refreshToken);
                } catch (error) {
                    payloadRefresh = null;
                }
                const token = String(req.body.code).padStart(6, '0');
                const pendingTFA = await TFA.getUsersPendingTFA(user.id);
                console.log(pendingTFA.secret, pendingTFA.type);
                const currentTFA = await TFA.getUsersTFA(user.id);
                if (!payloadRefresh && payloadTFA.status === 'update') {
                    // user updating 2FA but logged out
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                } else if (!payloadRefresh && currentTFA.verify(token)) {
                    // user logging in - valid code
                    const accessToken = generateTokens(fastify, user.id, reply);
                    return reply.send({ accessToken });
                } else if (!payloadRefresh) {
                    // user logging in - invalid code
                    throw new HTTPError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code');
                } else if (payloadRefresh && payloadTFA.status === 'check' && !(await hasPendingUpdate(user.id))) {
                    // verifying 2FA for /update changes but there is no update pending
                    throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
                } else if (payloadRefresh && payloadTFA.status === 'check') {
                    // verifying 2FA for /update changes

                    await commitPendingUpdate(user);
                    const updatedUser = await getUserById(user.id);

                    if (await pendingTFA.makePending(currentTFA)) {
                        return reply.code(StatusCodes.ACCEPTED).send({
                            tfaToken: pendingTFA.generateJWT(fastify, 'update')
                        });
                    }
                    const accessToken = generateTokens(fastify, updatedUser.id, reply);
                    return reply.send({ accessToken });
                } else if (pendingTFA.verify(token)) {
                    // user updating 2FA - valid code
                    await pendingTFA.commit();
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