import { fixCandidatesWithoutTitle } from './services/server/fixCandidatesWithoutTitle.js';

async function run() {
    try {
        const stats = await fixCandidatesWithoutTitle();
        console.log("FIX STATS:", stats);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
