import { after, before, describe, it } from "node:test";
import buildApp, { clearTestDatabase } from "../buildApp.js";
import User from "../utils/User.js";
import { randomBytes } from "node:crypto";
import assert from "node:assert";

let fastify;

describe('User class', async () => {
    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);
    });

    it('Password hashing', async (t) => {
        for (let i = 1; i < 3; i++) {
            await checkRandomPassword(t, i);
        }
    });
});

async function checkRandomPassword(t, i) {
    const secretPassword = randomBytes(8).toString("hex");
    const user = new User('wojtek');

    await user.setPassword(secretPassword);

    return t.test('Test ' + i, async (t) => {
        assert.strictEqual(await user.validatePassword(secretPassword), true, "Password should be valid");
        assert.strictEqual(await user.validatePassword(), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(''), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(null), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword('test'), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(randomBytes(2).toString("hex")), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(user.password), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(user.nickname), false, "Password should be invalid");
        assert.strictEqual(await user.validatePassword(user.email), false, "Password should be invalid");
        const invalidPassword = randomBytes(8).toString("hex");
        assert.strictEqual(await user.validatePassword(invalidPassword !== secretPassword ? invalidPassword : ''), false, "Password should be invalid");
    });
}