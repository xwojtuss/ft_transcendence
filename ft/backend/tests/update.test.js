import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { StatusCodes } from "http-status-codes";
import buildApp, { clearTestDatabase } from "../buildApp.js";
import User from "../utils/User.js";
import { logIn, register, update } from "./authUtils.js";
import { getUser } from "../db/dbQuery.js";

class TestUser {
    nickname = null;
    password = null;
    newPassword = null;
    email = null;
    avatar = null;
    phoneNumber = null;
    tfa = 'disabled';

    constructor() {}
}

let fastify;

describe('Update', async () => {
    let user, updatedUser, accessToken, refreshToken;

    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);

        user = new User('update', 'Password123!@#');
        user.email = 'emailUpdate@test.com';
        await register(fastify, 'updateTaken', 'updateTaken@test.com', 'zaq1@WSX');
        const response = await register(fastify, user.nickname, user.email, user.password);
        accessToken = JSON.parse(response.payload).accessToken;
        refreshToken = response.cookies.find(cookie => cookie.name === 'refreshToken').value;
        updatedUser = new TestUser();
        updatedUser.nickname = user.nickname;
        updatedUser.email = user.email;
        updatedUser.password = user.password;
    });

    it("Positive tests", async (t) => {
        updatedUser.email = 'validUpdate@test.com';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
        updatedUser.nickname = 'updated';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
        updatedUser.password = 'bgt5^YHN';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
        updatedUser.phone = '+48111111111';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
        updatedUser.phone = '+48222222222';
        updatedUser.password = 'vfr4%TGB';
        updatedUser.nickname = 'updated1';
        updatedUser.email = 'validUpdate2@test.com';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
        updatedUser.phone = '+48333333333';
        updatedUser.password = 'xsw2#EDC';
        updatedUser.email = 'validUpdate3@test.com';
        await positiveUpdate(user, updatedUser, accessToken, refreshToken, t);
        await checkUser(updatedUser);
        user = getUpdatedUser(updatedUser);
    });
    it("Negative tests", async (t) => {
        updatedUser.email = '@test.com';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.email = 'asg$@gd@test.com';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.nickname = 'aa';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.nickname = 'updateTaken';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.CONFLICT, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.nickname = 'gjksbgjkbsdgsdgnbkj';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.nickname = '#$&$%*';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.nickname = '#$&$%*';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.phoneNumber = '888888888';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.tfa = 'some unknown type';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.password = 'jgdjgshsdg';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.password = 'zaqWSXcde';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
        updatedUser.password = '%&^%$%#$%';
        await negativeUpdate(user, updatedUser, accessToken, refreshToken, StatusCodes.BAD_REQUEST, t);
        await checkNegativeUser(user);
        resetUser(user, updatedUser);
    });
});

async function checkUser(updated) {
    const user = await getUser(updated.nickname);
    assert.ok(user, "User does not exist - nickname did not update");
    assert.strictEqual(user.nickname, updated.nickname, "Nickname did not update");
    assert.strictEqual(user.email, updated.email, "Email did not update");
    assert.strictEqual(user.phoneNumber, updated.phoneNumber, "PhoneNumber did not update");
    assert.strictEqual(await user.validatePassword(updated.password), true, "Password did not update");
}

async function checkNegativeUser(original) {
    const user = await getUser(original.nickname);
    assert.ok(user, "User does not exist - nickname updated");
    assert.strictEqual(user.nickname, original.nickname, "Nickname updated");
    assert.strictEqual(user.email, original.email, "Email updated");
    assert.strictEqual(user.phoneNumber, original.phoneNumber, "PhoneNumber updated");
    assert.strictEqual(await user.validatePassword(original.password), true, "Password updated");
}

function getUpdatedUser(updated) {
    const newUser = new User(updated.nickname, updated.password);
    newUser.email = updated.email;
    newUser.phoneNumber = updated.phoneNumber;
    newUser.avatar = updated.avatar;
    return newUser;
}

function resetUser(original, updated) {
    updated.nickname = original.nickname;
    updated.email = original.email;
    updated.password = original.password;
    updated.avatar = original.avatar;
    updated.phoneNumber = original.phoneNumber;
    updated.tfa = 'disabled';
}

async function positiveUpdate(originalUser, updatedUser, accessToken, refreshToken, t) {
    const formdata = new FormData;
    formdata.append('nickname', originalUser.nickname !== updatedUser.nickname ? updatedUser.nickname : originalUser.nickname);
    formdata.append('email', originalUser.email !== updatedUser.email ? updatedUser.email : originalUser.email);
    formdata.append('tfa', updatedUser.tfa);
    formdata.append('currentPassword', originalUser.password);
    formdata.append('newPassword', originalUser.password !== updatedUser.password ? updatedUser.password : '');
    if (originalUser.avatar !== updatedUser.avatar) formdata.append('avatar', updatedUser.avatar);
    if (originalUser.phoneNumber !== updatedUser.phoneNumber) formdata.append('phone', updatedUser.phoneNumber);
    const response = await update(fastify, formdata, accessToken, refreshToken);
    assert.strictEqual(response.statusCode, StatusCodes.OK, response.message);
    const data = JSON.parse(response.payload);
    assert.ok(data.accessToken, "No accessToken in the payload");
    assert.ok(response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), "No refreshToken in cookies");
    return response;
}

async function negativeUpdate(originalUser, updatedUser, accessToken, refreshToken, expectedCode, t) {
    const formdata = new FormData;
    formdata.append('nickname', originalUser.nickname !== updatedUser.nickname ? updatedUser.nickname : originalUser.nickname);
    formdata.append('email', originalUser.email !== updatedUser.email ? updatedUser.email : originalUser.email);
    formdata.append('tfa', updatedUser.tfa);
    formdata.append('currentPassword', originalUser.password);
    formdata.append('newPassword', originalUser.password !== updatedUser.password ? updatedUser.password : '');
    if (originalUser.avatar !== updatedUser.avatar) formdata.append('avatar', updatedUser.avatar);
    if (originalUser.phoneNumber !== updatedUser.phoneNumber) formdata.append('phone', updatedUser.phoneNumber);
    const response = await update(fastify, formdata, accessToken, refreshToken);
    assert.strictEqual(response.statusCode, expectedCode, response.message);
    const data = JSON.parse(response.payload);
    assert.strictEqual(data.accessToken, undefined, "accessToken is in the payload");
    assert.ok(data.message, "Error message is not in the payload");
    assert.strictEqual(response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), false, "refreshToken is in cookies");
    return response;
}
