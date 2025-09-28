import HTTPError from "../../utils/error.js";
import User from "../../utils/User.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUser, getUserByEmail, updateUser, addPendingUpdate, isNicknamePending, isEmailPending, removePendingUpdate } from "../../db/dbQuery.js";
import fs from "fs";
import { updateSchema, updateNewPasswordSchema } from '../../utils/inputValidation.js';
import TFA from "../../utils/TFA.js";
import { generateTokens, saveImage } from "./authUtils.js";

export async function updateController(req, reply) {
    let zodResult, updatedUser, parts, buffer = null;
    const fields = {};
    try {
        parts = req.parts();
        for await (const part of parts) {
            if (part.type !== 'file') {
                fields[part.fieldname] = part.value;
                continue;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(part.mimetype)) {
                throw new HTTPError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Only JPEG, PNG and WEBP files are allowed');
            }
            buffer = await part.toBuffer();
        }
    } catch (error) {
        if (error instanceof HTTPError) throw error;
        throw new HTTPError(StatusCodes.REQUEST_TOO_LONG, 'Image must be smaller than 5MB');
    }
    if (fields.newPassword) {
        zodResult = updateNewPasswordSchema.safeParse(fields);
        updatedUser = new User(fields.nickname);
        await updatedUser.setPassword(fields.newPassword);
    } else {
        zodResult = updateSchema.safeParse({
            nickname: fields.nickname,
            email: fields.email,
            tfa: fields.tfa,
            phone: (fields.phone && fields.phone != '') ? fields.phone : '+48000000000',
            currentPassword: fields.currentPassword
        });
        updatedUser = new User(fields.nickname, req.currentUser.password);
    }
    if (!zodResult.success) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, zodResult.error.issues.at(0).message);
    }
    if (await req.currentUser.validatePassword(fields.currentPassword) == false) {
        return reply.code(StatusCodes.NOT_ACCEPTABLE).send({ message: 'Invalid credentials' });
    }
    updatedUser.id = req.currentUser.id;
    updatedUser.email = fields.email;
    updatedUser.avatar = req.currentUser.avatar;
    updatedUser.phoneNumber = fields.phone;
    const currentTFA = await TFA.getUsersTFA(req.currentUser.id);
    if (req.currentUser.nickname === updatedUser.nickname && req.currentUser.password === updatedUser.password
        && req.currentUser.phoneNumber === updatedUser.phoneNumber
        && req.currentUser.email === updatedUser.email && currentTFA.type === fields.tfa && !buffer) {
        // if there are no changes to be made do not refresh the token
        return reply.send({ accessToken: req.headers['authorization'].split(' ')[1] });
    }
    await removePendingUpdate(req.currentUser.id); // to stop previous "Cancel" from blocking the email or nickname
    if ((req.currentUser.nickname !== updatedUser.nickname && (await getUser(fields.nickname) || await isNicknamePending(fields.nickname)))
        || (req.currentUser.email !== updatedUser.email && (await getUserByEmail(fields.email) || await isEmailPending(fields.email)))) {
        return reply.code(StatusCodes.CONFLICT).send({ message: 'Nickname or Email already taken' });
    }
    if (!TFA.TFAtypes.has(fields.tfa)) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
    }
    if (buffer) {
        await saveImage(buffer, updatedUser);
    }
    const updatedTFA = new TFA(currentTFA.userId, fields.tfa);
    if (currentTFA.type !== 'disabled') {
        await addPendingUpdate(req.currentUser, updatedUser, currentTFA.type, updatedTFA.type);
        await currentTFA.regenerateOTP(false);
        return reply.code(StatusCodes.ACCEPTED).send({
            tfaToken: currentTFA.generateJWT(req.server, 'check')
        });
    } else {
        await updateUser(req.currentUser, updatedUser);
        try {
            if (req.currentUser.avatar && req.currentUser.avatar !== updatedUser.avatar) fs.unlinkSync(req.currentUser.avatar);
        } catch (error) {}
        if (await updatedTFA.makePending(currentTFA)) {
            return reply.code(StatusCodes.ACCEPTED).send({ tfaToken: updatedTFA.generateJWT(req.server, 'update') });
        }
    }
    const accessToken = generateTokens(req.server, updatedUser.id, reply);
    return reply.send({ accessToken });
}