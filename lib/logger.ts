export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Safe check for production environment
const isProduction = () => {
    try {
        // @ts-ignore - Vite env
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            return !!(import.meta as any).env.PROD;
        }
    } catch (e) {}
    
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV === 'production';
        }
    } catch (e) {}
    
    return false;
};

let currentLevel = isProduction() ? LogLevel.INFO : LogLevel.DEBUG;

export const setLogLevel = (level: number) => {
    currentLevel = level;
};

export const logger = {
    debug: (message: string, ...args: any[]) => {
        if (currentLevel <= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        if (currentLevel <= LogLevel.INFO) {
            console.info(`[INFO] ${message}`, ...args);
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (currentLevel <= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    error: (message: string, ...args: any[]) => {
        if (currentLevel <= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }
};
