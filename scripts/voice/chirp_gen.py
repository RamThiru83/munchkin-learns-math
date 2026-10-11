# Record sentences with Google Cloud Text-to-Speech, Chirp 3 HD "Achernar" (the Little Scientists Club narrator).
# Run in Google Cloud Shell, project little-scientists-511103 (Text-to-Speech API enabled):
#   python3 chirp_gen.py todo.json        -> voice_clips.zip   then   cloudshell download voice_clips.zip
# todo.json = {"voice": "Achernar", "rate": 0.9, "items": {"<file name>": "<sentence>", ...}}
# Safe to re-run: clips already made are skipped.
import json, subprocess, urllib.request, urllib.error, base64, os, sys, zipfile, time, threading
from concurrent.futures import ThreadPoolExecutor

PROJECT = 'little-scientists-511103'
plan = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'todo.json'))
voice, rate, items = plan.get('voice', 'Achernar'), plan.get('rate', 0.9), plan['items']
os.makedirs('clips', exist_ok=True)
lock = threading.Lock()
tok = {'t': '', 'at': 0}

def token():
    with lock:
        if time.time() - tok['at'] > 1500:
            tok['t'] = subprocess.check_output(['gcloud', 'auth', 'print-access-token']).decode().strip()
            tok['at'] = time.time()
        return tok['t']

def call(text):
    body = {'input': {'text': text}, 'voice': {'languageCode': 'en-US', 'name': 'en-US-Chirp3-HD-' + voice},
            'audioConfig': {'audioEncoding': 'MP3', 'sampleRateHertz': 24000, 'speakingRate': rate}}
    h = {'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT}
    q = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize', json.dumps(body).encode(), h)
    return base64.b64decode(json.load(urllib.request.urlopen(q, timeout=60))['audioContent'])

fails = []
def job(kv):
    name, text = kv
    fn = 'clips/' + name
    if os.path.exists(fn) and os.path.getsize(fn) > 0: return
    for k in range(6):
        try:
            data = call(text)
            open(fn, 'wb').write(data); return
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:160]
            if e.code in (400,): fails.append((name, text, msg)); return
            time.sleep(2 + 3 * k)
        except Exception as e:
            time.sleep(2 + 3 * k)
    fails.append((name, text, 'gave up'))

todo = list(items.items())
print('sentences:', len(todo))
with ThreadPoolExecutor(6) as ex:
    for i, _ in enumerate(ex.map(job, todo)):
        if i % 200 == 0: print('done', i, flush=True)
json.dump({'voice': voice, 'rate': rate, 'fails': fails}, open('clips/_report.json', 'w'))
z = zipfile.ZipFile('voice_clips.zip', 'w', zipfile.ZIP_STORED)
for f in sorted(os.listdir('clips')): z.write('clips/' + f, f)
z.close()
print('DONE clips:', len(os.listdir('clips')) - 1, 'fails:', len(fails), 'zip bytes:', os.path.getsize('voice_clips.zip'))
for f in fails[:10]: print('FAIL', f)
