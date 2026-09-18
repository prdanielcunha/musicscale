import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface HolyricsLocalConfig {
  baseUrl: string;
  token: string;
  updatedAt: string;
}

interface ProviderConfigFile {
  version: 1;
  holyrics?: HolyricsLocalConfig;
}

export class ProviderConfigStore {
  private loaded = false;
  private file: ProviderConfigFile = { version: 1 };

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as ProviderConfigFile;
      this.file = parsed.version === 1 ? parsed : { version: 1 };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      this.file = { version: 1 };
    }
    this.loaded = true;
  }

  async getHolyrics(): Promise<HolyricsLocalConfig | null> {
    await this.load();
    return this.file.holyrics ? structuredClone(this.file.holyrics) : null;
  }

  async setHolyrics(input: {
    baseUrl: string;
    token: string;
  }): Promise<HolyricsLocalConfig> {
    await this.load();
    const baseUrl = input.baseUrl.trim();
    const token = input.token.trim();
    if (!baseUrl) throw new Error('holyrics_url_required');
    if (!token) throw new Error('holyrics_token_required');

    const parsed = new URL(baseUrl);
    const host = parsed.hostname.toLowerCase();
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    if (!['http:', 'https:'].includes(parsed.protocol) || !isLocalHost) {
      throw new Error('holyrics_url_must_be_local');
    }

    const value: HolyricsLocalConfig = {
      baseUrl: parsed.toString().replace(/\/$/, ''),
      token,
      updatedAt: new Date().toISOString()
    };
    this.file.holyrics = value;
    await this.persist();
    return structuredClone(value);
  }

  async clearHolyrics(): Promise<void> {
    await this.load();
    delete this.file.holyrics;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.file, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
