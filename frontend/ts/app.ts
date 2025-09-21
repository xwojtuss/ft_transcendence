import changePasswordButton from "./login-register-form.js";
import { initLocalGame } from "./localGame.js";
import { loginHandler, registerHandler, refreshAccessToken, updateSubmitHandler, update2FASubmitHandler } from "./authenticate.js";
import { accessToken, tfaTempToken } from "./authenticate.js";
import formPasswordVisibility from "./login-register-form.js";
import { profileHandler, update2FAHandler, updateHandler } from "./userProfile.js";
import { run } from "node:test";

const app: HTMLElement | null = document.getElementById('app');
const navigation: HTMLElement | null = document.getElementById('navigation');

// to make the <a> links render different views in <main>
document.addEventListener('click', (e) => {
    const target: EventTarget | null = e.target;

    if (!target || !(target instanceof HTMLElement)) return;
    if (target.tagName === 'A') {
        const href: string | null = target.getAttribute('href');
        if (href) {
            e.preventDefault();
            renderPage(href, false);
        }
    }
});

// to make the back and forward buttons function
window.addEventListener('popstate', handleRouteChange);

// change the nav bar style on load
changeActiveStyle();

// make the page functional
runHandlers(window.location.pathname);

async function runHandlers(pathURL: string): Promise<void> {
    switch (pathURL) {
        case '/login':
            await loginHandler();
            formPasswordVisibility();
            break;
        case '/register':
            await registerHandler();
            formPasswordVisibility();
            break;
        case '/profile':
            await profileHandler();
            break;
        case '/update':
            updateHandler();
            await updateSubmitHandler();
            break;
        case '/2fa':
            update2FAHandler();
            await update2FASubmitHandler();
            break;
        default:
            if (pathURL.startsWith('/profile/')) {
                await profileHandler();
                break;
            }
            break;
    }
}

function runChosenGame(pathURL: string): void {
    switch (pathURL) {
        case '/game/local':
            initLocalGame();
            break;
        case '/game/online':
            // add initialization for online game mode
            break;
        case '/game/multiplayer':
            // add initialization for multiplayer game mode
            break;
        case '/game/local-tournament':
            // add initialization for local tournament game mode
            break;
        case '/game/online-tournament':
            // add initialization for online tournament game mode
            break;
        default:
            return;
    }
}

/**
 * Render the view or the whole document
 * @param pathURL the path to the view e.g. /login
 * @param requestNavBar whether to also refresh the nav bar
 * @returns
 */
export async function renderPage(pathURL: string, requestNavBar: boolean): Promise<void> {
    if (!app)
        return;
    if ((pathURL === '/login' || pathURL === '/register') && accessToken !== null)
        return renderPage('/', true);
    try {
        const response: Response = await fetch(`${pathURL}`, {
            headers: {
                Authorization: `Bearer ${tfaTempToken || accessToken}`,
                'X-Partial-Load': 'true',
                'X-Request-Navigation-Bar': `${requestNavBar}`
            }
        });
        switch (response.status) {
            case 400:// bad request
                alert((await response.json()).message);
                break;
            case 401:// unauthorized
                // e.g. to a /profile if the user is not logged in
                if (await refreshAccessToken() === false) {
                    return renderPage('/login', true);
                }
                return renderPage(pathURL, requestNavBar);
            case 403:// forbidden
                // e.g. to /login if user is logged in already
                return renderPage('/', true);
            default:
                break;
        }
        let view: string;
        if (requestNavBar && navigation) {
            const jsonHTML: { nav: string, app: string } = await response.json();
            view = jsonHTML.app;
            navigation.innerHTML = DOMPurify.sanitize(jsonHTML.nav);
        } else {
            view = await response.text();
        }
        app.innerHTML = DOMPurify.sanitize(view);

        if (pathURL === '/' || pathURL === '/home') {
            initGameModesRouter();
        }

        const newUrl: string = new URL(pathURL, window.location.origin).pathname;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({}, '', newUrl);
        }
        
        runChosenGame(pathURL);
    } catch (error) {
        console.error(error);
    }
    changeActiveStyle(pathURL);
    await runHandlers(pathURL);
}

/**
 * Render the view of window.location.pathname
 */
async function handleRouteChange(): Promise<void> {
    await renderPage(window.location.pathname, true);
}

/**
 * Change the style of the nav bar buttons
 * @param pathURL path to find in the href attr in <a>
 */
function changeActiveStyle(pathURL?: string): void {
    const path: string = pathURL || window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}

function initGameModesRouter() {
    document.querySelectorAll('.game-tile').forEach(tile => {
        tile.addEventListener('click', function (e) {
            e.preventDefault();
            const href = tile.getAttribute('data-href');
            if (href) {
                renderPage(href, false);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/' || window.location.pathname === '/home') {
        initGameModesRouter();
    }
    runChosenGame(window.location.pathname);
});