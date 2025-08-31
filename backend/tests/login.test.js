import { after, before, describe, it } from "node:test";
import deleteDatabase from "../db/dbDev.js";
import assert from "node:assert";
import { StatusCodes } from "http-status-codes";
import buildApp, { clearTestDatabase } from "../buildApp.js";
import User from "../utils/User.js";
import { logIn, register } from "./authUtils.js";

let fastify;

describe('Login', async () => {
    const arrayLength = 2;
    const correctUsers = new Array;
    const incorrectUsers = new Array;

    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);

        for (let i = 0; i < arrayLength; i++) {
            const user = new User('login' + i, 'Password123!@#');
            user.email = 'emailLogin' + i + '@test.com';
            correctUsers.push(user);
            await register(fastify, user.nickname, user.email, user.password);
        }
        for (let i = 0; i < arrayLength; i++) {
            const user = new User('invalid' + i, 'Password123!@#');
            user.email = 'emailInvalidLogin' + i + '@test.com';
            incorrectUsers.push(user);
        }
    });

    it('Positive tests', async (t) => {
        for (let i = 0; i < arrayLength; i++) {
            await positiveLogin(correctUsers.at(i), i % 2, t);
        }
    });
    it('Negative tests', async (t) => {
        for (let i = 0; i < arrayLength; i++) {
            await negativeLogin(i % 2 ? incorrectUsers.at(i).nickname : incorrectUsers.at(i).email, incorrectUsers.at(i).password, StatusCodes.NOT_ACCEPTABLE, t);
        }
        await negativeLogin('use', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user3#gd@test.com', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user3@test.com', 'z!1Z', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user4', 'zasgsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user4', 'zaSgsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user4', 'zaS@gsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('user4', 'zaS@5sgjbsdkujgbsdjkgbjksdbgjksdbgjksdbgjsdbgjksbdgsjdgbkjdsggsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeLogin('0123456789123', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeLogin(correctUsers.at(0).nickname, 'zaq1@WSX', StatusCodes.NOT_ACCEPTABLE, t);
        await negativeLogin(correctUsers.at(1).email, 'zaq1@WSX', StatusCodes.NOT_ACCEPTABLE, t);
    });
});

async function positiveLogin(user, useNickname, t) {
    const response = await logIn(fastify, useNickname ? user.nickname : user.email, user.password);
    assert.strictEqual(response.statusCode, StatusCodes.OK, response.message);
    const data = JSON.parse(response.payload);
    assert.ok(data.accessToken, "No accessToken in the payload");
    assert.ok(response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), "No refreshToken in cookies");
}

async function negativeLogin(login, password, expectedCode, t) {
    const response = await logIn(fastify, login, password);
    assert.strictEqual(response.statusCode, expectedCode, response.message);
    const data = JSON.parse(response.payload);
    assert.ok(data.message, "No error message in the payload");
    assert.ok(!response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), "refreshToken is in cookies");
}
