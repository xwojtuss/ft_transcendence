import { StatusCodes } from "http-status-codes";
import { db } from "../../buildApp.js";  // SQLite database instance
import HTTPError from "../../utils/error.js";

// POST /api/tournaments
export async function createTournament(req, reply) {
    const aliases = req.body.players;
    const loggedInUser = req.currentUser;
    const numPlayers = aliases.length;
    if (![4, 8].includes(numPlayers)) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Only 4 or 8 players allowed");
    }

    // Insert tournament and get its ID, including user_id if logged in
    await db.run("INSERT INTO tournaments (num_players, user_id) VALUES (?, ?)", [numPlayers, loggedInUser ? loggedInUser.id : null]);
    const tour = await db.get("SELECT last_insert_rowid() AS id");
    const tourId = tour.id;

    // Insert each alias into tournament_players
    const playerIds = [];
    for (let i = 0; i < aliases.length; i++) {
        const alias = aliases[i];
        const isLoggedUser = loggedInUser && i === 0; // First player is logged-in user if present
        await db.run(
            "INSERT INTO tournament_players (tournament_id, alias, is_logged_user) VALUES (?, ?, ?)",
            [tourId, alias, isLoggedUser ? 1 : 0]
        );
        const res = await db.get("SELECT last_insert_rowid() AS id");
        playerIds.push(res.id);
    }

    // Shuffle players for random seeding
    for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }

    // Create first-round matches (round 1)
    for (let i = 0; i < playerIds.length; i += 2) {
        const p1 = playerIds[i];
        const p2 = playerIds[i + 1];
        await db.run(
            "INSERT INTO tournament_matches (tournament_id, round, player1_id, player2_id) VALUES (?,?,?,?)",
            [tourId, 1, p1, p2]
        );
    }

    // Fetch matchups to return (join aliases for readability)
    const matches = await db.all(
        `SELECT m.match_id AS matchId,
                p1.alias AS player1,
                p2.alias AS player2
         FROM tournament_matches m
         JOIN tournament_players p1 ON p1.player_id = m.player1_id
         JOIN tournament_players p2 ON p2.player_id = m.player2_id
         WHERE m.tournament_id = ? AND m.round = 1`,
        [tourId]
    );

    return reply.send({ tournamentId: tourId, matches: matches });
}

// POST /api/tournaments/:id/match
export async function recordMatchResult(req, reply) {
    const tourId = parseInt(req.params.id);
    const { matchId, winnerId: bodyWinnerId, winnerAlias } = req.body;

    // Resolve winnerId from alias when needed
    let winnerId = bodyWinnerId || null;
    if (!winnerId && winnerAlias) {
        const row = await db.get(
            "SELECT player_id AS id FROM tournament_players WHERE tournament_id = ? AND alias = ?",
            [tourId, winnerAlias]
        );
        if (!row) {
            return reply.code(400).send({ error: "winnerAlias not found in this tournament" });
        }
        winnerId = row.id;
    }
    if (!winnerId) {
        return reply.code(400).send({ error: "winnerId/winnerAlias required" });
    }

    // Save winner for this match
    await db.run(
        "UPDATE tournament_matches SET winner_id = ? WHERE match_id = ? AND tournament_id = ?",
        [winnerId, matchId, tourId]
    );

    // What round just finished?
    const { round } = await db.get(
        "SELECT round FROM tournament_matches WHERE match_id = ? AND tournament_id = ?",
        [matchId, tourId]
    );

    // Get tournament size
    const { num_players: numPlayers } = await db.get(
        "SELECT num_players FROM tournaments WHERE tournament_id = ?",
        [tourId]
    );

    // Are all matches of this round finished now?
    const thisRound = await db.all(
        "SELECT match_id, player1_id, player2_id, winner_id FROM tournament_matches WHERE tournament_id = ? AND round = ?",
        [tourId, round]
    );
    const roundDone = thisRound.every(m => m.winner_id);

    let created = []; // list of newly created matches to return

    if (roundDone) {
        // Helper to collect winners/losers of a finished round
        const winners = [];
        const losers = [];

        for (const m of thisRound) {
            winners.push(m.winner_id);
            const loser = (m.player1_id === m.winner_id) ? m.player2_id : m.player1_id;
            losers.push(loser);
        }

        if (numPlayers === 4) {
            if (round === 1) {
                // After semifinals: create both 3rd-place (round 2) and Final (round 3)
                // Third place between losers:
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 2, 1, losers[0], losers[1]]
                );
                // Final between winners:
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 3, 0, winners[0], winners[1]]
                );
            }
            // If round === 2 (3rd place) finishes, Final already exists (round 3).
            // If round === 3 finishes, tournament is over.
        } else if (numPlayers === 8) {
            if (round === 1) {
                // After quarterfinals -> create semifinals (round 2)
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 2, 0, winners[0], winners[1]]
                );
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 2, 0, winners[2], winners[3]]
                );
            } else if (round === 2) {
                // After semifinals -> create 3rd place (round 3) and Final (round 4)
                // winners[] has 2 items; losers[] has 2 items (losers of the semis)
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 3, 1, losers[0], losers[1]]
                );
                await db.run(
                    "INSERT INTO tournament_matches (tournament_id, round, is_third, player1_id, player2_id) VALUES (?,?,?,?,?)",
                    [tourId, 4, 0, winners[0], winners[1]]
                );
            }
            // If round === 3 (3rd place) finishes, Final (round 4) already exists.
            // If round === 4 finishes, tournament is over.
        }

        // Collect newly created, still-pending matches (any round > current)
        created = await db.all(
            `SELECT m.match_id AS matchId,
                    m.round,
                    m.is_third,
                    p1.alias AS player1,
                    p2.alias AS player2
             FROM tournament_matches m
             JOIN tournament_players p1 ON p1.player_id = m.player1_id
             JOIN tournament_players p2 ON p2.player_id = m.player2_id
             WHERE m.tournament_id = ?
               AND m.winner_id IS NULL
               AND m.round > ?
             ORDER BY m.round, m.match_id`,
            [tourId, round]
        );
    }

    // If no pending matches remain at all, tournament is finished
    const pending = await db.get(
        "SELECT COUNT(*) AS cnt FROM tournament_matches WHERE tournament_id = ? AND winner_id IS NULL",
        [tourId]
    );

    if (pending.cnt === 0) {
        // Tournament is complete - log comprehensive results
        await logTournamentResults(tourId);
        
        // Find champion from highest non-3rd-place round
        const lastFinal = await db.get(
            `SELECT pw.alias AS winner
             FROM tournament_matches m
             JOIN tournament_players pw ON pw.player_id = m.winner_id
             WHERE m.tournament_id = ? AND m.is_third = 0
             ORDER BY m.round DESC LIMIT 1`,
            [tourId]
        );
        return reply.send({ finished: true, winner: lastFinal ? lastFinal.winner : null });
    }

    return reply.send({ nextMatches: created });
}

/**
 * Log comprehensive tournament results when tournament finishes
 * @param {number} tourId Tournament ID
 */
async function logTournamentResults(tourId) {
    // Get tournament info
    const tournament = await db.get(
        "SELECT num_players, user_id FROM tournaments WHERE tournament_id = ?",
        [tourId]
    );
    
    // Get all players with their info
    const players = await db.all(
        `SELECT p.player_id, p.alias, p.is_logged_user, u.nickname AS user_nickname
         FROM tournament_players p
         LEFT JOIN users u ON p.is_logged_user = 1 AND u.user_id = ?
         WHERE p.tournament_id = ?
         ORDER BY p.player_id`,
        [tournament.user_id, tourId]
    );
    
    // Get all match results
    const matches = await db.all(
        `SELECT m.round, m.is_third,
                p1.alias AS player1_alias, p1.is_logged_user AS p1_logged,
                p2.alias AS player2_alias, p2.is_logged_user AS p2_logged,
                pw.alias AS winner_alias, pw.is_logged_user AS winner_logged
         FROM tournament_matches m
         JOIN tournament_players p1 ON p1.player_id = m.player1_id
         JOIN tournament_players p2 ON p2.player_id = m.player2_id
         LEFT JOIN tournament_players pw ON pw.player_id = m.winner_id
         WHERE m.tournament_id = ?
         ORDER BY m.round, m.match_id`,
        [tourId]
    );
    
    // Find champion (winner of final)
    const champion = matches.find(m => !m.is_third && m.round === Math.max(...matches.map(m => m.round)));
    
    // Find 3rd place winner
    const thirdPlace = matches.find(m => m.is_third);
    
    // Log comprehensive results
    console.log('\n=== GAME:TOURNAMENT COMPLETED ===');
    console.log(`Tournament ID: ${tourId}`);
    console.log(`Game Type: TOURNAMENT`);
    console.log(`Player Count: ${tournament.num_players}`);
    console.log(`Logged-in User ID: ${tournament.user_id || 'None'}`);
    
    console.log('\n--- Players ---');
    players.forEach((p, idx) => {
        const userInfo = p.is_logged_user ? ` (USER: ${p.user_nickname || 'Unknown'}, ID: ${tournament.user_id})` : ' (GUEST)';
        console.log(`${idx + 1}. ${p.alias}${userInfo}`);
    });
    
    console.log('\n--- Final Results ---');
    if (champion) {
        const champInfo = champion.winner_logged ? ' (LOGGED-IN USER)' : ' (GUEST)';
        console.log(`🏆 Champion: ${champion.winner_alias}${champInfo}`);
    }
    if (thirdPlace && thirdPlace.winner_alias) {
        const thirdInfo = thirdPlace.winner_logged ? ' (LOGGED-IN USER)' : ' (GUEST)';
        console.log(`🥉 3rd Place: ${thirdPlace.winner_alias}${thirdInfo}`);
    }
    
    console.log('\n--- All Match Results ---');
    matches.forEach((m, idx) => {
        const roundName = m.is_third ? `Round ${m.round} (3rd Place)` : `Round ${m.round}`;
        const p1Info = m.p1_logged ? ' (USER)' : '';
        const p2Info = m.p2_logged ? ' (USER)' : '';
        const winnerInfo = m.winner_logged ? ' (USER)' : '';
        console.log(`${roundName}: ${m.player1_alias}${p1Info} vs ${m.player2_alias}${p2Info} → Winner: ${m.winner_alias}${winnerInfo}`);
    });
    
    console.log('=================================\n');
}

// GET /api/tournaments/:id
export async function getTournament(req, reply) {
    const tourId = parseInt(req.params.id);

    // Get all players (aliases)
    const players = await db.all(
        "SELECT player_id AS id, alias FROM tournament_players WHERE tournament_id = ?",
        [tourId]
    );

    // Get all matches with details and winners
    const matches = await db.all(
        `SELECT m.match_id AS matchId, m.round, m.is_third,
                p1.alias AS player1,
                p2.alias AS player2,
                pw.alias AS winner
         FROM tournament_matches m
         JOIN tournament_players p1 ON p1.player_id = m.player1_id
         JOIN tournament_players p2 ON p2.player_id = m.player2_id
         LEFT JOIN tournament_players pw ON pw.player_id = m.winner_id
         WHERE m.tournament_id = ?
         ORDER BY m.round, m.match_id`,
        [tourId]
    );

    return reply.send({ players: players, matches: matches });
}
