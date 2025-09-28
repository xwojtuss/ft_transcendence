import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS } from "../../utils/config.js";
import HTTPError from "../../utils/error.js";
import User from "../../utils/User.js";
import sharp from "sharp";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUserById } from "../../db/dbQuery.js";

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
        if (!payload.id || !await getUserById(payload.id)) {
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
        if (!payload.id || !await getUserById(payload.id) || !payload.type || !payload.status) {
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
        if (!payload.id || !await getUserById(payload.id)) {
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
 * @param {number} userId user id
 * @param {*} reply the request reply
 * @returns {string} the access token
 */
export function generateTokens(fastify, userId, reply) {
    const accessToken = fastify.jwt.sign({
        id: userId
    }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });

    const refreshToken = fastify.jwt.sign({
        id: userId
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

/**
 * Safe the image from the buffer to a file
 * @param {Buffer} imageFile the buffer of the image to save
 * @param {User} updatedUser the updated user instance, this function updates updatedUser.avatar
 * @throws {HTTPError} INTERNAL_SERVER_ERROR when could not save the avatar
 */
export async function saveImage(imageFile, updatedUser) {
    try {
        const timestamp = Date.now();
        await sharp(imageFile)
            .resize({ width: 256, height: 256, fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(`./backend/avatars/${updatedUser.id}_${timestamp}.webp`);
        updatedUser.avatar = `./backend/avatars/${updatedUser.id}_${timestamp}.webp`;
    } catch (error) {
        throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, 'Could not save avatar');
    }
}

