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
                (inputField as HTMLElement).focus();
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

export function update2FAHandler() {
    const inputs = document.querySelectorAll('form input.digit');

    (inputs[0] as HTMLInputElement)?.focus();
    inputs.forEach((element, key) => {
        const input = element as HTMLInputElement;

        input.addEventListener('input', (e) => {
            e.preventDefault();
            const value = input.value.replace(/[^0-9]/g, '');
            input.value = value;
            if (value && key < inputs.length - 1) {
                (inputs[key + 1] as HTMLElement).focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !(e.currentTarget as HTMLInputElement).value && key > 0) {
                (inputs[key - 1] as HTMLElement).focus();
            }
        });
    });
    document.querySelector('form#tfa-form #cancel-form')?.addEventListener('click', (e) => {
        e.preventDefault();
        return renderPage('/update', false);
    })
}