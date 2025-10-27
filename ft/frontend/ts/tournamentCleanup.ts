// ^^^^^ TRDM ^^^^^
// Centralized, safe cleanup for the local-tournament flow.
// - keep state when navigating from /game/local-tournament -> /game/local (normal match)
// - also keep state when returning from /game/local -> /game/local-tournament (so Winner screen can read it)
// - wipe any left-overs when the user navigates anywhere else (e.g., "/", "/play", "/profile", etc.)

/** True if a given path is part of the local-tournament flow (where keys are kept). */
export function isTournamentPath(path: string): boolean {
    if (!path) return false;
    // Normalize: ignore query part for a simple check
    const pure = path.split("?")[0];
    return pure === "/game/local-tournament" || pure === "/game/local";
}

/** Remove both tournament keys and clear canvas labels. */
export function clearTournamentAll(reason: string = "cleanup"): void {
    try {
        sessionStorage.removeItem("tournamentMatch");
        sessionStorage.removeItem("tournamentResult");
    } catch {}
    // Also clear the global labels used by the local canvas renderer
    // (they may exist if we abandoned a match mid-flow).
    // @ts-ignore - these are attached dynamically
    delete (window as any).player1Name;
    // @ts-ignore
    delete (window as any).player2Name;

    // Optional console note for debugging during evaluation
    //console.debug("[tournamentCleanup] Cleared all tournament state:", reason);
}

/** Remove only the current match context (keep 'tournamentResult' for the Winner screen). */
export function clearTournamentContextOnly(reason: string = "cleanup"): void {
    try {
        sessionStorage.removeItem("tournamentMatch");
    } catch {}
    // @ts-ignore
    delete (window as any).player1Name;
    // @ts-ignore
    delete (window as any).player2Name;
    console.debug("[tournamentCleanup] Cleared tournamentMatch only:", reason);
}

/**
 * If we are leaving the tournament flow entirely, wipe the stale keys.
 * If we are staying within tournament flow (local <-> local-tournament), keep them.
 */
export function cleanupTournamentOnRouteChange(prevPath: string, nextPath: string): void {
    const fromTour = isTournamentPath(prevPath);
    const toTour = isTournamentPath(nextPath);

    // Allowed transitions where we KEEP keys:
    // - local-tournament -> local (going to actually play a match)
    // - local -> local-tournament (coming back with a result)
    if (fromTour && toTour) {
        // staying inside the tournament flow; keep everything
        return;
    }

    // In all other cases we’re abandoning a tournament flow (or had leftovers):
    // clear both keys so the next tournament starts fresh.
    clearTournamentAll(`route-change ${prevPath} -> ${nextPath}`);
}
