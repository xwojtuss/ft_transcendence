import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { setIsOnline } from "../../db/dbQuery.js";
import { checkRefreshToken } from "./authUtils.js";

export async function logoutController(req, reply) {
    let payload;
    try {
        payload = await checkRefreshToken(req.server, req.cookies.refreshToken);
    } catch (error) {}
    reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    });
    if (payload && payload.id) await setIsOnline(payload.id, false);
    reply.code(StatusCodes.OK).send(ReasonPhrases.OK);
}