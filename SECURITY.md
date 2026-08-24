# Security Policy

Security issues must be reported privately. **Do not open a public issue, discussion, or pull request containing an undisclosed vulnerability, credential, token, production data, personal data, or exploit details.**

## Reporting a vulnerability

For this public repository, use GitHub **Private Vulnerability Reporting** / **Repository Security Advisories** when the feature is available under the repository's **Security and quality** tab.

Please include, when possible:

- affected commit, branch, endpoint, component, or workflow;
- impact and realistic attack scenario;
- minimal reproduction steps;
- whether authentication or a specific role is required;
- suggested mitigation, if known.

Do not include real user data or real production secrets in the report. Use synthetic examples and redact credentials.

## Scope priorities

Reports involving the following areas are especially sensitive:

- tenant isolation and `organizationId` boundaries;
- Firebase Authentication and authorization;
- RBAC, memberships, owners, invitations, and global roles;
- Firestore Security Rules;
- server-side API authorization;
- billing/entitlements integration with MillionsNest;
- credentials, tokens, service accounts, GitHub Actions, Vercel, or Firebase deployment paths;
- AI endpoints that could expose secrets or bypass quotas/entitlements;
- unauthorized access to songs, scales, members, notifications, or organization data.

## Disclosure

Please allow reasonable time for investigation and remediation before public disclosure. Security fixes may be developed privately through GitHub Security Advisories when appropriate.

## Support and bounty

This policy does not create a bug-bounty program or promise payment. Good-faith reports are welcome and will be evaluated according to impact and reproducibility.

## License

Security research remains subject to the repository's `LICENSE`. The license permits good-faith security research for this Software but does not authorize production use, redistribution, commercialization, destructive testing, unauthorized access to third-party data, or attacks against users or infrastructure.
