import { StatusCodes } from "http-status-codes";
import { getUser, addUser, getUserByEmail } from "../../db/dbQuery.js";
import { generateTokens } from "./authUtils.js";
import HTTPError from "../../utils/error.js";
import User from "../../utils/User.js";
import { registerSchema } from '../../utils/inputValidation.js';

export async function registerController(req, reply) {
    const zodResult = registerSchema.safeParse(req.body);
    if (!zodResult.success) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
    }
    const user = await getUser(req.body.nickname) || await getUserByEmail(req.body.email);
    if (user !== null) {
        return reply.code(StatusCodes.CONFLICT).send({ message: 'Nickname or Email already taken' });
    }
    const newUser = new User(req.body.nickname);
    await newUser.setPassword(req.body.password);
    newUser.email = req.body.email;
    newUser.id = await addUser(newUser);
    const accessToken = generateTokens(req.server, newUser.id, reply);
    return reply.send({ accessToken });
}