import { renderPage } from "./app.js";
import { invalidateAccessToken } from "./authenticate.js";

export async function profileHandler() {
    document.getElementById('edit-profile')?.addEventListener("click", async (e) => {
        e.preventDefault();

        return await renderPage('/update', false);
    });
    document.getElementById('log-out')?.addEventListener("click", async (e) => {
        e.preventDefault();
        invalidateAccessToken();
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        return await renderPage('/', true);
    });
}

export function updateHandler() {
    const image = document.getElementById('preview-avatar') as HTMLImageElement;
    document.querySelectorAll('.edit-field').forEach(element => {
        element.addEventListener('click', (e) => {
            const inputField = element.previousElementSibling;

            if (inputField) {
                inputField.classList.toggle('input-not-allowed');
                inputField.toggleAttribute('disabled');
            }
        });
    });
    document.getElementById('file-input')?.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        if (!image || !input.files || input.files.length === 0) return;

        const blobUrl = URL.createObjectURL(input.files[0]);
        image.src = blobUrl;
        image.onload = () => {
            URL.revokeObjectURL(blobUrl);
        }
    });
    document.querySelector('form#update-form #cancel-form')?.addEventListener('click', (e) => {
        e.preventDefault();
        return renderPage('/profile', false);
    })
}