import os, re, json, glob, requests, time
from xml.etree import ElementTree as ET

OLLAMA_URL = 'http://localhost:11434'
XML_DIR = r'C:\Users\del\Desktop\Work\MedTator\sample\VAERS_20_NOTES\ann_xml'
TAG_NAMES = ['Vaccine','Fever','Pain','Headache','Myalgia','Fatigue',
    'Nasal_obstruction','Diarrhea','Nausea','Vomiting',
    'Sore_throat','Dyspnea','Cough','Chill','Delirium','Hypersomnia','Other']

NEGATION_PRE = re.compile(r'\b(denies?|no |not |doesn\'t have|did not have|without|negative for|no evidence of|absent)\b', re.IGNORECASE)
NEGATION_POST = re.compile(r'\b(absent|not found|not present|none|: none|negative)\b', re.IGNORECASE)
SCOPE_BREAKERS = re.compile(r'[.!?]|\b(but|however|although|except|yet|while)\b', re.IGNORECASE)

xml_path = sorted(glob.glob(os.path.join(XML_DIR, '*.xml')))[0]
tree = ET.parse(xml_path)
root = tree.getroot()
text = root.find('TEXT').text or ''

gold_tags = []
for el in root.find('TAGS') or []:
    m = re.match(r'(\d+)~(\d+)', el.get('spans', ''))
    if m:
        gold_tags.append({'tag': el.tag, 'start': int(m.group(1)), 'end': int(m.group(2)),
                          'certainty': el.get('certainty', 'positive')})
gold_positive = [t for t in gold_tags if t['certainty'] != 'negated']

print(f'File: {os.path.basename(xml_path)}')
print(f'Gold positive ({len(gold_positive)}):')
for g in gold_positive:
    print(f'  [{g["tag"]}] {repr(text[g["start"]:g["end"]])}')
print()

tag_list = ', '.join(TAG_NAMES)
prompt = f"""You are a clinical text annotation assistant.
Identify medical concepts in the following text and classify them using ONLY these exact tag names: {tag_list}

Return JSON only, no explanation. Format:
{{"annotations": [{{"keyword": "exact phrase from text", "tag": "TagName"}}]}}

Rules:
- ONLY use these exact tag names: {tag_list}
- Extract the exact phrase as it appears in the text
- Do NOT include IDs, offsets, or extra fields

Text:
{text[:2000]}"""

print('Calling qwen3:8b...')
t0 = time.time()
resp = requests.post(f'{OLLAMA_URL}/api/chat',
    json={'model': 'qwen3:8b', 'messages': [{'role': 'user', 'content': prompt}],
          'stream': False, 'format': 'json', 'options': {'temperature': 0}}, timeout=120)
elapsed = time.time() - t0
content = resp.json()['message']['content']
content = re.sub(r'```json\s*|\s*```', '', content).strip()
if not content.startswith('{'):
    m = re.search(r'\{[\s\S]*\}', content)
    content = m.group(0) if m else '{}'
data = json.loads(content)
llm_anns = data.get('annotations') or []
print(f'Elapsed: {elapsed:.1f}s  |  LLM returned {len(llm_anns)} annotations')
print()

def get_locs(keyword, text):
    pattern = re.escape(keyword).replace(r'\ ', r'\s+')
    return [(m.start(), m.end()) for m in re.finditer(pattern, text, re.IGNORECASE)]

def is_negated(start, end, text):
    pre = text[max(0, start - 60):start]
    bks = list(SCOPE_BREAKERS.finditer(pre))
    if bks: pre = pre[bks[-1].end():]
    if NEGATION_PRE.search(pre): return True
    post = text[end:end + 30]
    bks = list(SCOPE_BREAKERS.finditer(post))
    if bks: post = post[:bks[0].start()]
    return bool(NEGATION_POST.search(post))

predicted = []
for ann in llm_anns:
    if ann.get('tag') not in TAG_NAMES:
        continue
    for s, e in get_locs(ann['keyword'], text):
        neg = is_negated(s, e, text)
        predicted.append({'tag': ann['tag'], 'start': s, 'end': e, 'negated': neg})

print(f'Located spans ({len(predicted)}):')
for p in predicted:
    flag = ' [NEGATED]' if p['negated'] else ''
    print(f'  [{p["tag"]}] {repr(text[p["start"]:p["end"]][:60])}{flag}')
print()

def spans_overlap(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1

for use_neg in [False, True]:
    pred = [p for p in predicted if not (use_neg and p['negated'])]
    matched = set()
    tp = 0
    for p in pred:
        for i, g in enumerate(gold_positive):
            if i in matched:
                continue
            if p['tag'] == g['tag'] and spans_overlap(p['start'], p['end'], g['start'], g['end']):
                tp += 1
                matched.add(i)
                break
    fp = len(pred) - tp
    fn = len(gold_positive) - tp
    pr = tp / (tp + fp) if (tp + fp) else 0
    rc = tp / (tp + fn) if (tp + fn) else 0
    f1 = 2 * pr * rc / (pr + rc) if (pr + rc) else 0
    label = 'negation=ON ' if use_neg else 'negation=OFF'
    print(f'{label}  TP={tp} FP={fp} FN={fn}  P={pr:.2f} R={rc:.2f} F1={f1:.2f}')
    missed = [g for i, g in enumerate(gold_positive) if i not in matched]
    for g in missed:
        print(f'  missed: [{g["tag"]}] {repr(text[g["start"]:g["end"]])}')
