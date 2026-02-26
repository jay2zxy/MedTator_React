from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

doc = Document()

# ── Page margins (1 inch all around, standard AMIA) ──
for section in doc.sections:
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

style = doc.styles['Normal']
font = style.font
font.name = 'Times New Roman'
font.size = Pt(10)
style.paragraph_format.space_after = Pt(2)
style.paragraph_format.space_before = Pt(0)
style.paragraph_format.line_spacing = 1.0

# ── Title ──
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('Modernizing MedTator: A Privacy-Preserving Clinical Text Annotation Platform\nwith Local Large Language Model Integration')
run.bold = True
run.font.size = Pt(12)
run.font.name = 'Times New Roman'

# ── Authors ──
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run('[Author Names]')
run.font.size = Pt(10)
run.font.name = 'Times New Roman'
p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
run2 = p2.add_run('[Department], [University]')
run2.font.size = Pt(9)
run2.font.name = 'Times New Roman'
run2.italic = True

# ── Helper: add section with bold heading + body ──
def add_section(heading, body_parts):
    """body_parts: list of (text, bold, italic) tuples"""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    run = p.add_run(heading)
    run.bold = True
    run.font.size = Pt(10)
    run.font.name = 'Times New Roman'

    p2 = doc.add_paragraph()
    p2.paragraph_format.space_before = Pt(0)
    for text, bold, italic in body_parts:
        run = p2.add_run(text)
        run.bold = bold
        run.italic = italic
        run.font.size = Pt(10)
        run.font.name = 'Times New Roman'
    return p2

# ── Background ──
add_section('Background', [
    ('Clinical text annotation is foundational to clinical NLP research. MedTator is an open-source annotation tool supporting customizable schemas, multi-format export, and inter-annotator agreement evaluation. However, its original monolithic JavaScript frontend (~18,800 lines without type safety or testing) increasingly limited maintainability and extensibility. Meanwhile, demand for LLM-assisted pre-annotation conflicts with data privacy requirements when processing clinical text containing protected health information (PHI). We present MedTator 2.0, addressing both challenges through a modular architecture and a novel local LLM integration strategy.', False, False),
])

# ── Methods ──
add_section('Methods', [
    ('The platform was rebuilt using React, TypeScript, and CodeMirror 6, with 45 unit tests covering parsers, annotation logic, and negation detection. For LLM-assisted annotation, we implemented a three-stage local inference pipeline (Figure 1). ', False, False),
    ('Stage 1 (Semantic Recognition): ', True, False),
    ('An on-device LLM via the Ollama framework processes clinical text and returns keyword\u2013tag pairs, restricting the model to classification rather than positional output. ', False, False),
    ('Stage 2 (Span Localization): ', True, False),
    ('Precise character offsets are resolved deterministically via regex matching with whitespace normalization, avoiding the well-known limitation of inaccurate LLM-generated span positions. ', False, False),
    ('Stage 3 (Negation Filtering): ', True, False),
    ('A bidirectional context-window heuristic\u2014forward 60 characters for pre-negation cues (', False, False),
    ('denies, no, negative for', False, True),
    (') and backward 30 characters for post-negation cues (', False, False),
    ('absent, not found', False, True),
    (')\u2014suppresses annotations in negated contexts, with sentence boundaries serving as scope breakers.', False, False),
])

# ── Figure 1: Pipeline diagram as a table ──
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(8)

table = doc.add_table(rows=3, cols=7, style='Table Grid')
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = True

# Row 0: boxes and arrows
boxes = ['Clinical\nText +\nSchema', '\u2192', 'Local LLM\n(Ollama)\non-device', '\u2192', 'Regex Span\nLocalization\n(deterministic)', '\u2192', 'Negation\nFilter\n(60/30-char)']
labels = ['', '', 'semantic only\n{keyword, tag}', '', '\\b...\\b \u2192 [s,e]\nexact offset', '', 'bidirectional\ncontext window']

for i, text in enumerate(boxes):
    cell = table.cell(0, i)
    cell.text = ''
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(7)
    run.font.name = 'Consolas'
    if i in (1, 3, 5):  # arrow cells
        run.font.size = Pt(12)
        # Remove borders for arrow cells
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        borders = tcPr.find(qn('w:tcBorders'))
        if borders is not None:
            tcPr.remove(borders)

# Row 1: labels
for i, text in enumerate(labels):
    cell = table.cell(1, i)
    cell.text = ''
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(6.5)
    run.font.name = 'Consolas'
    run.font.color.rgb = RGBColor(100, 100, 100)

# Row 2: merge all for output arrow
merged = table.cell(2, 0).merge(table.cell(2, 6))
p = merged.paragraphs[0]
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
run = p.add_run('\u2192  Pre-annotations loaded into Annotation Editor')
run.font.size = Pt(7)
run.font.name = 'Consolas'
run.bold = True

# Remove all borders from arrow columns
for row in table.rows:
    for i in (1, 3, 5):
        cell = row.cells[i]
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        borders = qn('w:tcBorders')
        existing = tcPr.find(borders)
        if existing is not None:
            tcPr.remove(existing)
        new_borders = '<w:tcBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tcBorders>'
        from lxml import etree
        tcPr.append(etree.fromstring(new_borders))

# Caption
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(2)
run = p.add_run('Figure 1. ')
run.bold = True
run.font.size = Pt(9)
run.font.name = 'Times New Roman'
run = p.add_run('Local LLM annotation pipeline. The model provides only keyword\u2013tag pairs; span positions and negation filtering are resolved deterministically on-device.')
run.font.size = Pt(9)
run.font.name = 'Times New Roman'

# ── Results ──
add_section('Results', [
    ('MedTator 2.0 reproduces all original features\u2014entity/relation annotation, schema editing, IAA with Cohen\u2019s Kappa, multi-format export, and MedTagger visualization\u2014verified through systematic side-by-side comparison. The keyword-only localization strategy achieved exact span alignment in all matched instances across test documents, and the negation filter correctly suppressed annotations in common negated constructions (e.g., ', False, False),
    ('\u201cdenies chest pain\u201d', False, True),
    (') while preserving true positives in subsequent affirmative clauses (e.g., ', False, False),
    ('\u201cdenies chest pain. Reports nausea\u201d', False, True),
    (' \u2192 nausea retained). The pipeline was tested with Mistral and DeepSeek models.', False, False),
])

# ── Conclusion ──
add_section('Conclusion', [
    ('By decoupling keyword extraction from span resolution and applying rule-based negation filtering, MedTator 2.0 provides LLM-assisted pre-annotation while keeping all clinical data on-device. The platform is being prepared for Electron-based desktop packaging to enable fully offline clinical annotation workflows. Source code is publicly available at [repository URL].', False, False),
])

# ── Save ──
output_path = r'C:\Users\del\Desktop\Work\MedTator\MedTator_AMIA2026_Abstract.docx'
doc.save(output_path)
print(f'Saved to {output_path}')
