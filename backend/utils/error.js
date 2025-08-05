import { cheerio } from '../server.js';
import fs from 'fs/promises';

// Cache the error.html template at module load time
let cachedErrorHtmlPromise = fs.readFile('./backend/views/error.html', 'utf8');

export default async function getErrorPage(statusCode, description) {
    const cachedErrorHtml = await cachedErrorHtmlPromise;
    const errorPage = cheerio.load(cachedErrorHtml, null, false);

    errorPage('p.error-name').text(statusCode + ' Error');
    errorPage('span.error-description').text(description);
    errorPage('.error-wrapper img').attr('src', 'https://http.cat/' + statusCode + '.jpg');

    return errorPage.html();
}