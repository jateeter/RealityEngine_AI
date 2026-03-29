import axios from 'axios';
import type { EngineState, SourceConfig, PushResult, MatchAlgorithm } from './types.js';

const api = axios.create({ baseURL: '/api' });

export async function getState(): Promise<EngineState> {
  const { data } = await api.get<EngineState>('/state');
  return data;
}

export async function push(): Promise<PushResult> {
  const { data } = await api.post<PushResult>('/push');
  return data;
}

export async function startAuto(intervalMs: number): Promise<void> {
  await api.post('/auto/start', { intervalMs });
}

export async function stopAuto(): Promise<void> {
  await api.post('/auto/stop');
}

export async function resetEngine(): Promise<void> {
  await api.post('/reset');
}

export async function getSources(): Promise<SourceConfig[]> {
  const { data } = await api.get<{ sources: SourceConfig[] }>('/sources');
  return data.sources;
}

export async function addSource(config: Omit<SourceConfig, 'id'>): Promise<SourceConfig> {
  const { data } = await api.post<{ source: SourceConfig }>('/sources', config);
  return data.source;
}

export async function updateSource(id: string, patch: Partial<SourceConfig>): Promise<SourceConfig> {
  const { data } = await api.patch<{ source: SourceConfig }>(`/sources/${id}`, patch);
  return data.source;
}

export async function deleteSource(id: string): Promise<void> {
  await api.delete(`/sources/${id}`);
}

export async function getMachines(): Promise<{ machines: unknown[] }> {
  const { data } = await api.get<{ machines: unknown[] }>('/machines');
  return data;
}

export async function setMatchAlgorithm(algo: MatchAlgorithm): Promise<void> {
  await api.patch('/config', { matchAlgorithm: algo });
}
