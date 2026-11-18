/** Minimal JSON HTTP client that maps every failure to a typed ApiError. */
import { ApiError, errorFromStatus } from './errors';

export interface ClientOptions {
  baseUrl: string; // '' = same origin (Vite dev proxy)
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class JsonClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    let response: Response;
    try {
      const init: RequestInit = { method, headers: { Accept: 'application/json' }, signal: controller.signal };
      if (body !== undefined) {
        init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body);
      }
      response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    } catch {
      throw timedOut
        ? new ApiError('timeout', `No response after ${Math.round(this.timeoutMs / 1000)} seconds`)
        : new ApiError('network', 'Network request failed');
    } finally {
      clearTimeout(timer);
    }
    let parsed: unknown = undefined;
    const text = await response.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (response.ok) throw new ApiError('contract', 'Response was not JSON', response.status);
      }
    }
    if (!response.ok) throw errorFromStatus(response.status, parsed);
    return parsed as T;
  }
}
