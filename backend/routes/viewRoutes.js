import { check2FAHeader } from "../controllers/authControllers.js";
import { get2FAview } from "../controllers/2faView.js";
import { getUpdate } from "../controllers/updateView.js";
import { getProfile } from "../controllers/profileView.js";
import { getFriendsView } from "../controllers/friendsView.js";
import { getUserSession, sendErrorPage, getStaticView, sendView } from "../controllers/viewControllers.js";
import HTTPError from "../utils/error.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getUserById } from "../db/dbQuery.js";

async function loggedInPreHandler(req, reply) {
    try {
        const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
        if (!user) {
            throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        }
        req.currentUser = user;
    } catch (error) {
        return await viewsErrorHandler(error, req, reply);
    }
}

async function loggedOutPreHandler(req, reply) {
    const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
    try {
        if (user) throw new HTTPError(StatusCodes.FORBIDDEN, ReasonPhrases.FORBIDDEN);
        req.currentUser = null;
    } catch (error) {
        return await viewsErrorHandler(error, req, reply);
    }
}

async function loggedInOrOutPreHandler(req, reply) {
    const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
    req.currentUser = user ? user : null;
}

async function viewsErrorHandler(error, req, reply) {
    console.error(error);
    if (error instanceof HTTPError) {
        return reply.status(error.code).send(await error.getErrorPage());
    }
    return await sendErrorPage(error, req.cookies.refreshToken, req, reply);
}

/**
 * Register the possible routes
 * @param {*} fastify the fastify instance
 */
export default async function viewsRoutes(fastify) {
    fastify.setErrorHandler(viewsErrorHandler);
    fastify.get("/", { preHandler: loggedInOrOutPreHandler }, async (request, reply) => {
        const view = await getStaticView('home');
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/login", { preHandler: loggedOutPreHandler }, async (request, reply) => {
        const view = await getStaticView('login');
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/register", { preHandler: loggedOutPreHandler }, async (request, reply) => {
        const view = await getStaticView('register');
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/profile", { preHandler: loggedInPreHandler }, async (request, reply) => {
        const view = await getProfile(request.currentUser.nickname, request.currentUser.nickname);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/profile/:login", { preHandler: loggedInPreHandler }, async (request, reply) => {
        const view = await getProfile(request.currentUser.nickname, request.params.login);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/update", { preHandler: loggedInPreHandler }, async (request, reply) => {
        const view = await getUpdate(request.currentUser.nickname);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/2fa", async (request, reply) => {
        const payload = await check2FAHeader(fastify, request.headers['authorization']);
        const user = await getUserById(payload.id);
        if (!user) throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        const view = await get2FAview(payload, user.nickname);
        return await sendView(view, payload, request, reply);
    });

    fastify.get("/friends", { preHandler: loggedInPreHandler }, async (request, reply) => {
        const view = await getFriendsView(request.currentUser.id);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.setNotFoundHandler(async (request, reply) => {
        await loggedInOrOutPreHandler(request, reply);
        const view = await getStaticView('home');
        return await sendView(view, request.currentUser, request, reply);
    });
}

