import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a dedicated logger for dungeon and party events
const dungeonLogger = winston.createLogger({
    // Set to 'warn' to effectively disable routine packet/info logs by default
    level: 'warn',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info) => `[${info.timestamp}] [${info.level}] ${info.message}`)
    ),
    transports: [
        // Console output with colors
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf((info) => `[${info.timestamp}] [${info.level}] ${info.message}`)
            ),
        }),
        // File output without colors (only when debug logging is enabled)
        ...(config.ENABLE_DEBUG_LOGS
            ? [
                  new winston.transports.File({
                      filename: path.join(__dirname, '../../logs/dungeon-party.log'),
                      format: winston.format.combine(
                          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                          winston.format.printf((info) => `[${info.timestamp}] [${info.level}] ${info.message}`)
                      ),
                  }),
              ]
            : []),
    ],
});

export default dungeonLogger;
