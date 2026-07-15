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
    
    // We expect the payload effectiveContext.userId or .organizationId to match.
    // If they exist, they must match perfectly.
    const ctx = response.effectiveContext;
    if (ctx) {
        if (ctx.userId && ctx.userId !== expectedUid) return false;
        if (ctx.organizationId && ctx.organizationId !== expectedOrgId) return false;
    }
    
    // We may also check top-level if the API puts it there.
    if (response.uid && response.uid !== expectedUid) return false;
    if (response.userId && response.userId !== expectedUid) return false;
    if (response.organizationId && response.organizationId !== expectedOrgId) return false;
    if (response.currentOrganizationId && response.currentOrganizationId !== expectedOrgId) return false;

    return true;
}
