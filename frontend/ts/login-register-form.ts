/**
 * Sets up the listeners for the change password visibility buttons
 * @returns
 */
export default function formPasswordVisibility(): void {
    const passwordField: HTMLElement | null = document.getElementById('password-input');
    if (!passwordField || !(passwordField instanceof HTMLInputElement)) return;
    document.querySelectorAll('img.toggle-password-visibility')?.forEach(element => {
        const imageElement: Element = element;
        if (!imageElement || !(imageElement instanceof HTMLImageElement)) return;
        imageElement.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (imageElement.classList.contains('button-on')) {
                imageElement.src = 'https://img.icons8.com/material-outlined/24/visible--v1.png';
                imageElement.alt = 'Show password';
                passwordField.type = 'password';
            } else {
                imageElement.src = 'https://img.icons8.com/material-outlined/24/hide.png';
                imageElement.alt = 'Hide password';
                passwordField.type = 'text';
            }
            imageElement.classList.toggle('button-on');
        });
    })
}
