#!/usr/bin/env bash
set -euo pipefail

: "${DRIVE_ACCESS_TOKEN:?DRIVE_ACCESS_TOKEN is required}"
: "${STORAGE_ACCESS_TOKEN:?STORAGE_ACCESS_TOKEN is required}"

BUCKET="${BUCKET:-millionsnest.firebasestorage.app}"
PREFIX="${PREFIX:-musicscale/pads/official/warm-v1}"
STORAGE_IDENTITY="${STORAGE_IDENTITY:-unknown}"

mkdir -p /tmp/musicscale-pads
cd /tmp/musicscale-pads

IDS=(
  1xCokteWYu9mfl7cSY_Opr6k2MykMYCHS
  1lFc7qDQqUtc3AeZp2FdIgt9OafXHGQO9
  1WG8KGU4KhH3rGpxRpztLLDRnNtOSdfKH
  1GQjlv_Y2Xfk8FrbqGiMn6t7t6HlqLHCp
  1PN9S6TCjw078CD2o8WaXuv_p0QR5k72Q
  1KDBlcGCQmyx2C7cyM9XWKg0YDJQdzu37
  1W4WloNlNVvbH0iE4qNebGGW2V5vkvzgT
  1K94GPpk76YieTt8BKQcAvxOOblAEfXTp
  1j8L-F9d7cJl7Tch0FI-5znWvqfbONWcl
  1vtc8JmjyFZL3KM_NDUVUxxVrr5NItF5P
  1IoTp6iMjjmTvJYH2-0DXmZxC3mOv7GEc
  1vRnGcZXXM1BdFTZtcGopWcgIfgFrGZZk
)
FILES=(
  'Pad_C_Warm.mp3' 'Pad_C#_Warm.mp3' 'Pad_D_Warm.mp3' 'Pad_D#_Warm.mp3'
  'Pad_E_Warm.mp3' 'Pad_F_Warm.mp3' 'Pad_F#_Warm.mp3' 'Pad_G_Warm.mp3'
  'Pad_G#_Warm.mp3' 'Pad_A_Warm.mp3' 'Pad_A#_Warm.mp3' 'Pad_B_Warm.mp3'
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

test "${#IDS[@]}" -eq 12
test "${#FILES[@]}" -eq 12
test "${#SHAS[@]}" -eq 12

for i in "${!FILES[@]}"; do
  file="${FILES[$i]}"
  id="${IDS[$i]}"
  expected="${SHAS[$i]}"
  drive_url="https://www.googleapis.com/drive/v3/files/$id?alt=media&supportsAllDrives=true"

  curl --fail --silent --show-error --location \
    --retry 4 --retry-delay 3 --retry-all-errors \
    -H "Authorization: Bearer $DRIVE_ACCESS_TOKEN" \
    "$drive_url" -o "$file"

  actual="$(sha256sum "$file" | cut -d' ' -f1)"
  test "$actual" = "$expected"
  echo "Source verified: $file"

  object="$PREFIX/$file"
  encoded="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$object")"

  remote_file="/tmp/remote-${i}.mp3"
  read_code="$(curl --silent --show-error --location \
    -H "Authorization: Bearer $STORAGE_ACCESS_TOKEN" \
    -o "$remote_file" -w '%{http_code}' \
    "https://storage.googleapis.com/storage/v1/b/$BUCKET/o/$encoded?alt=media")"

  if [[ "$read_code" == 200 ]]; then
    remote_sha="$(sha256sum "$remote_file" | cut -d' ' -f1)"
    if [[ "$remote_sha" == "$expected" ]]; then
      echo "Already verified: $object"
      continue
    fi
  fi

  upload_code="$(curl --silent --show-error --location \
    -X POST \
    -H "Authorization: Bearer $STORAGE_ACCESS_TOKEN" \
    -H "Content-Type: audio/mpeg" \
    --data-binary "@$file" \
    -o /tmp/upload-result.json -w '%{http_code}' \
    "https://storage.googleapis.com/upload/storage/v1/b/$BUCKET/o?uploadType=media&name=$encoded")"

  if [[ "$upload_code" != 200 ]]; then
    echo "Storage upload returned HTTP $upload_code for $object using $STORAGE_IDENTITY"
    cat /tmp/upload-result.json
    exit 1
  fi

  remote_sha="$(curl --fail --silent --show-error --location \
    --retry 4 --retry-delay 2 --retry-all-errors \
    -H "Authorization: Bearer $STORAGE_ACCESS_TOKEN" \
    "https://storage.googleapis.com/storage/v1/b/$BUCKET/o/$encoded?alt=media" \
    | sha256sum | cut -d' ' -f1)"
  test "$remote_sha" = "$expected"
  echo "Verified $object"
done

{
  echo '## MusicScale official Warm pads'
  echo
  echo "**Storage identity:** $STORAGE_IDENTITY"
  echo "**Bucket:** $BUCKET"
  echo "**Prefix:** $PREFIX/"
  echo '**Verified files:** 12/12'
  echo
  echo 'Every source and stored object matched its expected SHA-256.'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
