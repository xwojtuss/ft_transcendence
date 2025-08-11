import { checkAuthHeader, checkRefreshToken } from "../controllers/authControllers.js";
import { getView, getProfile } from "../controllers/viewControllers.js";
import HTTPError from "../utils/error.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import fs from "fs/promises";
import { cheerio } from "../server.js";

const loggedInNavBarPromise = fs.readFile('./backend/navigation/loggedIn.html', "utf-8");
const notLoggedInNavBarPromise = fs.readFile('./backend/navigation/notLoggedIn.html', "utf-8");
const indexPromise = fs.readFile('./backend/index.html', "utf-8");

/**
 * Get the user session information from the access or refresh token
 * @param {*} fastify the fastify instance
 * @param {string} refreshToken the refresh token
 * @param {*} headers headers from the request
 * @returns {Promise<string> | Promise<null>} returns the user nickname if logged in
 */
async function getUserSession(fastify, refreshToken, headers) {
    let payload = null;
    try {
        if (refreshToken && headers['x-partial-load']) {
            payload = await checkAuthHeader(fastify, headers['authorization']);
            if (!payload || !payload.nickname)
                return null;
            return payload.nickname;
        } else if (refreshToken) {
            payload = await checkRefreshToken(fastify, refreshToken);
            if (!payload || !payload.nickname)
                return null;
            return payload.nickname;
        }
    } catch (error) {
        return null;
    }
}

/**
 * Register the possible routes
 * @param {*} fastify the fastify instance
 */
export default async function viewsRoutes(fastify) {
    // for non-dynamic sites: login, register
    fastify.get("/login", async (request, reply) => {
        let view;
        const nickname = await getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getView('login');
            if (request.headers['x-request-navigation-bar'] === 'true') {
                return reply.send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, true));
            } else {
                return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
            }
        } catch (error) {
            if (error instanceof HTTPError) {
                return reply.type('text/html').send(await error.getErrorPage());
            } else {
                console.error(error);
                return reply.type('text/html').send(await new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR).getErrorPage());
            }
        }
    });
    fastify.get("/profile/:login", async (request, reply) => {
        let view;
        const nickname = await getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getProfile(request.params.login);
            if (request.headers['x-request-navigation-bar'] === 'true') {
                return reply.send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, true));
            } else {
                return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
            }
            
        } catch (error) {
            if (error instanceof HTTPError) {
                return reply.type('text/html').send(await error.getErrorPage());
            } else {
                console.error(error);
                return reply.type('text/html').send(await new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR).getErrorPage());
            }
        }
    });
    fastify.setNotFoundHandler(async (request, reply) => {
        let view;
        const nickname = await getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getView('');
            if (request.headers['x-request-navigation-bar'] === 'true') {
                return reply.send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, true));
            } else {
                return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
            }
        } catch (error) {
            if (error instanceof HTTPError) {
                return reply.type('text/html').send(await error.getErrorPage());
            } else {
                console.error(error);
                return reply.type('text/html').send(await new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR).getErrorPage());
            }
        }
    });
}

/**
 * Wrapps the HTML of a view if this is the first load, appends the nav bar if needed
 * @param {string} viewHTML the view HTML rendered to a string
 * @param {string} XPartialLoadHeader the x-partial-load header
 * @param {boolean} isLoggedIn whether the user is logged in
 * @param {boolean} appendNavBar whether to also include the nav bar to refresh it
 * @returns the view HTML, document HTML or the view with nav bar in JSON
 */
async function prepareHTML(viewHTML, XPartialLoadHeader, isLoggedIn, appendNavBar) {
    if (!XPartialLoadHeader || XPartialLoadHeader === 'false') {
        const index = cheerio.load(await indexPromise);
        index('header#navigation').html(isLoggedIn ? await loggedInNavBarPromise : await notLoggedInNavBarPromise);
        index('main#app').html(viewHTML);
        return index.html();
    } else if (appendNavBar) {
        return {
            nav: isLoggedIn ? await loggedInNavBarPromise : await notLoggedInNavBarPromise,
            app: viewHTML
        };
    }
    return viewHTML;
}
