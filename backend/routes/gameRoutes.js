import { registerLocalGameAliases, registerTournamentAliases } from "../controllers/game/localGameAliases.js";
import { getUserSession } from "../controllers/view/viewUtils.js";
import { errorHandler } from "./friendsRoutes.js";

// Schema for local game aliases
const localAliasSchema = {
    body: {
        type: 'object',
        properties: {
            aliases: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
            gameMode: { type: 'string', enum: ['local', 'ai'] }
        },
        required: ['aliases', 'gameMode'],
        additionalProperties: false
    }
};

// Schema for tournament aliases
const tournamentAliasSchema = {
    body: {
        type: 'object',
        properties: {
            aliases: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 8 }
        },
        required: ['aliases'],
        additionalProperties: false
    }
};

// Pre-handler to attach user session to request
async function attachUserSession(request, reply) {
    const user = await getUserSession(this, request.cookies.refreshToken, request.headers);
    request.currentUser = user || null;
}

export default async function gameRoutes(fastify, options) {
    fastify.setErrorHandler(errorHandler);
    // Validate and register local game aliases
    fastify.post('/api/game/local/aliases', { 
        schema: localAliasSchema,
        preHandler: attachUserSession
    }, registerLocalGameAliases);
    
    // Validate and register tournament aliases
    fastify.post('/api/game/tournament/aliases', { 
        schema: tournamentAliasSchema,
        preHandler: attachUserSession
    }, registerTournamentAliases);
}
