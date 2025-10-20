import { registerLocalGameAliases, registerTournamentAliases } from "../controllers/game/localGameAliases.js";
import { getUserSession } from "../controllers/view/viewUtils.js";
import { errorHandler } from "./friendsRoutes.js";
import { recordTicResult } from "../controllers/game/ticResults.js";

async function attachUserSession(req, reply) {
  req.currentUser = await getUserSession(this, req.cookies.refreshToken, req.headers);
}

/** POST /api/game/tic/result payload schema */
const ticResultSchema = {
  body: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["local", "ai", "matching"] },
      player1: { type: "string" },
      player2: { type: "string" },
      // allow null for ties
      winnerAlias: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] }
    },
    required: ["mode", "player1", "player2", "winnerAlias"],
    additionalProperties: false
  }
};


/** POST /api/game/local/aliases payload schema */
const localAliasSchema = {
  body: {
    type: "object",
    properties: {
      aliases: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
      gameMode: { type: "string", enum: ["local", "ai"] }
    },
    required: ["aliases", "gameMode"],
    additionalProperties: false
  }
};

/** POST /api/game/tournament/aliases payload schema */
const tournamentAliasSchema = {
   body: {
     type: "object",
     properties: {
      game: { type: 'string', enum: ['tictactoe', 'pong'], nullable: true },
       aliases: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8 }
     },
     required: ["aliases"],
     additionalProperties: false
   }
 };


export default async function gameRoutes(fastify, options) {
    fastify.setErrorHandler(errorHandler);
    
    // Pong/Tic alias validation (shared)
    fastify.post(
        "/api/game/local/aliases",
        { schema: localAliasSchema, preHandler: attachUserSession },
        registerLocalGameAliases
    );
    
    // Tournament alias validation
    fastify.post(
        "/api/game/tournament/aliases",
        { schema: tournamentAliasSchema, preHandler: attachUserSession },
        registerTournamentAliases
    );
    
    // Tic-Tac-Toe result logging → match_history + participants
    fastify.post(
        "/api/game/tic/result",
        { schema: ticResultSchema, preHandler: attachUserSession },
        recordTicResult
    );
}

