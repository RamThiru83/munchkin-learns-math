# Quality check for recorded clips: transcribe each clip with Whisper and compare with its text.
# Run in Google Cloud Shell next to chirp_gen.py (same folder, after it has made clips/):
#   pip install --user -q faster-whisper imageio-ffmpeg && python3 asr_check.py voice-todo.json  -> asr_report.json
# Reports clips whose transcript differs (missing words, cut-off endings). Numbers are compared as digits.
import json, sys, re, os, difflib, subprocess
import numpy as np, shutil

FFMPEG = shutil.which('ffmpeg')
if not FFMPEG:  # Cloud Shell has no ffmpeg: use the one bundled with imageio-ffmpeg
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
from faster_whisper import WhisperModel

items = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'voice-todo.json'))['items']
W = {'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7',
     'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14',
     'fifteen': '15', 'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20'}

def norm(s):
    s = s.lower().replace('’', "'").replace('-', ' ')
    s = re.sub(r"[^a-z0-9' ]", ' ', s)
    return [W.get(w, w) for w in s.split()]

m = WhisperModel('base.en', device='cpu', compute_type='int8')
out = []
names = sorted(items)
for i, n in enumerate(names):
    f = 'clips/' + n
    if not os.path.exists(f):
        out.append({'clip': n, 'text': items[n], 'heard': None, 'score': 0}); continue
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', f, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(audio, language='en', beam_size=5, condition_on_previous_text=False)
    heard = ' '.join(s.text.strip() for s in segs)
    a, b = norm(items[n]), norm(heard)
    score = difflib.SequenceMatcher(None, a, b).ratio()
    out.append({'clip': n, 'text': items[n], 'heard': heard, 'score': round(score, 3),
                'last_word_ok': bool(a and b and a[-1] == b[-1])})
    if i % 100 == 0: print(i, flush=True)
json.dump(out, open('asr_report.json', 'w'), indent=0)
bad = [r for r in out if r['score'] < 0.8 or not r.get('last_word_ok', True)]
print('checked', len(out), 'flagged', len(bad))
for r in bad[:40]: print(r['score'], '|', r['text'], '|', r['heard'])
