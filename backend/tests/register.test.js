import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { StatusCodes } from "http-status-codes";
import buildApp, { clearTestDatabase } from "../buildApp.js";
import { register } from "./authUtils.js";

let fastify;

describe('Registration', async () => {
    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);
    });

    it('Positive tests', async (t) => {
        await positiveRegistration('user1', 'user1@test.com', 'zaq1@WSX', t);
        await positiveRegistration('wojTEK12__5', 'u2@test.com', '123Terraria!#%$^', t);
        await positiveRegistration('pzur', 'sfh.jk6aghjf@test.com', '!@#$%^&*abcehjasdfbASDH342687', t);
        await positiveRegistration('012345678912', 'w.test.inte.dsg@t.co', '!@#$%^&*abcehjasdfbASDH342687', t);
    });
    it('Negative tests', async (t) => {
        await negativeRegistration('use', 'user2@test.com', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user3', 'user3#gd@test.com', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user3', 'user3@test.com', 'z!1Z', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user4', 'user4@test.com', 'zasgsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user4', 'user4@test.com', 'zaSgsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user4', 'user4@test.com', 'zaS@gsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user4', 'user4@test.com', 'zaS@5sgjbsdkujgbsdjkgbjksdbgjksdbgjksdbgjsdbgjksbdgsjdgbkjdsggsdgsdg', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('0123456789123', 'user5@test.com', 'zaq1@WSX', StatusCodes.BAD_REQUEST, t);
        await negativeRegistration('user1', 'user12@test.com', 'zaq1@WSX', StatusCodes.CONFLICT, t);
        await negativeRegistration('user124', 'user1@test.com', 'zaq1@WSX', StatusCodes.CONFLICT, t);
    });
});

async function positiveRegistration(nickname, email, password, t) {
    const response = await register(fastify, nickname, email, password);
    assert.strictEqual(response.statusCode, StatusCodes.OK, response.message);
    const data = JSON.parse(response.payload);
    assert.ok(data.accessToken, "No accessToken in the payload");
    assert.ok(response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), "No refreshToken in cookies");
}

async function negativeRegistration(nickname, email, password, expectedCode, t) {
    const response = await register(fastify, nickname, email, password);
    assert.strictEqual(response.statusCode, expectedCode, response.message);
    const data = JSON.parse(response.payload);
    assert.ok(data.message, "No error message in the payload");
    assert.ok(!response.cookies.some(cookie => cookie.name === 'refreshToken' && cookie.value), "refreshToken is in cookies");
}
