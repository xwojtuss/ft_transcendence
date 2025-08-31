import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { StatusCodes } from "http-status-codes";
import buildApp, { clearTestDatabase } from "../buildApp.js";
import { register } from "./authUtils.js";
import User from "../utils/User.js";

let fastify;

describe('Unprotected routes', async () => {
    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);
    });

    it('GET /', async (t) => { await checkSSR('/', t) });
    it('GET /login', async (t) => { await checkSSR('/login', t) });
    it('GET /register', async (t) => { await checkSSR('/register', t) });
});

describe('Protected routes', async () => {
    let accessToken;
    let refreshToken;

    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);
        const user = new User("protected", "zaq1@WSX");
        user.email = "protected@test.com";
        const response = await register(fastify, user.nickname, user.email, user.password);
        accessToken = JSON.parse(response.payload).accessToken;
        refreshToken = response.cookies.find(cookie => cookie.name === 'refreshToken').value;
    });

    it('GET /profile', async (t) => { await checkProtectedSSR('/profile', accessToken, refreshToken, t) });
    it('GET /profile/:nickname', async (t) => { await checkProtectedSSR('/profile/protected', accessToken, refreshToken, t) });
    it('GET /friends', async (t) => { await checkProtectedSSR('/friends', accessToken, refreshToken, t) });
    it('GET /update', async (t) => { await checkProtectedSSR('/update', accessToken, refreshToken, t) });
});

describe('Routes - negative tests', async () => {
    let accessToken;
    let refreshToken;

    before(async () => {
        await clearTestDatabase();
        fastify = await buildApp(false);
        const user = new User("negativeView", "zaq1@WSX");
        user.email = "negativeView@test.com";
        const response = await register(fastify, user.nickname, user.email, user.password);
        accessToken = JSON.parse(response.payload).accessToken;
        refreshToken = response.cookies.find(cookie => cookie.name === 'refreshToken').value;
    });

    it('GET /2fa - no 2FA token', async (t) => { await checkNegativeSSR('/2fa', accessToken, refreshToken, StatusCodes.UNAUTHORIZED, t) });
    it('GET unknown route', async (t) => { await checkNegativeSSR('/unknown', accessToken, refreshToken, StatusCodes.NOT_FOUND, t) });
    it('GET /login - already logged in', async (t) => { await checkNegativeSSR('/login', accessToken, refreshToken, StatusCodes.FORBIDDEN, t) });
    it('GET /register - already logged in', async (t) => { await checkNegativeSSR('/register', accessToken, refreshToken, StatusCodes.FORBIDDEN, t) });

    it('GET /profile - invalid accessToken', async (t) => { await checkNegativeSSR('/profile', 'some random string', refreshToken, StatusCodes.UNAUTHORIZED, t) });
    it('GET /profile/:nickname - invalid accessToken', async (t) => { await checkNegativeSSR('/profile/negativeView', 'some random string', refreshToken, StatusCodes.UNAUTHORIZED, t) });
    it('GET /friends - invalid accessToken', async (t) => { await checkNegativeSSR('/friends', 'some random string', refreshToken, StatusCodes.UNAUTHORIZED, t) });
    it('GET /update - invalid accessToken', async (t) => { await checkNegativeSSR('/update', 'some random string', refreshToken, StatusCodes.UNAUTHORIZED, t) });

    it('GET /profile - missing refreshToken', async (t) => { await checkNegativeSSR('/profile', accessToken, '', StatusCodes.UNAUTHORIZED, t) });
    it('GET /profile/:nickname - missing refreshToken', async (t) => { await checkNegativeSSR('/profile/negativeView', accessToken, '', StatusCodes.UNAUTHORIZED, t) });
    it('GET /friends - missing refreshToken', async (t) => { await checkNegativeSSR('/friends', accessToken, '', StatusCodes.UNAUTHORIZED, t) });
    it('GET /update - missing refreshToken', async (t) => { await checkNegativeSSR('/update', accessToken, '', StatusCodes.UNAUTHORIZED, t) });
});

async function checkSSR(endpoint, t) {
    const response = await fastify.inject({
        method: 'GET',
        url: endpoint
    });
    assert.strictEqual(response.statusCode, StatusCodes.OK);
    assert.strictEqual(response.payload.startsWith('<!DOCTYPE html><html><head>'), true, "Does not contain full HTML");
}

async function checkProtectedSSR(endpoint, accessToken, refreshToken, t) {
    const response = await fastify.inject({
        method: 'GET',
        url: endpoint,
        headers: {
            Authorization: 'Bearer ' + accessToken
        },
        cookies: {
            refreshToken: refreshToken
        }
    });
    assert.strictEqual(response.statusCode, StatusCodes.OK);
    assert.strictEqual(response.payload.startsWith('<!DOCTYPE html><html><head>'), true, "Does not contain full HTML");
}

async function checkNegativeSSR(endpoint, accessToken, refreshToken, expectedCode, t) {
    const response = await fastify.inject({
        method: 'GET',
        url: endpoint,
        headers: {
            Authorization: 'Bearer ' + accessToken
        },
        cookies: {
            refreshToken: refreshToken
        }
    });
    assert.strictEqual(response.statusCode, expectedCode);
    assert.strictEqual(response.payload.startsWith('<!DOCTYPE html><html><head>'), true, "Does not contain full HTML of the error page");
}