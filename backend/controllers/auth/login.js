import { StatusCodes } from "http-status-codes";
import { getUser, getUserByEmail } from "../../db/dbQuery.js";
import HTTPError from "../../utils/error.js";
import { loginSchema } from '../../utils/inputValidation.js';
import TFA from "../../utils/TFA.js";
import { generateTokens } from "./authUtils.js";

export async function loginController(req, reply) {
    const zodResult = loginSchema.safeParse(req.body);
    if (!zodResult.success) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
    }
    let user = await getUser(req.body.login);
    if (!user) user = await getUserByEmail(req.body.login);
    if (user === null || await user.validatePassword(req.body.password) == false) {
        return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
    }
    const currentTFA = await TFA.getUsersTFA(user.id);
    if (currentTFA.type === 'disabled') {
        const accessToken = generateTokens(req.server, user.id, reply);
        return reply.send({ accessToken });
    } else {
        return reply.code(StatusCodes.ACCEPTED).send({
            tfaToken: currentTFA.generateJWT(req.server, 'check')
        });
    }
}