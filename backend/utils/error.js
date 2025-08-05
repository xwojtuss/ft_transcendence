import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

// Cache the error.html template at module load time
let cachedErrorHtmlPromise = fs.readFile('./backend/views/error.html', 'utf8');

export default async function getErrorPage(statusCode, description) {
    const cachedErrorHtml = await cachedErrorHtmlPromise;
    const errorPage = cheerio.load(cachedErrorHtml);

    errorPage('p.error-name').text(statusCode + ' Error');
    errorPage('span.error-description').text(description);
    errorPage('.error-wrapper img').attr('src', 'https://http.cat/' + statusCode + '.jpg');

    return errorPage('.app-wrapper-center').prop('outerHTML');
}