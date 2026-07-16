export interface MembershipResolution {
    role: string | null;
    status: string | null;
}

export function resolveMembershipRoleAndStatus(
    authUid: string,
    orgData: any | null,
    directMemberData: any | null,
    crossMemberData1: any | null,
    crossMemberData2: any | null
): MembershipResolution {
    let orgRole: string | null = null;
    let membershipStatus: string | null = null;

    if (directMemberData) {
        orgRole = directMemberData.role || directMemberData.organizationRole || null;
        membershipStatus = directMemberData.status !== undefined ? directMemberData.status : 'active';
    } else if (crossMemberData1) {
        orgRole = crossMemberData1.role || crossMemberData1.organizationRole || null;
        membershipStatus = crossMemberData1.status !== undefined ? crossMemberData1.status : 'active';
    } else if (crossMemberData2) {
        orgRole = crossMemberData2.role || crossMemberData2.organizationRole || null;
        membershipStatus = crossMemberData2.status !== undefined ? crossMemberData2.status : 'active';
    }

    if (orgData && (orgData.ownerUid === authUid || orgData.ownerId === authUid)) {
        orgRole = 'owner';
        membershipStatus = 'active';
    }

    return {
        role: orgRole,
        status: membershipStatus
    };
}
