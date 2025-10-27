export async function initTicTacToe(): Promise<void> {
    const root = document.getElementById("ttt-root");
    const c1 = document.getElementById("canvasTic1") as HTMLCanvasElement | null; // AI
    const c2 = document.getElementById("canvasTic2") as HTMLCanvasElement | null; // 2P
    if (!root || !c1 || !c2) return;
    
    const params = new URLSearchParams(window.location.search);
    const isAIParam = params.get("ai") === "1";
    const [{ showTic1 }, { showTic2 }] = await Promise.all([
        import("./gameUtils/tic1.js") as Promise<typeof import("./gameUtils/tic1")>,
        import("./gameUtils/tic2.js") as Promise<typeof import("./gameUtils/tic2")>,
    ]);
    // Show the requested mode
    if (isAIParam) {
        c1.classList.remove("hidden");
        c2.classList.add("hidden");
        showTic1("canvasTic1", "tic-controls", { difficulty: "auto", delayMs: 220 });
    } else {
        c1.classList.add("hidden");
        c2.classList.remove("hidden");
        showTic2("canvasTic2", "tic-controls");
    }
    document.getElementById("btn-ai")?.addEventListener("click", () => {
        c1.classList.remove("hidden");
        c2.classList.add("hidden");
        showTic1("canvasTic1", "tic-controls", { difficulty: "auto", delayMs: 220 });
    });
    document.getElementById("btn-2p")?.addEventListener("click", () => {
        c1.classList.add("hidden");
        c2.classList.remove("hidden");
        showTic2("canvasTic2", "tic-controls");
    });
    document.getElementById("btn-match")?.addEventListener("click", async () => {
        const { initTicTournament } = (await import("./ticTournament.js")) as typeof import("./ticTournament");
        initTicTournament();
    });
}

