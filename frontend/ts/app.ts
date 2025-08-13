import { loginHandler, refreshAccessToken } from "./authenticate.js";
import { accessToken } from "./authenticate.js";
import formPasswordVisibility from "./login-register-form.js";

const app: HTMLElement | null = document.getElementById('app');
const navigation: HTMLElement | null = document.getElementById('navigation');

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

window.addEventListener('popstate', handleRouteChange);

changeActiveStyle();

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
        if (response.status === 400) {
            console.log('redirecting to /')
            return renderPage('/', true);
        } else if (response.status === 401) {
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
        default:
            break;
    }
}

async function handleRouteChange() {
    await renderPage(window.location.pathname, true);
}

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
