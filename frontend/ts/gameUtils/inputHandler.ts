export class InputHandler {
    private gameWs: any;
    private validKeys = ["w", "s", "ArrowUp", "ArrowDown", " "];

    constructor(gameWs: any) {
        this.gameWs = gameWs;
        this.setupEventListeners();
    }

    private setupEventListeners() {
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
        document.addEventListener("keyup", this.handleKeyUp.bind(this));
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (this.validKeys.includes(e.key)) {
            this.gameWs.sendInput("keydown", e.key);
        }
    }

    private handleKeyUp(e: KeyboardEvent) {
        if (this.validKeys.includes(e.key)) {
            this.gameWs.sendInput("keyup", e.key);
        }
    }
}