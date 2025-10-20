import fs from "fs/promises";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../../utils/error.js";
import { checkAuthHeader, checkRefreshToken } from "../auth/authUtils.js";
import { cheerio } from "../../buildApp.js";
import { getUserById } from "../../db/dbQuery.js";


const allowedNames = new Set([
    "login", "register", "home",
    "local-game", "local-tournament",
    "tic-tac-toe"
]);


const loggedInNavBarPromise = fs.readFile('./backend/navigation/loggedIn.html', "utf-8");
const notLoggedInNavBarPromise = fs.readFile('./backend/navigation/notLoggedIn.html', "utf-8");
const indexPromise = fs.readFile('./backend/index.html', "utf-8");

/**
 * Wrapps the HTML of a view if this is the first load, appends the nav bar if needed
 * @param {string} viewHTML the view HTML rendered to a string
 * @param {string} XPartialLoadHeader the x-partial-load header
 * @param {boolean} isLoggedIn whether the user is logged in
 * @param {boolean} appendNavBar whether to also include the nav bar to refresh it
 * @returns {Promise<string | { nav: string, app: string }>} the view HTML, document HTML or the view with nav bar in JSON
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

/**
 * Sends the complete view
 * @param {string} view HTML for the view
 * @param {any} isLoggedIn any data type that if assigned means the user is logged in
 * @param {*} request the request
 * @param {*} reply the reply
 * @returns 
 */
export async function sendView(view, isLoggedIn, request, reply) {
    if (request.headers['x-request-navigation-bar'] === 'true') {
        return reply.send(await prepareHTML(view, request.headers['x-partial-load'], isLoggedIn ? true : false, true));
    } else {
        return reply.type('text/html').send(await prepareHTML(view, request.headers['x-partial-load'], isLoggedIn ? true : false, false));
    }
}

/**
 * Sends the error page and wraps it if needed
 * @param {*} error the error instance
 * @param {*} isLoggedIn any data type that if assigned means the user is logged in
 * @param {*} request the request
 * @param {*} reply the reply
 * @returns 
 */
export async function sendErrorPage(error, isLoggedIn, request, reply) {
    let errorPage;

    if (error instanceof HTTPError) {
        errorPage = await error.getErrorPage();
    } else {
        errorPage = await (new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR).getErrorPage());
    }
    reply.status(error.code || StatusCodes.INTERNAL_SERVER_ERROR);
    return await sendView(errorPage, isLoggedIn, request, reply);
}

/**
 * Get the user session information from the access or refresh token
 * @param {*} fastify the fastify instance
 * @param {string} refreshToken the refresh token
 * @param {*} headers headers from the request
 * @returns {Promise<User | null>} returns the user nickname if logged in
 */
export async function getUserSession(fastify, refreshToken, headers) {
    try {
        const refreshPayload = await checkRefreshToken(fastify, refreshToken);
        if (!refreshPayload || !refreshPayload.id) return null;
        const refreshUser = await getUserById(refreshPayload.id);
        if (!refreshUser) return null;
        if (headers['x-partial-load'] === undefined && (!headers['authorization'] || headers['authorization'] === 'Bearer null')) {
            return refreshUser;
        }
        const accessPayload = await checkAuthHeader(fastify, headers['authorization']);
        if (!accessPayload || !accessPayload.id || accessPayload.id !== refreshPayload.id) return null;
        const accessUser = await getUserById(accessPayload.id);
        if (!accessUser) return null;
        return accessUser;
    } catch (error) {
        return null;
    }
}

/**
 * Tries to get the 'forced' user session, meaning this function checks only the refresh token
 * So this function is not safe to authorize the user in any way
 * This is only good for places where we want to check if the user is logged in without refreshing the access token
 * @param {*} fastify The fastify instance
 * @param {string} refreshToken the refresh token
 * @returns {Promise<User | null>} returns the user nickname if logged in
 */
export async function getForcedUserSession(fastify, refreshToken) {
    try {
        const refreshPayload = await checkRefreshToken(fastify, refreshToken);
        if (!refreshPayload || !refreshPayload.id) return null;
        const refreshUser = await getUserById(refreshPayload.id);
        if (!refreshUser) return null;
        return refreshUser;
    } catch (error) {
        return null;
    }
}

/**
 * Gets the static views e.g. login
 * @param {string} name Name of the view to get
 * @returns {Promise<string>} The rendered static view
 * @throws {HTTPError} NOT_FOUND if the view was not found, INTERNAL_SERVER_ERROR when there has been an Error thrown
 */
export async function getStaticView(name) {
    if (allowedNames.has(name) === false)
        throw new HTTPError(StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND);
    try {
        return await fs.readFile(`./backend/views/${name}.html`, "utf-8");
    } catch (error) {
        throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
}
