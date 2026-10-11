#!/usr/bin/env bash
# Unzip recorded clips and trim silence: keep 40 ms before and 120 ms after the speech, then a short
# fade-out and 60 ms of padding (Chirp sometimes ends a clip abruptly, which would click).
#   bash scripts/voice/trim.sh voice_clips.zip <clips folder>
# Needs ffmpeg with libmp3lame. Clips already in the folder are kept (re-run is safe).
set -euo pipefail
zip="$1"; out="$2"
tmp="$(mktemp -d)"
unzip -q -o "$zip" -d "$tmp"
mkdir -p "$out"
n=0
for f in "$tmp"/*.mp3; do
  b="$(basename "$f")"
  [ -s "$out/$b" ] && continue
  ffmpeg -v error -y -i "$f" -ac 1 -ar 24000 \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,afade=t=in:d=0.02,areverse,afade=t=in:d=0.01,apad=pad_dur=0.06" \
    -c:a libmp3lame -b:a 32k "$out/$b"
  n=$((n + 1))
done
[ -f "$tmp/_report.json" ] && cp "$tmp/_report.json" "$out/_report.json"
rm -rf "$tmp"
echo "trimmed $n new clips into $out"
