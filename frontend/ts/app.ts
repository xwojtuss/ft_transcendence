const app: HTMLElement | null = document.getElementById('app');

async function renderPage(pathURL: string) {
    if (!app)
        return;
    try {
        const safePath = pathURL.replace(/[^a-zA-Z0-9-_]/g, '');
        const response = await fetch(`/api/view/${safePath}`);
        if (!response.ok)
            throw new Error((await response.json())['error']);
        const view = await response.text();
        app.innerHTML = view;
        const newUrl = new URL(pathURL, window.location.origin).pathname;
        window.history.pushState({}, '', newUrl);
        changeActiveStyle();
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
changeActiveStyle();

function changeActiveStyle() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}
