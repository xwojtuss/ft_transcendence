import { loginHandler, refreshAccessToken } from "./authenticate.js";
import { accessToken } from "./authenticate.js";
import formPasswordVisibility from "./login-register-form.js";

const app: HTMLElement | null = document.getElementById('app');
const navigation: HTMLElement | null = document.getElementById('navigation');

// to make the <a> links render different views in <main>
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (!target)
        return;
    if (target.tagName === 'A') {
        const href: string | null = target.getAttribute('href');
        if (href) {
            e.preventDefault();
            renderPage(href, false);
        }
    }
})

// to make the back and forward buttons function
window.addEventListener('popstate', handleRouteChange);

// change the nav bar style on load
changeActiveStyle();

/**
 * Render the view or the whole document
 * @param pathURL the path to the view e.g. /login
 * @param requestNavBar whether to also refresh the nav bar
 * @returns
 */
export async function renderPage(pathURL: string, requestNavBar: boolean) {
    if (!app)
        return;
    if ((pathURL === '/login' || pathURL === '/register') && accessToken !== null)
        return renderPage('/', true);
    try {
        const response = await fetch(`${pathURL}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Partial-Load': 'true',
                'X-Request-Navigation-Bar': `${requestNavBar}`
            }
        });
        if (response.status === 400) {// bad request e.g. to /login if user is logged in already
            return renderPage('/', true);
        } else if (response.status === 401) {// unauthorized e.g. to a /profile if the user is not logged in
            if (await refreshAccessToken() === false) {
                return renderPage('/login', true);
            } else {
                return renderPage(pathURL, requestNavBar);
            }
        }
        let view: string;
        if (requestNavBar && navigation) {
            const jsonHTML = await response.json();
            view = jsonHTML.app;
            navigation.innerHTML = jsonHTML.nav;
        } else {
            view = await response.text();
        }
        app.innerHTML = view;
        const newUrl = new URL(pathURL, window.location.origin).pathname;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({}, '', newUrl);
        }
    } catch (error) {
        console.error(error);
    }
    changeActiveStyle(pathURL);
    switch (pathURL) {
        case '/login':
            await loginHandler();
            formPasswordVisibility();
            break;
        case '/register':
            formPasswordVisibility();
            break;
        default:
            break;
    }
}

/**
 * Render the view of window.location.pathname
 */
async function handleRouteChange() {
    await renderPage(window.location.pathname, true);
}

/**
 * Change the style of the nav bar buttons
 * @param pathURL path to find in the href attr in <a>
 */
function changeActiveStyle(pathURL?: string) {
    const path: string = pathURL || window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}
