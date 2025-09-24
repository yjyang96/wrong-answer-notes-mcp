import winston from 'winston';

/**
 * 로깅 유틸리티 클래스
 */
export class Logger {
  private logger: winston.Logger;

  constructor(private context: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { context },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  /**
   * 디버그 로그
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * 정보 로그
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * 경고 로그
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * 오류 로그
   */
  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  /**
   * 컨텍스트와 함께 로그 생성
   */
  withContext(additionalContext: string): Logger {
    return new Logger(`${this.context}:${additionalContext}`);
  }
}

