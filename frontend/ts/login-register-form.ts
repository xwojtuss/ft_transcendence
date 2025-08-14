/**
 * Sets up the listeners for the change password visibility buttons
 * @returns
 */
export default function formPasswordVisibility() {
    const passwordField = document.getElementById('password-input') as HTMLInputElement;
    if (!passwordField) {
        return;
    }
    document.querySelectorAll('img.toggle-password-visibility').forEach(element => {
        const imageElement = element as HTMLImageElement;
        if (!imageElement) {
            return;
        }
        imageElement.addEventListener('click', (e) => {
            e.preventDefault();
            if (imageElement.classList.contains('button-on')) {
                imageElement.classList.remove('button-on');
                imageElement.src = 'https://img.icons8.com/material-outlined/24/visible--v1.png';
                imageElement.alt = 'Show password';
                passwordField.type = 'password';
            } else {
                imageElement.classList.add('button-on');
                imageElement.src = 'https://img.icons8.com/material-outlined/24/hide.png';
                imageElement.alt = 'Hide password';
                passwordField.type = 'text';
            }
        });
    })
}
