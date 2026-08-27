import { admin, adminDb } from '../services/firebaseAdmin.js';
import {
    EXPECTED_MACHINE_FIREBASE_PROJECT_ID,
    MachineDryRunError,
    runGlobalSongMetricsMachineDryRun,
} from '../services/server/globalSongMetricsMachineDryRun.js';

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
        throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
    }

    const result = await runGlobalSongMetricsMachineDryRun(adminDb, {
        actualProjectId: resolveActualProjectId(),
        expectedProjectId: EXPECTED_MACHINE_FIREBASE_PROJECT_ID,
    });

    console.log(JSON.stringify({
        mode: 'dry-run',
        expectedProjectId: EXPECTED_MACHINE_FIREBASE_PROJECT_ID,
        ...result,
    }));
}

main().catch((error: unknown) => {
    const code = error instanceof MachineDryRunError
        ? error.code
        : 'MACHINE_READ_UNAVAILABLE';
    console.error(`[global-song-metrics-machine-dry-run] ${code}`);
    process.exitCode = 1;
});
