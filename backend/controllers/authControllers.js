import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS, TFA_TOKEN_EXPIRY } from "../utils/config.js";
import HTTPError from "../utils/error.js";
import { getUser } from "../db/dbQuery.js";

/**
 * Checks whether the access token is valid with fastify.jwd.verify
 * @param {*} fastify the fastify instance
 * @param {string} authHeader the authorization header as: 'Bearer [token]'
 * @returns the payload if the token is valid
 * @throws {HTTPError} UNAUTHORIZED if the token is not valid
 */
export async function checkAuthHeader(fastify, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Missing or invalid Authorization header');
    }
    const userAccessToken = authHeader.split(' ')[1];

    try {
        const payload = await fastify.jwt.verify(userAccessToken, process.env.ACCESS_TOKEN_SECRET);
        if (!payload.nickname || !await getUser(payload.nickname)) {
            throw new Error();
        }
        return payload;
    } catch (error) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Invalid or expired access token');
    }
}

/**
 * Checks whether the temp 2FA token is valid with fastify.jwd.verify
 * @param {*} fastify the fastify instance
 * @param {string} authHeader the authorization header as: 'Bearer [token]'
 * @returns the payload if the token is valid
 * @throws {HTTPError} UNAUTHORIZED if the token is not valid
 */
export async function check2FAHeader(fastify, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Missing or invalid Authorization header');
    }
    const user2FAToken = authHeader.split(' ')[1];

    try {
        const payload = await fastify.jwt.verify(user2FAToken, process.env.TFA_TOKEN_SECRET);
        if (!payload.nickname || !await getUser(payload.nickname) || !payload.type || !payload.status) {
            throw new Error();
        }
        return payload;
    } catch (error) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Invalid or expired 2FA token');
    }
}

/**
 * Checks whether the refresh token is valid with fastify.jwd.verify
 * @param {*} fastify the fastify instance
 * @param {string} refreshToken the refresh token
 * @returns the payload if the token is valid
 * @throws {HTTPError} UNAUTHORIZED if the token is not valid
 */
export async function checkRefreshToken(fastify, refreshToken) {
    if (!refreshToken) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Missing or invalid refresh token');
    }
    try {
        const payload = await fastify.jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (!payload.nickname || !await getUser(payload.nickname)) {
            throw new Error();
        }
        return payload;
    } catch (error) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Invalid or expired refresh token');
    }
}

/**
 * Generates access and refresh tokens, sets the cookie for the refresh token
 * @param {*} fastify the fastify instance
 * @param {string} nickname user nickname
 * @param {*} reply the request reply
 * @returns {string} the access token
 */
export function generateTokens(fastify, nickname, reply) {
    const accessToken = fastify.jwt.sign({
        nickname: nickname
    }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });

    const refreshToken = fastify.jwt.sign({
        nickname: nickname
    }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY
    });

    reply.setCookie('refreshToken', refreshToken, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_SECONDS
    });
    return accessToken;
}

export function generateTempTFAToken(fastify, nickname, typeOfTFA, status) {
    const tfaToken = fastify.jwt.sign({
        nickname: nickname,
        type: typeOfTFA,
        status: status
    }, process.env.TFA_TOKEN_SECRET, {
        expiresIn: TFA_TOKEN_EXPIRY
    });
    return tfaToken;
}