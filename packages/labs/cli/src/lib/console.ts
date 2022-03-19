import {Console} from 'console';

export type Level = 'error' | 'warn' | 'info' | 'verbose' | 'debug';

export class LitConsole extends Console {
  logLevel: Level = 'debug';

  setQuiet() {
    throw new Error('Not implemented');
  }

  setVerbose() {
    throw new Error('Not implemented');
  }

  override info(message?: unknown, ...optionalParams: unknown[]): void {
    if (
      this.logLevel === 'info' ||
      this.logLevel === 'verbose' ||
      this.logLevel === 'debug'
    ) {
      super.info(message, ...optionalParams);
    }
  }

  override warn(message?: unknown, ...optionalParams: unknown[]): void {
    if (
      this.logLevel === 'warn' ||
      this.logLevel === 'info' ||
      this.logLevel === 'verbose' ||
      this.logLevel === 'debug'
    ) {
      super.warn(message, ...optionalParams);
    }
  }

  override debug(message?: unknown, ...optionalParams: unknown[]): void {
    if (this.logLevel === 'debug') {
      super.debug(message, ...optionalParams);
    }
  }
}
