"""Record the game's spoken lines with ElevenLabs (Multilingual v2) into assets/voice/ as Ogg Opus (mono, 24 kbps; needs ffmpeg).

    XI_API_KEY=... python3 tools/voice_gen.py            # makes only the clips that are missing
    XI_API_KEY=... python3 tools/voice_gen.py --redo     # re-record everything

Lines come from tools/voice_lines.json: [{"text": "...", "who": "meher" | "kabir"}].
The key is read from the environment only; never commit it or put it in the game.
Clip names use the same key as vkey() in js/ui.js, so the game finds them by their text.
"""
import json, os, re, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'voice')
VOICES = {                       # SKAI voice library, Grades 3 to 5 (players are in Grade 5)
    'meher': 'UY2X2JSQAOP590VlCKdd',   # Anamika: warm Indian female narrator, Meher Didi + read-aloud
    'kabir': 'ylPWAZ8HXA7SvyEKkPK8',   # Vishal: warm, deep Indian male, Kabir the rider captain
}
MODEL = 'eleven_multilingual_v2'
SETTINGS = {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.2, 'use_speaker_boost': True}


def vkey(text):  # must match vkey() in js/ui.js (FNV-1a over UTF-16 code units, base 36)
    s = re.sub(r'\s+', ' ', re.sub('[“”"‘’\'.,?!:;·=]', ' ', text)).strip().lower()
    x = 0x811c9dc5
    for ch in s.encode('utf-16-le').decode('utf-16-le'):
        for unit in ([ord(ch)] if ord(ch) < 0x10000 else [0xD800 + ((ord(ch) - 0x10000) >> 10), 0xDC00 + ((ord(ch) - 0x10000) & 0x3FF)]):
            x ^= unit
            x = (x * 0x01000193) & 0xFFFFFFFF
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    out = ''
    while True:
        x, r = divmod(x, 36)
        out = digits[r] + out
        if not x:
            return out


def spoken(text):  # what the voice actually says (symbols read badly aloud)
    t = text.replace('“', '').replace('”', '').replace('"', '')
    t = re.sub(r'([?!:])\.', r'\1', t).replace('..', '.').replace(' = ', ' means ')
    t = t.replace(' · ', ', ').replace('·', ', ').replace('₹', 'rupees ').replace('#', 'number ')
    t = re.sub(r'(\d+) min\b', r'\1 minutes', t)
    return re.sub(r'\s+', ' ', t).strip()


def tts(text, voice, key):
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
        data=json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS}).encode(),
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1)); continue
            raise SystemExit(f'ElevenLabs error {e.code}: {e.read()[:300]!r}')


def main():
    key = os.environ.get('XI_API_KEY') or sys.exit('Set XI_API_KEY in the environment.')
    lines = json.load(open(os.path.join(ROOT, 'tools', 'voice_lines.json')))
    os.makedirs(OUT, exist_ok=True)
    redo = '--redo' in sys.argv
    index = {}
    for i, ln in enumerate(lines):
        k = vkey(ln['text'].replace('“', '').replace('”', '').replace('"', ''))
        name = k + '.ogg'
        path = os.path.join(OUT, name)
        if redo or not os.path.exists(path):
            audio = tts(spoken(ln['text']), VOICES[ln.get('who', 'meher')], key)   # high-quality MP3 master, kept only in memory
            subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '24k', '-ac', '1', '-application', 'voip', path], input=audio, check=True)
            print(f'{i + 1}/{len(lines)} {ln.get("who", "meher"):5} {os.path.getsize(path) // 1024:3} KB  {ln["text"][:70]}')
        index[k] = name
    for f in os.listdir(OUT):   # drop clips no longer used
        if f.endswith(('.ogg', '.mp3')) and f not in index.values():
            os.remove(os.path.join(OUT, f))
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in index.values())
    print(f'{len(index)} clips, {total / 1024 / 1024:.2f} MB')


if __name__ == '__main__':
    main()
