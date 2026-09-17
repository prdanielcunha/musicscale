const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-(beta)(?:\.(\d+))?)?$/;

export function parseReleaseVersion(value) {
  const match = SEMVER_PATTERN.exec(String(value));
  if (!match) throw new Error(`Invalid release version: ${value}`);

  const prerelease = match[4] || null;
  const iteration = prerelease ? Number(match[5] ?? 0) : null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
    iteration,
    stable: !prerelease,
  };
}

export function compareReleaseVersions(leftValue, rightValue) {
  const left = parseReleaseVersion(leftValue);
  const right = parseReleaseVersion(rightValue);

  for (const key of ['major', 'minor', 'patch']) {
    const difference = left[key] - right[key];
    if (difference !== 0) return Math.sign(difference);
  }

  if (left.stable !== right.stable) return left.stable ? 1 : -1;
  if (left.stable) return 0;
  return Math.sign((left.iteration ?? 0) - (right.iteration ?? 0));
}

export function bumpReleaseVersion(value, kind) {
  const current = parseReleaseVersion(value);

  if (kind === 'minor') {
    return `${current.major}.${current.minor + 1}.0-beta.0`;
  }
  if (kind === 'patch') {
    return `${current.major}.${current.minor}.${current.patch + 1}-beta.0`;
  }
  if (kind === 'revision' || kind === 'visual') {
    if (current.stable) {
      throw new Error('Visual/revision bumps require a beta prerelease.');
    }
    return `${current.major}.${current.minor}.${current.patch}-beta.${(current.iteration ?? 0) + 1}`;
  }

  throw new Error('Use release:minor, release:patch, release:revision or release:visual');
}

export { SEMVER_PATTERN };
