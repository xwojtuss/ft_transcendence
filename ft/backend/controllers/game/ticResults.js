// import { StatusCodes } from "http-status-codes";
// import HTTPError from "../../utils/error.js";
// import Match from "../../utils/Match.js";
// import User from "../../utils/User.js";
// import z from "zod";

// const bodySchema = z.object({
//   mode: z.enum(["local", "ai", "matching"]),
//   player1: z.string().min(1),
//   player2: z.string().min(1),
//   // null => draw
//   winnerAlias: z.string().min(1).nullable(),
// });

// export async function recordTicResult(req, reply) {
//   let parsed;
//   try {
//     parsed = bodySchema.parse(req.body);
//   } catch {
//     throw new HTTPError(StatusCodes.BAD_REQUEST, "Invalid payload");
//   }

//   const { mode, player1, player2, winnerAlias } = parsed;

//   // Save:
//   // - always for local/ai
//   // - only if a registered user participated for matching
//   const shouldSave =
//     mode === "local" ||
//     mode === "ai" ||
//     (mode === "matching" && !!req.currentUser);

//   if (!shouldSave) {
//     return reply.send({ success: true, saved: false });
//   }

//   // Originator row:
//   // - matching: logged-in user account (records under official alias)
//   // - local/ai: alias only (player1)
//   const originator =
//     mode === "matching" && req.currentUser
//       ? Object.assign(new User(req.currentUser.nickname), {
//           id: req.currentUser.id,
//         })
//       : player1; // alias string

//   // Work out "myAlias" and "opponentAlias":
//   // In matching, the logged user can be player1 or player2.
//   // In local/ai, default to player1 vs player2.
//   const myAlias =
//     mode === "matching" && req.currentUser
//       ? req.currentUser.nickname === player1
//         ? player1
//         : req.currentUser.nickname === player2
//         ? player2
//         : player1 // fallback
//       : player1;

//   const opponentAlias = myAlias === player1 ? player2 : player1;

//   // Create match with the requested mode and add ONLY the opponent as the second participant.
//   const m = new Match(originator, "TicTacToe", mode, 2);
//   m.addParticipant(opponentAlias);

//   // Rank outcomes (support Draw)
//   if (winnerAlias === null) {
//     m.addRank(originator, "Draw");
//     m.addRank(opponentAlias, "Draw");
//   } else {
//     const originatorWon = winnerAlias === myAlias;
//     m.addRank(originator, originatorWon ? "Won" : "Lost");
//     m.addRank(opponentAlias, originatorWon ? "Lost" : "Won");
//   }

//   m.endMatch();
//   await m.commitMatch();

//   return reply.send({ success: true, saved: true });
// }


import { StatusCodes } from "http-status-codes";
import HTTPError from "../../utils/error.js";
import Match from "../../utils/Match.js";
import User from "../../utils/User.js";
import z from "zod";

const bodySchema = z.object({
  mode: z.enum(["local", "ai", "matching"]),
  player1: z.string().min(1),
  player2: z.string().min(1),
  // null => draw
  winnerAlias: z.string().min(1).nullable(),
});

export async function recordTicResult(req, reply) {
  let parsed;
  try {
    parsed = bodySchema.parse(req.body);
  } catch {
    throw new HTTPError(StatusCodes.BAD_REQUEST, "Invalid payload");
  }

  const { mode, player1, player2, winnerAlias } = parsed;

  // Decide if we should save this result at all
  const isLoggedIn = !!req.currentUser;
  const isMatching = mode === "matching";
  const selfNick   = isLoggedIn ? req.currentUser.nickname : null;

  // For matching: only save games the logged user actually played
  const selfIsInThisGame = isMatching
    ? (selfNick === player1 || selfNick === player2)
    : true; // always save local/ai

  const shouldSave = (mode === "local" || mode === "ai" || isMatching) && selfIsInThisGame && (isLoggedIn || mode !== "matching");
  // Explanation:
  // - local, ai => always save
  // - matching  => save only when logged in AND the logged user is one of (player1, player2)

  if (!shouldSave) {
    return reply.send({ success: true, saved: false });
  }

  // Originator row:
  // - matching: log under the real user account (official alias)
  // - local/ai: originator is the p1 alias (no account link)
  const originator = isLoggedIn
      ? Object.assign(new User(selfNick), { id: req.currentUser.id })
      : player1;

  // Work out myAlias/opponentAlias robustly
  const myAlias = isMatching && isLoggedIn
    ? (selfNick === player1 ? player1
       : selfNick === player2 ? player2
       : player1) // fallback, shouldn't hit due to selfIsInThisGame
    : player1;

  const opponentAlias = myAlias === player1 ? player2 : player1;

  const prettyMode = mode.charAt(0).toUpperCase() + mode.slice(1);
  // Create match with the requested mode and add ONLY the opponent as second participant
  const m = new Match(originator, "TicTacToe", prettyMode, 2);
  m.addParticipant(opponentAlias);

  // Rank outcomes (support Draw)
  if (winnerAlias === null) {
    m.addRank(originator, "Draw");
    m.addRank(opponentAlias, "Draw");
  } else {
    const originatorWon = (winnerAlias === myAlias);
    m.addRank(originator, originatorWon ? "Won" : "Lost");
    m.addRank(opponentAlias, originatorWon ? "Lost" : "Won");
  }

  m.endMatch();
  await m.commitMatch();

  return reply.send({ success: true, saved: true });
}
