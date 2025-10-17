import { check2FAHeader, checkRefreshToken } from "../controllers/auth/authUtils.js";
import { get2FAview } from "../controllers/view/2fa.js";
import { getUpdate } from "../controllers/view/update.js";
import { getProfile } from "../controllers/view/profile.js";
import { getFriendsView } from "../controllers/view/friends.js";
import { getUserSession, sendErrorPage, getStaticView, sendView, getForcedUserSession } from "../controllers/view/viewUtils.js";
import { getAliasRegistrationHTML } from "../controllers/view/aliasRegistration.js";
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
        if (user || req.cookies.refreshToken) throw new HTTPError(StatusCodes.FORBIDDEN, ReasonPhrases.FORBIDDEN);
        req.currentUser = null;
    } catch (error) {
        return await viewsErrorHandler(error, req, reply);
    }
}

export async function loggedInOrOutPreHandler(req, reply) {
    const user = await getUserSession(this, req.cookies.refreshToken, req.headers);
    req.currentUser = user ? user : null;
}

export async function forcedLoggedInOrOutPreHandler(req, reply) {
    const user = await getForcedUserSession(this, req.cookies.refreshToken);
    req.currentUser = user ? user : null;
}

export async function viewsErrorHandler(error, req, reply) {
    if (!(error instanceof HTTPError)) {
        console.error(error);
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

    fastify.get("/2fa", { preHandler: loggedInOrOutPreHandler }, async (request, reply) => {
        let payload;
        try {
            payload = await check2FAHeader(request.server, request.headers['authorization']);
        } catch (error) {
            if (request.currentUser) throw new HTTPError(StatusCodes.FORBIDDEN, ReasonPhrases.FORBIDDEN);
            throw error;
        }
        const user = await getUserById(payload.id);
        if (!user) throw new HTTPError(StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
        const view = await get2FAview(payload, user.nickname);
        return await sendView(view, payload, request, reply);
    });

    fastify.get("/game/local", { preHandler: forcedLoggedInOrOutPreHandler }, async (request, reply) => {
        // Check if user has registered aliases via query param
        const registered = request.query.registered === 'true';
        const isAI = request.query.ai === '1';
        
        // If registered or coming from tournament (checked on client side), show the game
        if (registered) {
            const view = await getStaticView('local-game');
            return await sendView(view, request.currentUser, request, reply);
        }
        
        // Otherwise, show alias registration form
        const playerCount = isAI ? 1 : 2;
        const gameMode = isAI ? 'ai' : 'local';
        const view = getAliasRegistrationHTML(playerCount, gameMode, request.currentUser);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/game/online", { preHandler: loggedInOrOutPreHandler }, async (request, reply) => {
        const view = await getStaticView('online-game');
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/game/local-tournament", { preHandler: forcedLoggedInOrOutPreHandler }, async (request, reply) => {
        // Check if user is requesting alias registration form
        const playerCount = request.query.players;
        
        if (playerCount && (playerCount === '4' || playerCount === '8')) {
            // Show alias registration form
            const view = getAliasRegistrationHTML(parseInt(playerCount), 'tournament', request.currentUser);
            return await sendView(view, request.currentUser, request, reply);
        }
        
        // Otherwise show the tournament selection view
        const view = await getStaticView('local-tournament');
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.get("/friends", { preHandler: loggedInPreHandler }, async (request, reply) => {
        const view = await getFriendsView(request.currentUser.id);
        return await sendView(view, request.currentUser, request, reply);
    });

    fastify.setNotFoundHandler(async (request, reply) => {
        return await sendErrorPage(new HTTPError(StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND), request.cookies.refreshToken, request, reply);
    });
}

