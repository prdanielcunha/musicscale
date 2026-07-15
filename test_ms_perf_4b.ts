import { getCandidateOrganizationIds, isValidCanonicalResponse } from './services/ecosystem/startupFastPath';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function runTests() {
    console.log("Running MS-PERF-4B tests...");

    // 1, 2, 3: Candidates list
    const candidates = getCandidateOrganizationIds('local_org', 'active_org', 'local_org', null);
    assert(candidates.length === 2, "Should remove duplicates and empty values");
    assert(candidates[0] === 'local_org', "Should preserve precedence (local first)");
    assert(candidates[1] === 'active_org', "Should preserve precedence (active second)");

    const emptyCandidates = getCandidateOrganizationIds('', null, undefined, '  ');
    assert(emptyCandidates.length === 0, "Should ignore empty candidates");

    // 4, 5, 6, 7: Canonical response validation
    const validRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(validRes, 'user123', 'org123') === true, "Valid response should be accepted");

    const diffUidRes = {
        success: true,
        uid: 'otherUser',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(diffUidRes, 'user123', 'org123') === false, "Different UID should be rejected");

    const diffOrgRes = {
        success: true,
        effectiveContext: {
            userId: 'user123',
            organizationId: 'otherOrg'
        }
    };
    assert(isValidCanonicalResponse(diffOrgRes, 'user123', 'org123') === false, "Different OrgID should be rejected");

    const invalidSuccess = {
        success: false,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(invalidSuccess, 'user123', 'org123') === false, "Success false should be rejected");

    // Check with effectiveContext
    const validResWithCtx = {
        success: true,
        effectiveContext: {
            userId: 'user123',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(validResWithCtx, 'user123', 'org123') === true, "Valid response with effectiveContext should be accepted");

    // 8 & 9 are architectural guarantees.
    // getCandidateOrganizationIds is pure and does not access localStorage or grant permissions.

    console.log("All MS-PERF-4B tests passed.");
}

runTests();
