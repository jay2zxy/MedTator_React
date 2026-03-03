"""
Quick 2x2 ablation on first 3 files — controlled variable test
A: desc=OFF neg=OFF
B: desc=ON  neg=OFF
C: desc=OFF neg=ON
D: desc=ON  neg=ON
neg=ON/OFF share same LLM cache (clean ablation)
"""
import os, re, json, glob, requests
from xml.etree import ElementTree as ET

OLLAMA_URL = "http://localhost:11434"
MODEL      = "qwen3:8b"
XML_DIR    = r"C:\Users\del\Desktop\Work\MedTator\sample\VAERS_20_NOTES\ann_xml"
N_FILES    = 3   # change to 20 for full run

TAG_NAMES = [
    "Vaccine","Fever","Pain","Headache","Myalgia","Fatigue",
    "Nasal_obstruction","Diarrhea","Nausea","Vomiting",
    "Sore_throat","Dyspnea","Cough","Chill","Delirium","Hypersomnia","Other"
]
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

NEGATION_PRE  = re.compile(r'\b(denies?|no |not |doesn\'t have|did not have|without|negative for|no evidence of|absent)\b', re.IGNORECASE)
NEGATION_POST = re.compile(r'\b(absent|not found|not present|none|: none|negative)\b', re.IGNORECASE)
SCOPE_BREAKERS = re.compile(r'[.!?]|\b(but|however|although|except|yet|while)\b', re.IGNORECASE)


def parse_gold(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    text_el = root.find('TEXT')
    text = text_el.text if text_el is not None and text_el.text else ''
    tags = []
    for el in root.find('TAGS') or []:
        m = re.match(r'(\d+)~(\d+)', el.get('spans', ''))
        if m:
            tags.append({'tag': el.tag, 'start': int(m.group(1)), 'end': int(m.group(2)),
                         'certainty': el.get('certainty', 'positive').lower()})
    return text, tags


def call_llm(text, use_descriptions):
    tag_list = ', '.join(TAG_NAMES)
    if use_descriptions:
        desc_block = 'Tag definitions:\n' + '\n'.join(
            f'  - {t}: {TAG_DESCRIPTIONS[t]}' for t in TAG_NAMES) + '\n\n'
    else:
        desc_block = ''
    prompt = (
        "You are a clinical text annotation assistant.\n"
        f"Identify medical concepts in the following text and classify them using ONLY these exact tag names: {tag_list}\n\n"
        f"{desc_block}"
        'Return JSON only, no explanation. Format:\n'
        '{"annotations": [{"keyword": "core clinical term", "tag": "TagName"}]}\n\n'
        "Rules:\n"
        f"- ONLY use these exact tag names: {tag_list}\n"
        "- keyword must be the shortest core clinical term (1-3 words), NOT a full sentence or clause\n"
        "- keyword must appear verbatim in the text (exact spelling, case-insensitive)\n"
        "- Do NOT include IDs, offsets, or extra fields\n\n"
        f"Text:\n{text[:2000]}"
    )
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": MODEL, "messages": [{"role": "user", "content": prompt}],
                  "stream": False, "format": "json", "options": {"temperature": 0}},
            timeout=300)
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        content = re.sub(r'```json\s*|\s*```', '', content).strip()
        if not content.startswith('{'):
            m = re.search(r'\{[\s\S]*\}', content)
            content = m.group(0) if m else '{}'
        data = json.loads(content)
        anns = data.get('annotations') or data.get('results') or []
        return [a for a in anns if isinstance(a.get('keyword'), str) and isinstance(a.get('tag'), str)]
    except Exception as e:
        print(f"  [LLM error] {e}")
        return []


def call_llm_with_retry(text, use_descriptions, retries=2):
    for attempt in range(retries):
        result = call_llm(text, use_descriptions)
        if result:
            return result
        if attempt < retries - 1:
            print(f"  [retry {attempt+1}] empty result, retrying...")
    return []


def get_locs(keyword, text):
    pattern = re.escape(keyword).replace(r'\ ', r'\s+')
    return [(m.start(), m.end()) for m in re.finditer(pattern, text, re.IGNORECASE)]


def is_negated(start, end, text):
    pre = text[max(0, start - 60):start]
    bks = list(SCOPE_BREAKERS.finditer(pre))
    if bks:
        pre = pre[bks[-1].end():]
    if NEGATION_PRE.search(pre):
        return True
    post = text[end:end + 30]
    bks = list(SCOPE_BREAKERS.finditer(post))
    if bks:
        post = post[:bks[0].start()]
    return bool(NEGATION_POST.search(post))


def spans_overlap(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1


def localize(llm_anns, text):
    raw = []
    for ann in llm_anns:
        if ann['tag'] not in TAG_NAMES:
            continue
        for s, e in get_locs(ann['keyword'], text):
            raw.append({'tag': ann['tag'], 'start': s, 'end': e})
    raw.sort(key=lambda x: x['start'])
    deduped = []
    for pred in raw:
        if any(pred['tag'] == k['tag'] and spans_overlap(pred['start'], pred['end'], k['start'], k['end'])
               for k in deduped):
            continue
        deduped.append(pred)
    return deduped


def match_prf(predicted, gold_positive):
    matched = set()
    tp = 0
    for pred in predicted:
        for i, g in enumerate(gold_positive):
            if i in matched:
                continue
            if pred['tag'] == g['tag'] and spans_overlap(pred['start'], pred['end'], g['start'], g['end']):
                tp += 1
                matched.add(i)
                break
    fp = len(predicted) - tp
    fn = len(gold_positive) - tp
    p  = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f  = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
    return tp, fp, fn, p, r, f


# ── Run ──────────────────────────────────────────────────────────────────
xml_files = sorted(glob.glob(os.path.join(XML_DIR, '*.xml')))[:N_FILES]
print(f"Files ({len(xml_files)}): {[os.path.basename(f) for f in xml_files]}\n")

CONDITIONS = [
    ('A', False, False),
    ('B', True,  False),
    ('C', False, True),
    ('D', True,  True),
]

llm_cache = {}
results = {}

for cond, use_desc, use_neg in CONDITIONS:
    label = f"{cond}: desc={'ON' if use_desc else 'OFF'} neg={'ON' if use_neg else 'OFF'}"
    total_tp = total_fp = total_fn = neg_sup = 0
    for xml_path in xml_files:
        text, gold_tags = parse_gold(xml_path)
        gold_positive = [t for t in gold_tags if t['certainty'] != 'negated']
        fname = os.path.basename(xml_path)

        key = (xml_path, use_desc)
        if key not in llm_cache:
            print(f"  [LLM] {fname}  desc={'ON' if use_desc else 'OFF'}", flush=True)
            llm_cache[key] = call_llm_with_retry(text, use_desc)
        preds = localize(llm_cache[key], text)

        if use_neg:
            filtered = [p for p in preds if not is_negated(p['start'], p['end'], text)]
            neg_sup += len(preds) - len(filtered)
            preds = filtered

        tp, fp, fn, p, r, f = match_prf(preds, gold_positive)
        print(f"    {fname}: TP={tp} FP={fp} FN={fn}  P={p:.2f} R={r:.2f} F1={f:.2f}")
        total_tp += tp; total_fp += fp; total_fn += fn

    _, _, _, P, R, F = match_prf(
        [{'tag':'x','start':0,'end':1}] * total_tp + [{'tag':'y','start':0,'end':1}] * total_fp,
        [{'tag':'x','start':0,'end':1}] * (total_tp + total_fn)
    )
    # recalc correctly
    P2 = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    R2 = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    F2 = 2*P2*R2/(P2+R2) if (P2+R2) > 0 else 0.0
    results[cond] = {'label': label, 'TP': total_tp, 'FP': total_fp, 'FN': total_fn,
                     'P': P2, 'R': R2, 'F1': F2, 'neg_sup': neg_sup}
    print(f"  >> {label}  TOTAL: TP={total_tp} FP={total_fp} FN={total_fn}  P={P2:.3f} R={R2:.3f} F1={F2:.3f}  neg_suppressed={neg_sup}\n")

# ── Summary ───────────────────────────────────────────────────────────────
print("=" * 72)
print(f"{'Cond':<28} {'TP':>4} {'FP':>4} {'FN':>4} {'P':>6} {'R':>6} {'F1':>6}  neg_sup")
print("-" * 72)
for cond, r in results.items():
    print(f"{r['label']:<28} {r['TP']:>4} {r['FP']:>4} {r['FN']:>4} {r['P']:>6.3f} {r['R']:>6.3f} {r['F1']:>6.3f}  {r['neg_sup']}")
print("=" * 72)

print("\n--- Controlled comparisons ---")
A, B, C, D = results['A'], results['B'], results['C'], results['D']
print(f"desc effect  (neg=OFF, B vs A):  R {A['R']:.3f}→{B['R']:.3f}  P {A['P']:.3f}→{B['P']:.3f}  F1 {A['F1']:.3f}→{B['F1']:.3f}")
print(f"neg  effect  (desc=ON,  D vs B):  R {B['R']:.3f}→{D['R']:.3f}  P {B['P']:.3f}→{D['P']:.3f}  F1 {B['F1']:.3f}→{D['F1']:.3f}")
print(f"neg  effect  (desc=OFF, C vs A):  R {A['R']:.3f}→{C['R']:.3f}  P {A['P']:.3f}→{C['P']:.3f}  F1 {A['F1']:.3f}→{C['F1']:.3f}")
