import { admin, adminDb } from '../services/firebaseAdmin.js';
import {
    CONTROLLED_BACKFILL_PROJECT_ID,
    ControlledBackfillError,
    runControlledGlobalSongMetricsBackfill,
} from '../services/server/controlledGlobalSongMetricsBackfill.js';

function resolveActualProjectId(): string | undefined {
    try {
        const projectId = admin.app().options.projectId;
        return typeof projectId === 'string' ? projectId : undefined;
    } catch {
        return undefined;
    }
}

async function main(): Promise<void> {
    if (!adminDb) {
        throw new ControlledBackfillError('CONTROLLED_BACKFILL_UNAVAILABLE');
    }

    const result = await runControlledGlobalSongMetricsBackfill(adminDb, {
        actualProjectId: resolveActualProjectId(),
        expectedProjectId: CONTROLLED_BACKFILL_PROJECT_ID,
        guard: {
            authorizedSha: process.env.MACHINE_AUTHORIZED_SHA,
            githubSha: process.env.GITHUB_SHA,
            githubRef: process.env.GITHUB_REF,
            githubEnvironment: process.env.MACHINE_GITHUB_ENVIRONMENT,
            firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
            firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
            firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
            firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        },
    });

    console.log(JSON.stringify({
        mode: 'controlled-bounded-backfill',
        project: CONTROLLED_BACKFILL_PROJECT_ID,
        authentication: 'DIRECT_WIF',
        credential: 'TEMPORARY',
        serviceAccount: 'NONE',
        jsonKey: 'NONE',
        ...result,
    }));
}

main().catch((error: unknown) => {
    const code = error instanceof ControlledBackfillError
        ? error.code
        : 'CONTROLLED_BACKFILL_UNAVAILABLE';
    console.error(`[controlled-global-song-metrics-backfill] ${code}`);
    process.exitCode = 1;
});
