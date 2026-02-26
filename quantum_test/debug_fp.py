import os, re, json, glob, requests
from xml.etree import ElementTree as ET

OLLAMA_URL = 'http://localhost:11434'
XML_DIR = r'C:\Users\del\Desktop\Work\MedTator\sample\VAERS_20_NOTES\ann_xml'
TAG_NAMES = ['Vaccine','Fever','Pain','Headache','Myalgia','Fatigue',
    'Nasal_obstruction','Diarrhea','Nausea','Vomiting',
    'Sore_throat','Dyspnea','Cough','Chill','Delirium','Hypersomnia','Other']
TAG_DESCRIPTIONS = {
    "Vaccine":           "COVID-19 vaccine name or identifier (e.g., BNT162b2, Pfizer-BioNTech, Moderna, mRNA-1273, Janssen, J&J, AstraZeneca, vaccine dose)",
    "Fever":             "fever, high temperature, pyrexia, febrile, temperature elevation",
    "Pain":              "pain, painful, ache, sore, soreness, discomfort, hurts, tenderness",
    "Headache":          "headache, head pain, migraine, cephalalgia",
    "Myalgia":           "muscle pain, myalgia, muscle soreness, muscle ache, body aches, swollen, swelling, inflammation, stiffness",
    "Fatigue":           "fatigue, tired, tiredness, exhaustion, weakness, lethargy, malaise, low energy",
    "Nasal_obstruction": "nasal obstruction, stuffy nose, nasal congestion, blocked nose, runny nose, rhinorrhea",
    "Diarrhea":          "diarrhea, loose stool, loose bowel movements, watery stool",
    "Nausea":            "nausea, nauseated, stomach upset, queasy, feel sick",
    "Vomiting":          "vomiting, vomited, threw up, emesis, retching",
    "Sore_throat":       "sore throat, throat pain, pharyngitis, throat irritation, scratchy throat",
    "Dyspnea":           "dyspnea, shortness of breath, difficulty breathing, breathlessness, SOB, can't breathe",
    "Cough":             "cough, coughing, dry cough, productive cough, hacking cough",
    "Chill":             "chills, rigors, shivering, cold sensation, feeling cold",
    "Delirium":          "delirium, confusion, disorientation, altered mental status, cognitive impairment, hallucination",
    "Hypersomnia":       "hypersomnia, excessive sleepiness, drowsiness, somnolence, oversleeping, hard to stay awake",
    "Other":             "any other adverse event or medical concept not covered by the above tags",
}

xml_path = sorted(glob.glob(os.path.join(XML_DIR, '*.xml')))[1]  # 080831
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
tag_desc_lines = '\n'.join(f'  - {t}: {TAG_DESCRIPTIONS[t]}' for t in TAG_NAMES)
prompt = f"""You are a clinical text annotation assistant.
Identify medical concepts in the following text and classify them using ONLY these exact tag names: {tag_list}

Tag definitions:
{tag_desc_lines}

Return JSON only, no explanation. Format:
{{"annotations": [{{"keyword": "core clinical term", "tag": "TagName"}}]}}

Rules:
- ONLY use these exact tag names: {tag_list}
- keyword must be the shortest core clinical term (1-3 words), NOT a full sentence or clause
- keyword must appear verbatim in the text (exact spelling, case-insensitive)
- Do NOT include IDs, offsets, or extra fields

Text:
{text[:2000]}"""

resp = requests.post(f'{OLLAMA_URL}/api/chat',
    json={'model': 'qwen3:8b', 'messages': [{'role': 'user', 'content': prompt}],
          'stream': False, 'format': 'json', 'options': {'temperature': 0}}, timeout=120)
content = resp.json()['message']['content']
content = re.sub(r'```json\s*|\s*```', '', content).strip()
if not content.startswith('{'):
    m = re.search(r'\{[\s\S]*\}', content)
    content = m.group(0) if m else '{}'
llm_anns = json.loads(content).get('annotations') or []

def get_locs(keyword, text):
    pattern = re.escape(keyword).replace(r'\ ', r'\s+')
    return [(m.start(), m.end()) for m in re.finditer(pattern, text, re.IGNORECASE)]

def spans_overlap(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1

predicted_raw = []
for ann in llm_anns:
    if ann.get('tag') not in TAG_NAMES: continue
    for s, e in get_locs(ann['keyword'], text):
        predicted_raw.append({'tag': ann['tag'], 'start': s, 'end': e})

predicted_raw.sort(key=lambda x: x['start'])
predicted = []
for pred in predicted_raw:
    if any(pred['tag'] == k['tag'] and spans_overlap(pred['start'], pred['end'], k['start'], k['end'])
           for k in predicted):
        continue
    predicted.append(pred)

matched_gold = set()
tp_preds = []
fp_preds = []
for pred in predicted:
    matched = False
    for i, g in enumerate(gold_positive):
        if i in matched_gold: continue
        if pred['tag'] == g['tag'] and spans_overlap(pred['start'], pred['end'], g['start'], g['end']):
            tp_preds.append((pred, g))
            matched_gold.add(i)
            matched = True
            break
    if not matched:
        fp_preds.append(pred)

print(f'TP ({len(tp_preds)}):')
for pred, g in tp_preds:
    print(f'  [{pred["tag"]}] pred={repr(text[pred["start"]:pred["end"]][:50])}  gold={repr(text[g["start"]:g["end"]])}')

print(f'\nFP ({len(fp_preds)}):')
for p in fp_preds:
    ctx = text[max(0,p["start"]-30):p["end"]+30].replace('\n',' ')
    print(f'  [{p["tag"]}] {repr(text[p["start"]:p["end"]])}  ...{repr(ctx)}...')

missed = [g for i,g in enumerate(gold_positive) if i not in matched_gold]
print(f'\nFN ({len(missed)}):')
for g in missed:
    print(f'  [{g["tag"]}] {repr(text[g["start"]:g["end"]])}')
