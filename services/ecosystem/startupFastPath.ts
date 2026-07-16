export function isGlobalOrganizationCatalogRole(role: unknown): boolean {
    const normalizedRole = String(role || '').toLowerCase().trim();
    const globalRoles = [
        'ceo',
        'founder',
        'ecosystem_owner',
        'owner',
        'dono',
        'admin',
        'global_admin',
        'administrador',
        'support',
        'suporte'
    ];
    return globalRoles.includes(normalizedRole);
}

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

    let hasUid = false;
    let hasOrgId = false;

    function checkField(obj: any, key: string, expected: string): boolean | 'skip' {
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (typeof val !== 'string') return false;
            if (val.trim() === '') return false;
            if (val !== expected) return false;
            return true;
        }
        return 'skip';
    }

    const uidFields = [
        { obj: response, key: 'uid' },
        { obj: response, key: 'userId' },
        { obj: response.effectiveContext, key: 'uid' },
        { obj: response.effectiveContext, key: 'userId' },
    ];

    for (const { obj, key } of uidFields) {
        const res = checkField(obj, key, expectedUid);
        if (res === false) return false;
        if (res === true) hasUid = true;
    }

    const orgFields = [
        { obj: response, key: 'organizationId' },
        { obj: response, key: 'currentOrganizationId' },
        { obj: response.effectiveContext, key: 'organizationId' },
        { obj: response.effectiveContext, key: 'currentOrganizationId' },
    ];

    for (const { obj, key } of orgFields) {
        const res = checkField(obj, key, expectedOrgId);
        if (res === false) return false;
        if (res === true) hasOrgId = true;
    }

    return hasUid && hasOrgId;
}
