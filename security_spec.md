# Security Specification

## 1. Data Invariants
- A user can only read/write documents that belong to their `organizationId`.
- A user must have the corresponding permissions in their assigned role to perform write actions on resources (`canManageUsers`, `canManageRoles`, `canManageRepertoire`, `canManageScales`, `canManageChords`).
- Roles are tied to an `organizationId`. Admin roles can manage users and roles within that organization.

## 2. The "Dirty Dozen" Payloads
1. Cross-tenant read (querying another organization's data).
2. Cross-tenant write (creating data with another organizationId).
3. Role privilege escalation (user changing their own role to admin).
4. Orphaned user profile creation.
5. Updating system fields like createdAt or createdBy.
6. Deleting active events without proper permission.
7. Modifying another user's profile data safely.
8. Reassigning a song to another tenant.
9. Missing required schema fields during create.
10. Junk strings in location names (size limits).
11. PII exposure for user profiles.
12. Attempting to bypass role check via arrays.

## 3. Test Runner
Included via ESLint tests and Firebase Emulator.
