import { renderPage } from "./app.js";
export let accessToken: string | null = null;

export async function refreshAccessToken() {
    if (accessToken) {
        return;
    }
    const result = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!result.ok) {
        return await renderPage('/login');
    }
    return await result.json();
}

export async function loginSubmitHandler() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        const result = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(data),

        });
        if (result.status === 400) {
            return await renderPage('/');
        } else if (!result.ok) {
            return alert((await result.json()).message);
        }
        accessToken = await result.json();
        return await renderPage('/');
    });
}
