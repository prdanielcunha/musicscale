#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BUCKET:-millionsnest.firebasestorage.app}"
PREFIX="${PREFIX:-musicscale/pads/official/warm-v1}"
SOURCE_DIR="${SOURCE_DIR:-/tmp/musicscale-warm-pads}"

SOURCE_FILES=(
  'Pad_C_Warm.mp3' 'Pad_C#_Warm.mp3' 'Pad_D_Warm.mp3' 'Pad_D#_Warm.mp3'
  'Pad_E_Warm.mp3' 'Pad_F_Warm.mp3' 'Pad_F#_Warm.mp3' 'Pad_G_Warm.mp3'
  'Pad_G#_Warm.mp3' 'Pad_A_Warm.mp3' 'Pad_A#_Warm.mp3' 'Pad_B_Warm.mp3'
)
DEST_FILES=(
  'C.mp3' 'Cs.mp3' 'D.mp3' 'Eb.mp3'
  'E.mp3' 'F.mp3' 'Fs.mp3' 'G.mp3'
  'Ab.mp3' 'A.mp3' 'Bb.mp3' 'B.mp3'
)
SHAS=(
  0312b26b467cbfbcbd7bc5e8ebcf9a90f4e977b10688839e2a2a8ef4a224173c
  f8f1b19873635a9a84a126d5ccb16841b0c97e17e784e18313d32e26ce2a8dfd
  3f87621e4f70a05e40c5e56eb6b9d93fcd8ea6ce8ec1081ec58f883c9bf49673
  1aec1c3dc0efc5a3c09851cac6495b753aba63080035a97daa43246791eee403
  3ed6187d8e6f5fc0b8ca1f094d4afc4fc691ec03746ab7c0febecea8d5a5e1fe
  b7b0ac5e6ee41f108113cdc0d424a0e1dff2919a7e5a79297fa2b0be0d1d01e0
  97ef632ae1028b8a526cbe9f0cf80ff06325a597765d2745771239181c0b1278
  6edbb967f9d7b949f43fe6a8bc62639833a27833e1cb64a5cb44ed9b5d6c741b
  285a3a31e9c5cfa55598add7cfc460645722a3f16853d882ae88325e2c46cd3c
  ebffdefb14fe5be840efc2237a96681cb79ba595de519531c00d8b0cda368255
  8686296cdb38c7a139d60a3989779e80eb37bb6db282ab559cea60cd83ca5d97
  bb64f1199fde3b9bcf224552fa0ba0938ce4be0c297e8eef7d2e05e650ef2de8
)

mkdir -p /tmp/musicscale-storage-readback

for i in "${!DEST_FILES[@]}"; do
  source_file="$SOURCE_DIR/${SOURCE_FILES[$i]}"
  dest_file="${DEST_FILES[$i]}"
  expected="${SHAS[$i]}"
  object="gs://$BUCKET/$PREFIX/$dest_file"
  remote_file="/tmp/musicscale-storage-readback/$dest_file"

  test -f "$source_file"
  source_sha="$(sha256sum "$source_file" | cut -d' ' -f1)"
  test "$source_sha" = "$expected"

  if gcloud storage cp "$object" "$remote_file" --quiet >/dev/null 2>&1; then
    existing_sha="$(sha256sum "$remote_file" | cut -d' ' -f1)"
    test "$existing_sha" = "$expected"
    echo "Already verified: $object"
    continue
  fi

  gcloud storage cp "$source_file" "$object" --content-type=audio/mpeg --quiet
  rm -f "$remote_file"
  gcloud storage cp "$object" "$remote_file" --quiet
  remote_sha="$(sha256sum "$remote_file" | cut -d' ' -f1)"
  test "$remote_sha" = "$expected"
  echo "Verified: $object"
done

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "Canonical Warm pads verified: **12/12**"
    echo
    echo "Bucket: **$BUCKET**"
    echo "Prefix: **$PREFIX/**"
    echo "All source and read-back SHA-256 values matched."
  } >> "$GITHUB_STEP_SUMMARY"
fi
