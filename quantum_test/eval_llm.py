"""
LLM Auto-Annotation Evaluation Script
Dataset: VAERS_20_NOTES (20 COVID-19 adverse event reports)
Metrics: Precision / Recall / F1 (span overlap, same tag type)
Conditions:
  - Model: Mistral vs qwen3:8b
  - Negation filter: ON vs OFF
"""

import os, re, json, glob, requests
from xml.etree import ElementTree as ET

# ── Config ──────────────────────────────────────────────────────────────
OLLAMA_URL   = "http://localhost:11434"
MODELS       = ["qwen3:8b"]
XML_DIR      = r"C:\Users\del\Desktop\Work\MedTator\sample\VAERS_20_NOTES\ann_xml"
TAG_NAMES    = [
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
NEGATION_PRE = re.compile(
    r'\b(denies?|no |not |doesn\'t have|did not have|without|negative for|no evidence of|absent)\b',
    re.IGNORECASE
)
NEGATION_POST = re.compile(
    r'\b(absent|not found|not present|none|: none|negative)\b',
    re.IGNORECASE
)
SCOPE_BREAKERS = re.compile(r'[.!?]|\b(but|however|although|except|yet|while)\b', re.IGNORECASE)

# ── Parse gold standard XML ──────────────────────────────────────────────
def parse_gold(xml_path):
    """Returns (text, gold_tags) where gold_tags = [{tag, start, end, certainty}]"""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    text_el = root.find('TEXT')
    text = text_el.text if text_el is not None and text_el.text else ''
    tags = []
    for el in root.find('TAGS') or []:
        spans_str = el.get('spans', '')
        certainty = el.get('certainty', 'positive').lower()
        m = re.match(r'(\d+)~(\d+)', spans_str)
        if m:
            tags.append({
                'tag': el.tag,
                'start': int(m.group(1)),
                'end': int(m.group(2)),
                'certainty': certainty,
            })
    return text, tags

# ── LLM call ────────────────────────────────────────────────────────────
def call_llm(model, text, tag_names):
    tag_list = ', '.join(tag_names)
    tag_desc_lines = '\n'.join(f'  - {t}: {TAG_DESCRIPTIONS[t]}' for t in tag_names)
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

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": model, "messages": [{"role": "user", "content": prompt}],
                  "stream": False, "format": "json", "options": {"temperature": 0}},
            timeout=180
        )
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        # strip markdown fences
        content = re.sub(r'```json\s*|\s*```', '', content).strip()
        # fallback: extract first {...}
        if not content.startswith('{'):
            m = re.search(r'\{[\s\S]*\}', content)
            content = m.group(0) if m else '{}'
        data = json.loads(content)
        anns = data.get('annotations') or data.get('results') or []
        return [a for a in anns if isinstance(a.get('keyword'), str) and isinstance(a.get('tag'), str)]
    except Exception as e:
        print(f"  [LLM error] {e}")
        return []

# ── Regex span localization ──────────────────────────────────────────────
def get_locs(keyword, text):
    """Return all [start, end] positions of keyword in text."""
    escaped = re.escape(keyword)
    pattern = escaped.replace(r'\ ', r'\s+')
    results = []
    for m in re.finditer(pattern, text, re.IGNORECASE):
        results.append((m.start(), m.end()))
    return results

# ── Negation filter ──────────────────────────────────────────────────────
def is_negated(start, end, text):
    """Bidirectional context window negation check."""
    # forward: 60 chars before start
    pre_start = max(0, start - 60)
    pre_text  = text[pre_start:start]
    # truncate at scope breaker from the right
    breakers = list(SCOPE_BREAKERS.finditer(pre_text))
    if breakers:
        pre_text = pre_text[breakers[-1].end():]
    if NEGATION_PRE.search(pre_text):
        return True
    # backward: 30 chars after end
    post_text = text[end:end + 30]
    breakers = list(SCOPE_BREAKERS.finditer(post_text))
    if breakers:
        post_text = post_text[:breakers[0].start()]
    if NEGATION_POST.search(post_text):
        return True
    return False

# ── Span overlap matching ────────────────────────────────────────────────
def spans_overlap(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end

def match_predictions(predicted, gold_positive):
    """Return (tp, fp, fn) counts using greedy overlap matching."""
    matched_gold = set()
    tp = 0
    for pred in predicted:
        for i, g in enumerate(gold_positive):
            if i in matched_gold:
                continue
            if pred['tag'] == g['tag'] and spans_overlap(pred['start'], pred['end'], g['start'], g['end']):
                tp += 1
                matched_gold.add(i)
                break
    fp = len(predicted) - tp
    fn = len(gold_positive) - tp
    return tp, fp, fn

def prf(tp, fp, fn):
    p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
    return p, r, f

# ── Main evaluation ──────────────────────────────────────────────────────
def evaluate(model, use_negation_filter):
    xml_files = sorted(glob.glob(os.path.join(XML_DIR, '*.xml')))
    total_tp = total_fp = total_fn = 0
    negation_suppressed = 0  # annotations removed by filter
    negation_correct    = 0  # removed ones that matched a gold NEGATED tag

    for xml_path in xml_files:
        text, gold_tags = parse_gold(xml_path)
        gold_positive = [t for t in gold_tags if t['certainty'] != 'negated']
        gold_negated  = [t for t in gold_tags if t['certainty'] == 'negated']

        llm_anns = call_llm(model, text, TAG_NAMES)

        # localize spans
        predicted_raw = []
        for ann in llm_anns:
            if ann['tag'] not in TAG_NAMES:
                continue
            for start, end in get_locs(ann['keyword'], text):
                predicted_raw.append({'tag': ann['tag'], 'start': start, 'end': end})

        # dedup: for same tag, keep first match, drop overlapping later spans
        predicted_raw.sort(key=lambda x: x['start'])
        deduped = []
        for pred in predicted_raw:
            if any(pred['tag'] == k['tag'] and spans_overlap(pred['start'], pred['end'], k['start'], k['end'])
                   for k in deduped):
                continue
            deduped.append(pred)
        predicted_raw = deduped

        # apply negation filter
        if use_negation_filter:
            predicted = []
            for pred in predicted_raw:
                if is_negated(pred['start'], pred['end'], text):
                    negation_suppressed += 1
                    # check if it matched a gold negated entity
                    for gn in gold_negated:
                        if pred['tag'] == gn['tag'] and spans_overlap(pred['start'], pred['end'], gn['start'], gn['end']):
                            negation_correct += 1
                            break
                else:
                    predicted.append(pred)
        else:
            predicted = predicted_raw

        tp, fp, fn = match_predictions(predicted, gold_positive)
        total_tp += tp
        total_fp += fp
        total_fn += fn

        fname = os.path.basename(xml_path)
        p, r, f = prf(tp, fp, fn)
        print(f"  {fname}: P={p:.2f} R={r:.2f} F1={f:.2f}  (tp={tp} fp={fp} fn={fn})")

    return total_tp, total_fp, total_fn, negation_suppressed, negation_correct

# ── Run ──────────────────────────────────────────────────────────────────
results = {}
for model in MODELS:
    for use_neg in [False, True]:
        label = f"{model} | negation={'ON' if use_neg else 'OFF'}"
        print(f"\n{'='*60}")
        print(f"  {label}")
        print(f"{'='*60}")
        tp, fp, fn, suppressed, correct = evaluate(model, use_neg)
        p, r, f = prf(tp, fp, fn)
        results[label] = {'P': p, 'R': r, 'F1': f, 'TP': tp, 'FP': fp, 'FN': fn,
                          'neg_suppressed': suppressed, 'neg_correct': correct}

# ── Summary table ────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print(f"{'Condition':<42} {'P':>6} {'R':>6} {'F1':>6} {'TP':>5} {'FP':>5} {'FN':>5}")
print(f"{'-'*70}")
for label, m in results.items():
    neg_note = f"  (filter suppressed {m['neg_suppressed']}, {m['neg_correct']} correct)" if m['neg_suppressed'] > 0 else ""
    print(f"{label:<42} {m['P']:>6.3f} {m['R']:>6.3f} {m['F1']:>6.3f} {m['TP']:>5} {m['FP']:>5} {m['FN']:>5}{neg_note}")
print(f"{'='*70}")
