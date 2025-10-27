import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { setIsOnline } from "../../db/dbQuery.js";
import { checkRefreshToken } from "./authUtils.js";

export function deleteRefreshToken(reply) {
    reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    });
}

export async function logoutController(req, reply) {
    let payload;
    try {
        payload = await checkRefreshToken(req.server, req.cookies.refreshToken);
    } catch (error) {}
    deleteRefreshToken(reply);
    if (payload && payload.id) await setIsOnline(payload.id, false);
    reply.code(StatusCodes.OK).send(ReasonPhrases.OK);
}