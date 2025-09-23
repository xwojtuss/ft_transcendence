import { StatusCodes } from "http-status-codes";
import { checkAuthHeader, checkRefreshToken, generateTokens } from "./authUtils.js";

export async function refreshController(req, reply) {
    try {
        await checkAuthHeader(req.server, req.headers['authorization']);
        return reply.code(StatusCodes.FORBIDDEN).send({ message: 'Access token is valid' });
    } catch (error) {}
    const payload = await checkRefreshToken(req.server, req.cookies.refreshToken);
    if (payload.id === undefined || !payload.id) {
        return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Refresh token is invalid' });
    }
    const accessToken = generateTokens(req.server, payload.id, reply);
    return reply.send({ accessToken });
}