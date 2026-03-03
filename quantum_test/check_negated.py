import os, glob
from xml.etree import ElementTree as ET

XML_DIR = r"C:\Users\del\Desktop\Work\MedTator\sample\VAERS_20_NOTES\ann_xml"
total_pos = total_neg = 0
files_with_neg = 0
for xml_path in sorted(glob.glob(os.path.join(XML_DIR, "*.xml"))):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    tags = list(root.find("TAGS") or [])
    pos = sum(1 for el in tags if el.get("certainty", "positive").lower() != "negated")
    neg = sum(1 for el in tags if el.get("certainty", "positive").lower() == "negated")
    total_pos += pos
    total_neg += neg
    if neg > 0:
        files_with_neg += 1
        fname = os.path.basename(xml_path)
        neg_items = [(el.tag, el.get("spans", "")) for el in tags
                     if el.get("certainty", "positive").lower() == "negated"]
        print(f"{fname}: neg={neg}  {neg_items}")

print(f"\nTotal: positive={total_pos}, negated={total_neg}, files_with_neg={files_with_neg}/20")
