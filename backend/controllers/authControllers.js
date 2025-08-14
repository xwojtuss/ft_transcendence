import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS } from "../utils/config.js";
import HTTPError from "../utils/error.js";

/**
 * Checks whether the access token is valid with fastify.jwd.verify
 * @param {*} fastify the fastify instance
 * @param {string} authHeader the access header as: 'Bearer [token]'
 * @returns the payload if the token is valid
 * @throws {HTTPError} UNAUTHORIZED if the token is not valid
 */
export async function checkAuthHeader(fastify, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Missing or invalid Authorization header');
    }
    const userAccessToken = authHeader.split(' ')[1];

    try {
        return await fastify.jwt.verify(userAccessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, 'Invalid or expired access token');
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
        return await fastify.jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
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
        secure: process.env.IS_PRODUCTION === 'true',
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_SECONDS
    });
    // maybe store sessions on the backend in database?
    return accessToken;
}