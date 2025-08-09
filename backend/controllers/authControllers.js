import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { ACCESS_TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY_SECONDS, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS } from "../utils/config.js";

export async function checkAuthHeader(fastify, authHeader) {
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

export async function checkRefreshToken(fastify, refreshToken) {
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

export function generateTokens(fastify, nickname, reply) {
    const accessToken = fastify.jwt.sign({
        username: nickname
    }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY
    });

    const refreshToken = fastify.jwt.sign({
        username: nickname
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
    return accessToken;
}