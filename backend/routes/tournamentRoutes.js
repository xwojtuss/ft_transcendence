// File: backend/routes/tournamentRoutes.js

import { ReasonPhrases, StatusCodes } from "http-status-codes";
import HTTPError from "../utils/error.js";
import { createTournament, recordMatchResult, getTournament } from "../controllers/tournaments/tournaments.js";

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
  
  

export default async function tournamentRoutes (fastify, options) {
    // Create new tournament
    fastify.post('/api/tournaments', { schema: createSchema }, createTournament);
    // Record a match result
    fastify.post('/api/tournaments/:id/match', { schema: resultSchema }, recordMatchResult);
    // Get tournament state (players and matches)
    fastify.get('/api/tournaments/:id', getTournament);
}
