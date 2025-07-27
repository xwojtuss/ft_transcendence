const app: HTMLElement | null = document.getElementById('app');

function renderPage(path: string) {
    if (!app)
        return;
    switch (path) {
        case '/test':
            app.innerHTML = '<h1>TEST</h1><a href="/">Home</a>';
            break;
        default:
            app.innerHTML = '<h1>HOME</h1><a href="/test">Test</a>';
            break;
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
        e.preventDefault();
        const href: string | null = target.getAttribute('href');
        if (href) {
            window.history.pushState({}, '', href);
            handleRouteChange();
        }
    }
})

window.addEventListener('popstate', handleRouteChange);

handleRouteChange();
