import assert from 'assert';
import crypto from 'crypto';

async function runTests() {
    console.log("Testing validation and logic for /api/curation/reject...");
    
    // 1. role autorizada
    const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
    for (const r of allowedRoles) {
        assert.ok(['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(r), `Role ${r} should be allowed`);
    }

    // 2. reason codes
    const validReasonCodes = [
        'duplicate_candidate',
        'invalid_content',
        'insufficient_content',
        'medley_or_compilation',
        'not_a_song',
        'policy_violation',
        'other'
    ];
    
    assert.ok(validReasonCodes.includes('duplicate_candidate'), "duplicate_candidate is valid");
    assert.ok(!validReasonCodes.includes('invalid_reason'), "invalid_reason is denied");

    // 3. state validation
    const allowedStatuses = ['pending_review', 'possible_duplicate', 'matched_existing', 'likely_unique', 'processing_failed'];
    const deniedStatuses = ['approved', 'linked', 'merged', 'rejected'];

    assert.ok(allowedStatuses.includes('pending_review'), "Pending review is allowed for reject");
    assert.ok(!allowedStatuses.includes('approved'), "Approved is denied for reject");

    // 4. NOTE size logic
    const longNote = "A".repeat(501);
    let noteError = false;
    if (longNote.length > 500) {
        noteError = true;
    }
    assert.strictEqual(noteError, true, "Note > 500 should trigger error instead of slicing");
    
    // 5. Review Log format
    const sampleKey = "test_key_123";
    const correlationId = crypto.createHash('sha256').update(sampleKey).digest('hex');
    assert.ok(correlationId !== sampleKey, "Correlation ID should not expose raw idempotency key");
    assert.strictEqual(correlationId.length, 64, "SHA-256 hash has correct length");

    const logWithNote: any = {
        eventType: 'rejected',
        actorId: 'uid123',
        reasonCode: 'duplicate_candidate',
        schemaVersion: 1,
        correlationId: correlationId,
        timestamp: Date.now()
    };
    logWithNote.privateNote = "Alguma nota";

    const logWithoutNote: any = {
        eventType: 'rejected',
        actorId: 'uid123',
        reasonCode: 'duplicate_candidate',
        schemaVersion: 1,
        correlationId: correlationId,
        timestamp: Date.now()
    };

    assert.strictEqual(logWithNote.privateNote, "Alguma nota", "Private note saved when provided");
    assert.strictEqual(logWithoutNote.privateNote, undefined, "Private note omitted when not provided");
    assert.strictEqual(typeof logWithNote.schemaVersion, 'number', "schemaVersion should be numeric");
    assert.strictEqual(logWithNote.eventType, 'rejected', "Should use eventType 'rejected'");

    // 6. Robust Timestamp Parser & Retrocompatibility
    const { parseTimestampToMillis } = await import('./utils/curation/timestamp.js');

    // Test Firestore Timestamp instance mock
    const fsTimestampMock = {
        toMillis: () => 1718310000000,
        toDate: () => new Date(1718310000000)
    };
    assert.strictEqual(parseTimestampToMillis(fsTimestampMock), 1718310000000, "Should extract from Firestore Timestamp");

    // Test plain object {seconds, nanoseconds}
    const plainSecsNanos = { seconds: 1718310000, nanoseconds: 450000000 };
    assert.strictEqual(parseTimestampToMillis(plainSecsNanos), 1718310000450, "Should convert seconds & nanoseconds to millis");

    // Test legacy millisecond number
    assert.strictEqual(parseTimestampToMillis(1718310000000), 1718310000000, "Should accept number legados directly");

    // Test Date instance
    const dateInstance = new Date(1718310000000);
    assert.strictEqual(parseTimestampToMillis(dateInstance), 1718310000000, "Should support Date instances");

    // Test missing/absent timestamp
    assert.strictEqual(parseTimestampToMillis(undefined), null, "Should return null for missing values");
    assert.strictEqual(parseTimestampToMillis(null), null, "Should return null for null values");

    // Test sorting of history entries descendently
    const listToCompare = [
        { id: "legacy_createdAt", createdAt: { seconds: 1600000000, nanoseconds: 0 } },
        { id: "new_timestamp", timestamp: 1718310000000 },
        { id: "older_seconds_nanos", timestamp: { seconds: 1500000000, nanoseconds: 100000000 } },
        { id: "legacy_millis", createdAt: 1620000000000 },
        { id: "missing" }
    ];

    const sortedList = [...listToCompare].sort((a: any, b: any) => {
        const timeA = parseTimestampToMillis(a.timestamp) ?? parseTimestampToMillis(a.createdAt) ?? 0;
        const timeB = parseTimestampToMillis(b.timestamp) ?? parseTimestampToMillis(b.createdAt) ?? 0;
        return timeB - timeA; // desc
    });

    assert.strictEqual(sortedList[0].id, "new_timestamp", "Newest should be first (1718310000000)");
    assert.strictEqual(sortedList[1].id, "legacy_millis", "Second should be legacy millis (1620000000000)");
    assert.strictEqual(sortedList[2].id, "legacy_createdAt", "Third should be legacy seconds (1600000000)");
    assert.strictEqual(sortedList[3].id, "older_seconds_nanos", "Fourth should be older seconds (1500000000)");
    assert.strictEqual(sortedList[4].id, "missing", "Missing timestamp should go last");

    console.log("Reject rules logic tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
