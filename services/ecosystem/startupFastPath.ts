export function getCandidateOrganizationIds(
    localOrgId: string | null | undefined,
    activeOrgId: string | null | undefined,
    primaryOrgId: string | null | undefined,
    legacyOrgId: string | null | undefined
): string[] {
    const candidates = [localOrgId, activeOrgId, primaryOrgId, legacyOrgId];
    const result: string[] = [];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim() !== '') {
            const id = c.trim();
            if (!result.includes(id)) {
                result.push(id);
            }
        }
    }
    return result;
}

export function isValidCanonicalResponse(
    response: any,
    expectedUid: string,
    expectedOrgId: string
): boolean {
    if (!response || response.success !== true) return false;
    if (!expectedUid || !expectedOrgId) return false;
    
    // Check if there is at least one UID and one OrgID
    const resUids = [];
    if (response.uid) resUids.push(response.uid);
    if (response.userId) resUids.push(response.userId);
    if (response.effectiveContext) {
        if (response.effectiveContext.uid) resUids.push(response.effectiveContext.uid);
        if (response.effectiveContext.userId) resUids.push(response.effectiveContext.userId);
    }
    
    const resOrgIds = [];
    if (response.organizationId) resOrgIds.push(response.organizationId);
    if (response.currentOrganizationId) resOrgIds.push(response.currentOrganizationId);
    if (response.effectiveContext) {
        if (response.effectiveContext.organizationId) resOrgIds.push(response.effectiveContext.organizationId);
        if (response.effectiveContext.currentOrganizationId) resOrgIds.push(response.effectiveContext.currentOrganizationId);
    }

    if (resUids.length === 0 || resOrgIds.length === 0) return false;

    // All present UIDs must exactly match expectedUid
    for (const u of resUids) {
        if (u !== expectedUid) return false;
    }

    // All present OrgIDs must exactly match expectedOrgId
    for (const o of resOrgIds) {
        if (o !== expectedOrgId) return false;
    }

    return true;
}
