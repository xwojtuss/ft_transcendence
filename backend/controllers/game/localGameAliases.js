import { StatusCodes } from "http-status-codes";
import HTTPError from "../../utils/error.js";
import z from "zod";

// Alias validation schema (same as nickname)
const aliasSchema = z
    .string()
    .min(4, "Alias must have at least 4 characters")
    .max(12, "Alias must have at most 12 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Alias can only contain letters, numbers, and underscores");

/**
 * Validate and register aliases for local games
 * POST /api/game/local/aliases
 */
export async function registerLocalGameAliases(req, reply) {
    const { aliases, gameMode } = req.body;
    const loggedInUser = req.currentUser;
    
    // Validate game mode
    if (!['local', 'ai'].includes(gameMode)) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Invalid game mode");
    }
    
    // Validate player count
    const expectedCount = gameMode === 'ai' ? 1 : 2;
    if (!Array.isArray(aliases) || aliases.length !== expectedCount) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, `Expected ${expectedCount} alias(es)`);
    }
    
    // If user is logged in, first alias MUST be their nickname
    if (loggedInUser) {
        if (aliases[0] !== loggedInUser.nickname) {
            throw new HTTPError(StatusCodes.FORBIDDEN, "Cannot modify your own nickname");
        }
    }
    
    // Validate each alias
    for (let i = 0; i < aliases.length; i++) {
        const alias = aliases[i];
        
        // Skip validation for logged-in user's nickname (already validated)
        if (loggedInUser && i === 0) {
            continue;
        }
        
        try {
            aliasSchema.parse(alias);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new HTTPError(StatusCodes.BAD_REQUEST, `Alias ${i + 1}: ${error.errors[0].message}`);
            }
            throw error;
        }
    }
    
    // Check for duplicate aliases
    const uniqueAliases = new Set(aliases.map(a => a.toLowerCase()));
    if (uniqueAliases.size !== aliases.length) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Aliases must be unique");
    }
    
    // Return success with validated aliases
    return reply.send({ 
        success: true, 
        aliases: aliases,
        userId: loggedInUser ? loggedInUser.id : null
    });
}

/**
 * Validate and register aliases for tournament
 * POST /api/game/tournament/aliases
 */
export async function registerTournamentAliases(req, reply) {
    const { aliases } = req.body;
    const loggedInUser = req.currentUser;
    
    // Validate player count
    if (!Array.isArray(aliases) || ![4, 8].includes(aliases.length)) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Tournament must have 4 or 8 players");
    }
    
    // If user is logged in, first alias MUST be their nickname
    if (loggedInUser) {
        if (aliases[0] !== loggedInUser.nickname) {
            throw new HTTPError(StatusCodes.FORBIDDEN, "Cannot modify your own nickname");
        }
    }
    
    // Validate each alias
    for (let i = 0; i < aliases.length; i++) {
        const alias = aliases[i];
        
        // Skip validation for logged-in user's nickname (already validated)
        if (loggedInUser && i === 0) {
            continue;
        }
        
        try {
            aliasSchema.parse(alias);
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new HTTPError(StatusCodes.BAD_REQUEST, `Alias ${i + 1}: ${error.errors[0].message}`);
            }
            throw error;
        }
    }
    
    // Check for duplicate aliases
    const uniqueAliases = new Set(aliases.map(a => a.toLowerCase()));
    if (uniqueAliases.size !== aliases.length) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Aliases must be unique");
    }
    
    // Return success with validated aliases
    return reply.send({ 
        success: true, 
        aliases: aliases,
        userId: loggedInUser ? loggedInUser.id : null
    });
}
