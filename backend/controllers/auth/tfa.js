import HTTPError from "../../utils/error.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { commitPendingUpdate, getUserById, hasPendingUpdate } from "../../db/dbQuery.js";
import TFA from "../../utils/TFA.js";
import { check2FAHeader, checkRefreshToken, generateTokens } from "./authUtils.js";

export async function tfaController(req, reply) {
    if (!req.headers['authorization'] || req.headers['authorization'] === 'Bearer null' || !req.headers['authorization'].startsWith('Bearer ')) {
        throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
    }
    let user;
    const payloadTFA = await check2FAHeader(req.server, req.headers['authorization']);
    if (!payloadTFA || !payloadTFA.id || !req.body.code || !payloadTFA.type || !TFA.TFAtypes.has(payloadTFA.type))
        throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
    user = await getUserById(payloadTFA.id);
    if (!user)
        throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
    let payloadRefresh;
    try {
        payloadRefresh = await checkRefreshToken(req.server, req.cookies.refreshToken);
    } catch (error) {
        payloadRefresh = null;
    }
    const token = String(req.body.code).padStart(6, '0');
    const pendingTFA = await TFA.getUsersPendingTFA(user.id);
    const currentTFA = await TFA.getUsersTFA(user.id);
    switch (payloadTFA.status) {
        case 'check':
            // handle 2FA verification without setup
            if (currentTFA.type === 'disabled' || (payloadRefresh && !(await hasPendingUpdate(user.id))))
                throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
            if (!currentTFA.verify(token))
                throw new HTTPError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code');
            if (payloadRefresh) {
                // user verifying /update changes
                const newTFA = await TFA.getPendingUpdateTFA(user.id);
                await commitPendingUpdate(user);
                const updatedUser = await getUserById(user.id);
                await currentTFA.regenerateOTP(false);
                if (newTFA && await newTFA.makePending(currentTFA)) {
                    return reply.code(StatusCodes.ACCEPTED).send({
                        tfaToken: newTFA.generateJWT(req.server, 'update')
                    });
                }
                const accessToken = generateTokens(req.server, updatedUser.id, reply);
                return reply.send({ accessToken });
            } else {
                // user verifying during login
                await currentTFA.regenerateOTP(false);
                const accessToken = generateTokens(req.server, user.id, reply);
                return reply.send({ accessToken });
            }
            break;
        case 'update':
            // 2FA change in progress, handle setup
            if (!payloadRefresh || !pendingTFA || pendingTFA.type === 'disabled')
                throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
            if (pendingTFA.type === 'sms' && !user.phoneNumber)
                throw new HTTPError(StatusCodes.BAD_REQUEST, "Add a phone number to your profile");
            if (!pendingTFA.verify(token))
                throw new HTTPError(StatusCodes.NOT_ACCEPTABLE, 'Invalid code');
            await pendingTFA.regenerateOTP(false);
            await pendingTFA.commit();
            break;
        default:
            throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
    }
    return reply.send({ message: "OK" });
}
