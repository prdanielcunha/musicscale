import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  PairingBinding,
  PairingCompleteResponse,
  PairingRequest
} from '@musicscale-live/domain';

interface ChallengeRecord extends PairingRequest {
  challengeId: string;
  pin: string;
  expiresAtMs: number;
  attempts: number;
}

interface PersistedPairing {
  tokenHash: string;
  binding: PairingBinding;
  revokedAt?: string;
}

interface PairingFile {
  version: 1;
  pairings: PersistedPairing[];
}

export interface PairingChallengeInternal {
  challengeId: string;
  pin: string;
  expiresAt: string;
}

const EMPTY_FILE: PairingFile = { version: 1, pairings: [] };

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export class PairingStore {
  private readonly challenges = new Map<string, ChallengeRecord>();
  private file: PairingFile = structuredClone(EMPTY_FILE);
  private loaded = false;

  constructor(
    private readonly filePath: string,
    private readonly nodeId: string,
    private readonly challengeTtlMs = 120_000
  ) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PairingFile;
      this.file = parsed.version === 1 && Array.isArray(parsed.pairings)
        ? parsed
        : structuredClone(EMPTY_FILE);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      this.file = structuredClone(EMPTY_FILE);
    }
    this.loaded = true;
  }

  async createChallenge(request: PairingRequest): Promise<PairingChallengeInternal> {
    await this.load();
    this.pruneChallenges();
    const challengeId = randomBytes(18).toString('base64url');
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAtMs = Date.now() + this.challengeTtlMs;
    this.challenges.set(challengeId, {
      ...request,
      challengeId,
      pin,
      expiresAtMs,
      attempts: 0
    });
    return {
      challengeId,
      pin,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  activeChallengeForLocalDisplay(): PairingChallengeInternal | null {
    this.pruneChallenges();
    const challenge = [...this.challenges.values()]
      .filter(item => item.expiresAtMs > Date.now())
      .sort((a, b) => b.expiresAtMs - a.expiresAtMs)[0];
    if (!challenge) return null;
    return {
      challengeId: challenge.challengeId,
      pin: challenge.pin,
      expiresAt: new Date(challenge.expiresAtMs).toISOString()
    };
  }

  async complete(
    challengeId: string,
    pin: string,
    deviceId: string,
    deviceName: string
  ): Promise<PairingCompleteResponse> {
    await this.load();
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.expiresAtMs <= Date.now()) {
      this.challenges.delete(challengeId);
      throw new Error('pairing_challenge_expired');
    }

    challenge.attempts += 1;
    if (challenge.attempts > 5) {
      this.challenges.delete(challengeId);
      throw new Error('pairing_attempts_exceeded');
    }

    const expected = Buffer.from(challenge.pin);
    const provided = Buffer.from(pin);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new Error('pairing_pin_invalid');
    }
    if (challenge.deviceId !== deviceId || challenge.deviceName !== deviceName) {
      throw new Error('pairing_device_mismatch');
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    const binding: PairingBinding = {
      nodeId: this.nodeId,
      organizationId: challenge.organizationId,
      venueId: challenge.venueId,
      liveSystemId: challenge.liveSystemId,
      deviceId,
      deviceName,
      pairedAt: now,
      lastSeenAt: now
    };

    this.file.pairings = this.file.pairings.filter(
      item => !(item.binding.deviceId === deviceId && !item.revokedAt)
    );
    this.file.pairings.push({ tokenHash: hashSecret(token), binding });
    this.challenges.delete(challengeId);
    await this.persist();

    return { nodeId: this.nodeId, token, binding };
  }

  async authorize(token: string): Promise<PairingBinding | null> {
    await this.load();
    if (!token) return null;
    const tokenHash = hashSecret(token);
    const match = this.file.pairings.find(
      item => !item.revokedAt && safeEqualHex(item.tokenHash, tokenHash)
    );
    return match ? structuredClone(match.binding) : null;
  }

  async touch(token: string): Promise<PairingBinding | null> {
    await this.load();
    const tokenHash = hashSecret(token);
    const match = this.file.pairings.find(
      item => !item.revokedAt && safeEqualHex(item.tokenHash, tokenHash)
    );
    if (!match) return null;
    match.binding.lastSeenAt = new Date().toISOString();
    await this.persist();
    return structuredClone(match.binding);
  }

  async revoke(deviceId: string): Promise<boolean> {
    await this.load();
    const now = new Date().toISOString();
    let changed = false;
    for (const pairing of this.file.pairings) {
      if (pairing.binding.deviceId === deviceId && !pairing.revokedAt) {
        pairing.revokedAt = now;
        changed = true;
      }
    }
    if (changed) await this.persist();
    return changed;
  }

  async activePairingCount(): Promise<number> {
    await this.load();
    return this.file.pairings.filter(item => !item.revokedAt).length;
  }

  private pruneChallenges(): void {
    const now = Date.now();
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAtMs <= now) this.challenges.delete(key);
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.file, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
