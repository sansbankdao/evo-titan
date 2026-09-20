// apps/mobile/src/api/client.ts — Evo Titan
// Every request goes through our own API; the app never talks to third parties directly.
export const API_BASE_URL = 'https://evotitan.app/v1';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
