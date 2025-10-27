// File: backend/routes/tournamentRoutes.js

import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../utils/error.js";
import { createTournament, recordMatchResult, getTournament } from "../controllers/tournaments/tournaments.js";
import { errorHandler } from "./friendsRoutes.js";
import { getUserSession } from "../controllers/view/viewUtils.js";

// Schema for creating a tournament (array of aliases)
const createSchema = {
    body: {
        type: 'object',
        properties: { players: { type: 'array', items: { type: 'string' } } },
        required: ['players'],
        additionalProperties: false
    }
};

// Schema for posting a match result
// ^^^^^ TRDM ^^^^^  backend/routes/tournamentRoutes.js
const resultSchema = {
    body: {
      type: 'object',
      properties: {
        matchId: { type: 'integer' },
        winnerId: { type: ['integer', 'null'] },
        winnerAlias: { type: ['string', 'null'] }
      },
      required: ['matchId'],
      additionalProperties: false
    }
  };

// Pre-handler to attach user session to request
async function attachUserSession(request, reply) {
    const user = await getUserSession(this, request.cookies.refreshToken, request.headers);
    request.currentUser = user || null;
}
  
export default async function tournamentRoutes (fastify, options) {
    fastify.setErrorHandler(errorHandler);
    // Create new tournament
    fastify.post('/api/tournaments', { 
        schema: createSchema,
        preHandler: attachUserSession
    }, createTournament);
    // Record a match result
    fastify.post('/api/tournaments/:id/match', { 
        schema: resultSchema,
        preHandler: attachUserSession
    }, recordMatchResult);
    // Get tournament state (players and matches)
    fastify.get('/api/tournaments/:id', getTournament);
}
