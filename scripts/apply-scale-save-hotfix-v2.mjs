import './apply-scale-save-hotfix.mjs';
import fs from 'node:fs';

const path = 'firestore.rules';
let rules = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "allow create: if isAuthenticated() && (hasCanonicalPermission(incoming().get('organizationId', ''), 'canManageScales') || hasLegacyUsersOnlyPermission(incoming().get('organizationId', ''), 'canManageScales') || hasPermission(incoming().get('organizationId', ''), 'canManageScales')) && isOrgActive(incoming().get('organizationId', ''));",
    "allow create: if isAuthenticated() && (hasCanonicalLiveSessionAuthority(incoming().get('organizationId', '')) || hasCanonicalPermission(incoming().get('organizationId', ''), 'canManageScales') || hasLegacyUsersOnlyPermission(incoming().get('organizationId', ''), 'canManageScales') || hasPermission(incoming().get('organizationId', ''), 'canManageScales')) && isOrgActive(incoming().get('organizationId', ''));"
  ],
  [
    "allow update: if isAuthenticated() && hasPermission(resource.data.get('organizationId', ''), 'canManageScales') && checkOrgAccess(resource.data.get('organizationId', '')) && isOrgActive(resource.data.get('organizationId', '')) && (!('organizationId' in request.resource.data) || request.resource.data.get('organizationId', '') == resource.data.get('organizationId', ''));",
    "allow update: if isAuthenticated() && (hasCanonicalLiveSessionAuthority(resource.data.get('organizationId', '')) || hasPermission(resource.data.get('organizationId', ''), 'canManageScales')) && checkOrgAccess(resource.data.get('organizationId', '')) && isOrgActive(resource.data.get('organizationId', '')) && (!('organizationId' in request.resource.data) || request.resource.data.get('organizationId', '') == resource.data.get('organizationId', ''));"
  ],
  [
    "allow delete: if isAuthenticated() && hasPermission(resource.data.get('organizationId', ''), 'canManageScales') && checkOrgAccess(resource.data.get('organizationId', '')) && isOrgActive(resource.data.get('organizationId', ''));",
    "allow delete: if isAuthenticated() && (hasCanonicalLiveSessionAuthority(resource.data.get('organizationId', '')) || hasPermission(resource.data.get('organizationId', ''), 'canManageScales')) && checkOrgAccess(resource.data.get('organizationId', '')) && isOrgActive(resource.data.get('organizationId', ''));"
  ],
  [
    "allow create: if isAuthenticated() && hasPermission(incoming().get('organizationId', ''), 'canManageScales') && isOrgActive(incoming().get('organizationId', ''));",
    "allow create: if isAuthenticated() && (hasCanonicalLiveSessionAuthority(incoming().get('organizationId', '')) || hasPermission(incoming().get('organizationId', ''), 'canManageScales')) && isOrgActive(incoming().get('organizationId', ''));"
  ],
  [
    "allow delete: if isAuthenticated() && hasPermission(resource.data.get('organizationId', ''), 'canManageScales') && checkOrgAccess(resource.data.get('organizationId', ''));",
    "allow delete: if isAuthenticated() && (hasCanonicalLiveSessionAuthority(resource.data.get('organizationId', '')) || hasPermission(resource.data.get('organizationId', ''), 'canManageScales')) && checkOrgAccess(resource.data.get('organizationId', ''));"
  ]
];

for (const [before, after] of replacements) {
  if (!rules.includes(before)) throw new Error(`Expected scale write rule not found: ${before}`);
  rules = rules.replaceAll(before, after);
}

fs.writeFileSync(path, rules);
console.log('Fast canonical scale-management write path applied.');
