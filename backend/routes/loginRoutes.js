import { StatusCodes } from "http-status-codes";
import { getUser } from "../db/dbQuery.js";
import getErrorPage from "../utils/error.js";

export default async function loginRoutes(fastify) {
    fastify.post('/api/login', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    login: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['login', 'password'],
                additionalProperties: false
            }
        },
        handler: async (req, reply) => {
            try {
                const user = await getUser(req.body.login);
                if (user === null || await user.validatePassword(req.body.password) == false) {

                    // will return 404 or something to indicate wrong password or user does not exist
                    return reply.code(StatusCodes.NOT_FOUND).type('text/html').send(await getErrorPage(StatusCodes.NOT_FOUND, 'Requested resource does not exist.'));
                }
                // generate jwt token
                return reply.code(StatusCodes.OK).type('text/html').send(await getErrorPage(StatusCodes.CONFLICT, 'Logged in successfully!!!!.'));
            } catch (error) {
                console.error(error);
            }
        }
    });
}