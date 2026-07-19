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

    const sources = [
        directMemberData,
        crossMemberData1,
        crossMemberData2
    ];

    let foundRole = false;

    for (const source of sources) {
        if (source) {
            const role = source.role || source.organizationRole;
            if (role) {
                orgRole = role;
                membershipStatus = source.status !== undefined ? source.status : 'active';
                foundRole = true;
                break;
            }
        }
    }

    if (!foundRole) {
        for (const source of sources) {
            if (source) {
                membershipStatus = source.status !== undefined ? source.status : 'active';
            }
        }
    }

    if (orgData && (
        orgData.ownerUid === authUid || 
        orgData.ownerId === authUid || 
        orgData.ownerUserId === authUid || 
        orgData.owner_user_id === authUid
    )) {
        orgRole = 'owner';
        membershipStatus = 'active';
    }

    return {
        role: orgRole,
        status: membershipStatus
    };
}
