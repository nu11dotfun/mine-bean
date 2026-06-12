export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export interface LoggerOptions {
    level?: LogLevel;
    prefix?: string;
    enabled?: boolean;
}
export declare class Logger {
    private level;
    private prefix;
    private enabled;
    constructor(options?: LoggerOptions);
    private formatMessage;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, error?: Error, ...args: unknown[]): void;
}
