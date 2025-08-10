import { checkAuthHeader, checkRefreshToken } from "../controllers/authControllers.js";
import { getView, getProfile } from "../controllers/viewControllers.js";
import HTTPError from "../utils/error.js";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import fs from "fs/promises";
import { cheerio } from "../server.js";

const loggedInNavBarPromise = fs.readFile('./backend/navigation/loggedIn.html');
const notLoggedInNavBarPromise = fs.readFile('./backend/navigation/notLoggedIn.html');
const indexPromise = fs.readFile('./backend/index.html');

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
        if (refreshToken && headers['X-Partial-Load']) {
            payload = await checkAuthHeader(fastify, headers['authorization']);
            if (!payload || !payload.nickname)
                return null;
            return payload.nickname;
        } else if (refreshToken) {
            payload = await checkRefreshToken(fastify, headers['authorization']);
            if (!payload || !payload.nickname)
                return null;
            return payload.nickname;
        }
    } catch (error) {
        return null;
    }
}

//  if the X-Partial-Load header is present
//      load the index.html
//  else
//      load only the document
//  if there is a log-in state change
//      add the correct nav bar
//  get the view
//  add the view
//  return the html (a full document, a header with main, or just main)
export default async function viewsRoutes(fastify) {
    // for non-dynamic sites: login, register
    fastify.get("/login", async (request, reply) => {
        let view;
        const nickname = getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getView('login');
            return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
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
        const nickname = getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getProfile(request.params.login);
            return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
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
        const nickname = getUserSession(fastify, request.cookies.refreshToken, request.headers);
        try {
            view = await getView('');
            return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], nickname ? true : false, false));
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

async function prepareHTML(viewHTML, XPartialLoadHeader, isLoggedIn, appendNavBar) {
    console.log(XPartialLoadHeader)
    if (!XPartialLoadHeader || XPartialLoadHeader === 'false') {
        const index = cheerio.load(await indexPromise);
        index('header').html(isLoggedIn ? await loggedInNavBarPromise : await notLoggedInNavBarPromise);
        index('main#app').html(viewHTML);
        return index.html();
    } else if (appendNavBar) {
        viewHTML += isLoggedIn ? await loggedInNavBarPromise : await notLoggedInNavBarPromise;
    }
    return viewHTML;
}
