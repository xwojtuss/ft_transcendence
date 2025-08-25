import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS, TFA_TOKEN_EXPIRY } from "../utils/config.js";
import HTTPError from "../utils/error.js";
import { getUser, disableTFA, prepareTFAChange } from "../db/dbQuery.js";
import User from "../utils/User.js";
import { authenticator } from "otplib";
import sharp from "sharp";

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

/**
 * Create a new 2FA authorization token
 * @param {*} fastify the fastify instance
 * @param {string} nickname user nickname
 * @param {string} typeOfTFA the type of 2FA, one of TFAtypes
 * @param {string} status whether it is to 'check' an existing 2FA or to 'update' or setup the 2FA
 * @returns the 2FA authorization token
 */
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

/**
 * Function to setup the new 2FA method if there are updates to commit, this has to be ran AFTER the updatedUsers' credentials have been commited to the db
 * @param {*} fastify the fastify instance
 * @param {User} currentUser the original user with old information
 * @param {User} updatedUser user instance with updated information, nickname and email must match with what's in the db when this function is called
 * @returns the tfaToken if the 2FA has to be set up via another request or null if that's it for the 2FA update flow
 */
export async function setupTFAupdate(fastify, currentUser, updatedUser) {
    if (updatedUser.typeOfTFA !== currentUser.typeOfTFA && updatedUser.typeOfTFA === 'disabled') {
        await disableTFA(updatedUser);
    } else if (updatedUser.typeOfTFA !== currentUser.typeOfTFA && updatedUser.typeOfTFA === 'totp') {
        const newSecret = authenticator.generateSecret();
        await prepareTFAChange(updatedUser, newSecret);
        const tfaToken = generateTempTFAToken(fastify, updatedUser.nickname, 'totp', 'update');
        return tfaToken;
    }
    return null;
}

/**
 * Safe the image from the buffer to a file
 * @param {Buffer} imageFile the buffer of the image to save
 * @param {User} updatedUser the updated user instance, this function updates updatedUser.avatar
 * @throws {HTTPError} INTERNAL_SERVER_ERROR when could not save the avatar
 */
async function saveImage(imageFile, updatedUser) {
    try {
        const timestamp = Date.now();
        await sharp(imageFile)
            .resize({ width: 256, height: 256, fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(`./backend/avatars/${updatedUser.id}_${timestamp}.webp`);
        updatedUser.avatar = `./backend/avatars/${updatedUser.id}_${timestamp}.webp`;
    } catch (error) {
        console.log(error);
        throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, 'Could not save avatar');
    }
}