import process from 'node:process';

export const REVIEWER_HIGH_STATUS_CONTEXT = 'reviewer-high';
export const REVIEWER_HIGH_SCHEMA = 'musicscale.reviewer-high.v1';
export const REVIEWER_HIGH_DESCRIPTION = 'reviewer-high: APPROVED; attestation=target-url';

function fail(code) {
  throw new Error(code);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`REVIEWER_HIGH_${name}_MISSING`);
  return value;
}

function readUniqueQueryParameter(url, name) {
  const values = url.searchParams.getAll(name);
  if (values.length !== 1) fail(`REVIEWER_HIGH_${name.toUpperCase()}_AMBIGUOUS`);
  return values[0];
}

export function validateReviewerHighStatuses(statuses, expected) {
  if (!Array.isArray(statuses)) fail('REVIEWER_HIGH_STATUSES_MALFORMED');

  const matching = statuses.filter((status) =>
    status.context === REVIEWER_HIGH_STATUS_CONTEXT &&
    status.state === 'success',
  );

  // A single canonical status prevents an older or competing attestation from
  // being selected opportunistically by the privileged executor.
  if (matching.length !== 1) fail('REVIEWER_HIGH_CANONICAL_STATUS_NOT_UNIQUE');

  const [status] = matching;
  if (status.description !== REVIEWER_HIGH_DESCRIPTION) {
    fail('REVIEWER_HIGH_DESCRIPTION_MISMATCH');
  }

  let target;
  try {
    target = new URL(status.target_url);
  } catch {
    fail('REVIEWER_HIGH_ATTESTATION_MALFORMED');
  }

  if (target.origin !== 'https://github.com' || target.pathname !== `/${expected.repository}/commit/${expected.sha}`) {
    fail('REVIEWER_HIGH_TARGET_URL_MISMATCH');
  }

  const requiredFields = {
    schema: REVIEWER_HIGH_SCHEMA,
    certification_report: 'APPROVED',
    reviewed_sha: expected.sha,
    authorized_sha: expected.authorizedSha,
    workflow_path: expected.workflowPath,
    workflow_ref: expected.workflowRef,
  };

  for (const [field, value] of Object.entries(requiredFields)) {
    if (readUniqueQueryParameter(target, field) !== value) {
      fail(`REVIEWER_HIGH_${field.toUpperCase()}_MISMATCH`);
    }
  }

  return { statusId: status.id, targetUrl: target.toString() };
}

export async function fetchReviewerHighStatuses({ apiUrl, repository, sha, token, fetchImpl = fetch }) {
  let endpoint = new URL(`${apiUrl}/repos/${repository}/commits/${sha}/statuses`);
  endpoint.searchParams.set('per_page', '100');
  const statuses = [];
  for (let page = 0; endpoint && page < 10; page += 1) {
    const response = await fetchImpl(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) fail(`REVIEWER_HIGH_GITHUB_API_HTTP_${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) fail('REVIEWER_HIGH_GITHUB_API_PAYLOAD_MALFORMED');
    statuses.push(...payload);
    const next = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    endpoint = next ? new URL(next) : undefined;
  }
  if (endpoint) fail('REVIEWER_HIGH_STATUS_PAGINATION_LIMIT');
  return statuses;
}

async function main() {
  const expected = {
    sha: required('GITHUB_SHA'),
    authorizedSha: required('AUTHORIZED_SHA'),
    repository: required('GITHUB_REPOSITORY'),
    workflowPath: required('REVIEWER_HIGH_WORKFLOW_PATH'),
    workflowRef: required('REVIEWER_HIGH_WORKFLOW_REF'),
  };
  if (expected.sha !== expected.authorizedSha) fail('REVIEWER_HIGH_AUTHORIZED_SHA_MISMATCH');

  const statuses = await fetchReviewerHighStatuses({
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    repository: required('GITHUB_REPOSITORY'),
    sha: expected.sha,
    token: required('GITHUB_TOKEN'),
  });
  const { statusId } = validateReviewerHighStatuses(statuses, expected);
  console.log(`reviewer-high attestation verified (commit status ${statusId}).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
