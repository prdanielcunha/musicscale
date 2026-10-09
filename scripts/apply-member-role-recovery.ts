/**
 * Historical write-based member role migration is intentionally quarantined.
 *
 * The earlier recovery implementation trusted mutable user navigation context
 * (activeOrganizationId / primaryOrganizationId). It could assign a music
 * role to the wrong tenant or overwrite a more recent projection.
 *
 * Do not reintroduce writes here. Use audit-member-role-recovery.ts for
 * privacy-safe aggregate counts; a future repair must require an exact
 * per-organization signed manifest, compare-and-set preconditions, an audit
 * record and validated rollback backup, never just a global scan.
 */
throw new Error('ROLE_RECOVERY_WRITE_DISABLED_PENDING_TENANT_SCOPED_P0_APPROVAL');
