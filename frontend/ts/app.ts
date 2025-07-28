const app: HTMLElement | null = document.getElementById('app');

async function renderPage(pathURL: string) {
    if (!app)
        return;
    try {
        const safePath = pathURL.replace(/^\/+/, '');
        const response = await fetch(`/api/view/${safePath}`);
        if (!response.ok)
            throw new Error("Failed to load view");
        const view = await response.text();
        app.innerHTML = view;
        const newUrl = new URL(pathURL, window.location.origin).pathname;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({}, '', newUrl);
        }
        console.log(newUrl);
    } catch (error) {
        console.error(error);
        app.innerHTML = `<p>Error loading page: ${error}</p>`;
    }
}

function handleRouteChange() {
    renderPage(window.location.pathname);
}

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (!target)
        return;
    if (target.tagName === 'A') {
        const href: string | null = target.getAttribute('href');
        if (href) {
            e.preventDefault();
            renderPage(href);
        }
    }
})

window.addEventListener('popstate', handleRouteChange);

handleRouteChange();
