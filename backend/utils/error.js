import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

export default async function getErrorPage(statusCode) {
    const errorPage = cheerio.load(await fs.readFile('./backend/views/error.html'));

    errorPage('p.error-name').text(statusCode + ' Error');
    errorPage('span.error-description').text(ReasonPhrases[statusCode]);
    errorPage('.error-wrapper img').attr('src', 'https://http.cat/' + statusCode + '.jpg');

    return errorPage('.app-wrapper-center').prop('outerHTML');
}