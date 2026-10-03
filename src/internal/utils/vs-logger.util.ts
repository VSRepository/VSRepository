import { VSLogLevel } from "../enums/vs-log-level.enum.js";
import { PerformData } from "../../types/utils/perform-data.type.js";

/**
 * ANSI escape codes used to colorize log output.
 * Kept as raw codes (instead of a dependency like chalk) since colors here
 * are a "nice to have" for local/dev usage, not a hard requirement.
 */
const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    gray: "\x1b[90m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
} as const;

const LEVEL_LABEL: Record<VSLogLevel, string> = {
    [VSLogLevel.DEBUG]: "DEBUG",
    [VSLogLevel.INFO]: "INFO",
    [VSLogLevel.WARN]: "WARN",
    [VSLogLevel.ERROR]: "ERROR",
    [VSLogLevel.NONE]: "never",
};

const LEVEL_COLOR: Record<VSLogLevel, string> = {
    [VSLogLevel.DEBUG]: ANSI.gray,
    [VSLogLevel.INFO]: ANSI.cyan,
    [VSLogLevel.WARN]: ANSI.yellow,
    [VSLogLevel.ERROR]: ANSI.red,
    [VSLogLevel.NONE]: "never",
};

export class VSLogger {
    private static readonly DEFAULT_SLOW_OPERATION_MS = 300;
    private readonly slowOperationThresholdMs: number | false;

    private readonly useColors: boolean;

    constructor(
        private readonly logLevel: VSLogLevel,
        private readonly loggerName: string,
        slowOperationThresholdMs?: number | boolean,
    ) {
        this.slowOperationThresholdMs =
            typeof slowOperationThresholdMs === "number" || slowOperationThresholdMs === false
                ? slowOperationThresholdMs
                : VSLogger.DEFAULT_SLOW_OPERATION_MS;

        this.useColors = !process.env.NO_COLOR && !!process.stdout?.isTTY;
    }

    getLogLevel(): VSLogLevel {
        return this.logLevel;
    }

    private color(text: string, ansiColor: string): string {
        if (!this.useColors) return text;
        return `${ansiColor}${text}${ANSI.reset}`;
    }

    private stringfy(obj: any): string {
        return JSON.stringify(
            obj,
            (_key, value) => {
                if (typeof value === "bigint") return `${value.toString()}n`;

                if (value instanceof Error) {
                    return { name: value.name, message: value.message, stack: value.stack };
                }

                return value;
            },
            2,
        );
    }

    private buildPrefix(level: VSLogLevel): string {
        const timestamp = this.color(new Date().toISOString(), ANSI.dim);
        const levelLabel = this.color(`[${LEVEL_LABEL[level]}]`, `${ANSI.bold}${LEVEL_COLOR[level]}`);
        const name = this.color(`[${this.loggerName}]`, ANSI.magenta);

        return `${timestamp} ${levelLabel} ${name}`;
    }

    private log(level: VSLogLevel, text: string, obj?: any): void {
        if (this.logLevel > level) return;

        const args = [`${this.buildPrefix(level)} ${text}`];
        if (obj !== undefined) {
            args.push("\n" + this.stringfy(obj));
        }

        if (level === VSLogLevel.ERROR) {
            console.error(...args);
        } else if (level === VSLogLevel.WARN) {
            console.warn(...args);
        } else {
            console.log(...args);
        }
    }

    logDebug(text: string, obj?: any): void {
        this.log(VSLogLevel.DEBUG, text, obj);
    }

    logInfo(text: string, obj?: any): void {
        this.log(VSLogLevel.INFO, text, obj);
    }

    logWarn(text: string, obj?: any): void {
        this.log(VSLogLevel.WARN, text, obj);
    }

    /**
     * Loga um erro. Se `err` for uma instância de `Error`, apenas nome, mensagem,
     * stack e cause são logados (evita despejar propriedades internas desnecessárias).
     */
    logError(text: string, err?: unknown): void {
        if (err instanceof Error) {
            this.log(VSLogLevel.ERROR, text, {
                name: err.name,
                message: err.message,
                stack: err.stack,
                cause: err.cause,
            });
            return;
        }

        this.log(VSLogLevel.ERROR, text, err);
    }

    startPerformLog(operation: string): PerformData | undefined {
        if (this.logLevel > VSLogLevel.DEBUG) return;

        this.logDebug(`Starting to ${operation}...`);

        return {
            operation,
            start: performance.now(),
        };
    }

    endPerformLog(data: PerformData | undefined): void {
        if (!data) return;

        const end = performance.now();
        const timeTook = end - data.start;
        const timeTookLabel = timeTook.toFixed(2);

        if (this.slowOperationThresholdMs !== false && timeTook >= this.slowOperationThresholdMs) {
            this.logWarn(
                `Took ${timeTookLabel}ms to ${data.operation} (slower than the ${this.slowOperationThresholdMs}ms threshold)`,
            );
            return;
        }

        this.logDebug(`Took ${timeTookLabel}ms to ${data.operation}`);
    }
}
