import { ReasonPhrases, StatusCodes } from "http-status-codes";

export async function logoutController(req, reply) {
    reply.clearCookie('refreshToken', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    });
    reply.code(StatusCodes.OK).send(ReasonPhrases.OK);
}