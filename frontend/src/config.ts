import { createHttpTransport } from './transport/httpTransport';
import { createMockTransport } from './transport/mockTransport';
import type { Transport, TransportMode } from './transport/types';

export interface AppConfig {
  transportMode: TransportMode;
  apiBaseUrl: string;
  enableWebSocket: boolean;
  pollIntervalMs: number;
  mockStepDelayMs: number;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readConfig(env: Record<string, string | undefined> = import.meta.env): AppConfig {
  return {
    transportMode: env.VITE_TRANSPORT_MODE === 'http' ? 'http' : 'mock',
    apiBaseUrl: env.VITE_API_BASE_URL ?? '',
    enableWebSocket: env.VITE_ENABLE_WEBSOCKET === 'true',
    pollIntervalMs: Math.max(1000, num(env.VITE_POLL_INTERVAL_MS, 3000)),
    mockStepDelayMs: num(env.VITE_MOCK_STEP_DELAY_MS, 900),
  };
}

export function createTransport(config: AppConfig): Transport {
  if (config.transportMode === 'http') {
    return createHttpTransport({ baseUrl: config.apiBaseUrl, enableWebSocket: config.enableWebSocket });
  }
  return createMockTransport({ stepDelayMs: config.mockStepDelayMs, latencyMs: Math.min(250, config.mockStepDelayMs) });
}
