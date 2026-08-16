#!/usr/bin/env bash
set -euo pipefail

JDK_HOME="$HOME/.cache/musicscale-corretto21"
ARCHIVE="/tmp/amazon-corretto-21-x64-linux-jdk.tar.gz"
DOWNLOAD_URL="https://corretto.aws/downloads/latest/amazon-corretto-21-x64-linux-jdk.tar.gz"
CHECKSUM_URL="https://corretto.aws/downloads/latest_sha256/amazon-corretto-21-x64-linux-jdk.tar.gz"

if [[ ! -x "$JDK_HOME/bin/java" ]]; then
  echo "[QA_EMULATOR] Downloading Amazon Corretto 21 into build-local cache"
  rm -rf "$JDK_HOME" /tmp/amazon-corretto-21-*
  curl -fsSL "$DOWNLOAD_URL" -o "$ARCHIVE"
  expected_sha="$(curl -fsSL "$CHECKSUM_URL" | tr -d '[:space:]')"
  actual_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  if [[ -z "$expected_sha" || "$expected_sha" != "$actual_sha" ]]; then
    echo "[QA_EMULATOR] Corretto 21 SHA256 mismatch" >&2
    exit 1
  fi
  mkdir -p "$JDK_HOME"
  tar -xzf "$ARCHIVE" -C "$JDK_HOME" --strip-components=1
fi

export JAVA_HOME="$JDK_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
export CI=true
export GCLOUD_PROJECT=demo-musicscale
export GOOGLE_CLOUD_PROJECT=demo-musicscale

echo "[QA_EMULATOR] Java runtime:"
java -version

echo "[QA_EMULATOR] Starting real Auth + Firestore Emulator contract gates"
npx firebase emulators:exec --project demo-musicscale --only auth,firestore \
  "npm run test:emulator:global-search && npm run test:emulator:security"
