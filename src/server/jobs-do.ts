/**
 * Durable Object for storing async wallpaper generation jobs.
 * Each job gets a unique ID and stores its status/result.
 */

import { DurableObject } from 'cloudflare:workers';

interface DurableObjectState {
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(options?: { prefix?: string }): AsyncIterable<[string, unknown]>;
}

export interface JobData {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input: WallpaperRequest;
  result?: WallpaperResponse;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WallpaperRequest {
  name: string;
  date: string;
  time: string;
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  presetId?: string;
  focusAreas?: string[];
  keys?: { gemini?: string; nvidia?: string };
  deviceId?: string;
}

export interface WallpaperResponse {
  chartSummary: any;
  conditions: any;
  reading: any;
  image: { dataUrl: string; mime: string; width: number; height: number } | null;
  wallpaperPrompt: string;
  error?: string;
  provider?: string;
}

export class JobsDurableObject extends DurableObject {
  private state: DurableObjectState;
  private env: any;
  private jobs: Map<string, JobData> = new Map();

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
    
    // Load persisted jobs from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, JobData>>('jobs');
      if (stored) this.jobs = stored;
    });
  }

  async createJob(input: WallpaperRequest): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const job: JobData = {
      id,
      status: 'pending',
      input,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    await this.persist();
    return id;
  }

  async getJob(id: string): Promise<JobData | null> {
    return this.jobs.get(id) ?? null;
  }

  async updateJob(id: string, updates: Partial<JobData>): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, updates, { updatedAt: Date.now() });
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.state.storage.put('jobs', this.jobs);
  }

  // Cleanup old jobs (older than 24 hours)
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, job] of this.jobs) {
      if (job.updatedAt < cutoff) this.jobs.delete(id);
    }
    await this.persist();
  }
}
