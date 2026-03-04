/**
 * BioC format annotation file parser
 * Migrated from templates/js/bioc_parser.js
 */
import type { Dtd, Ann } from '../types'
import { spans2locs } from './ann-parser'

const NON_CONSUMING_SPANS = '-1~-1'

// ── Annotations → BioC XML ──

export function anns2xml(anns: Ann[], dtd: Dtd): XMLDocument {
  const xmlDoc = document.implementation.createDocument(null, 'collection')
  const root = xmlDoc.getElementsByTagName('collection')[0]

  // source
  root.appendChild(xmlDoc.createElement('source'))

  // date
  const elemDate = xmlDoc.createElement('date')
  elemDate.textContent = '' + new Date()
  root.appendChild(elemDate)

  // key
  root.appendChild(xmlDoc.createElement('key'))

  // documents
  for (const ann of anns) {
    const elemDoc = xmlDoc.createElement('document')

    const elemId = xmlDoc.createElement('id')
    elemId.textContent = ann._filename ?? ''
    elemDoc.appendChild(elemId)

    const elemPassage = xmlDoc.createElement('passage')

    const elemPOffset = xmlDoc.createElement('offset')
    elemPOffset.textContent = '0'
    elemPassage.appendChild(elemPOffset)

    const elemPText = xmlDoc.createElement('text')
    elemPText.appendChild(xmlDoc.createCDATASection(ann.text))
    elemPassage.appendChild(elemPText)

    // Process tags
    for (const tag of ann.tags) {
      const tagDef = dtd.tag_dict[tag.tag]
      if (!tagDef) continue

      if (tagDef.type === 'etag') {
        const locs = spans2locs(tag.spans ?? NON_CONSUMING_SPANS)

        for (let k = 0; k < locs.length; k++) {
          const loc = locs[k]
          const attLen = loc[1] - loc[0]
          const attOfs = loc[0]

          const elemAnn = xmlDoc.createElement('annotation')
          elemAnn.setAttribute(
            'id',
            locs.length === 1 ? tag.id : `${tag.id}_${k}`
          )

          const elemLocation = xmlDoc.createElement('location')
          elemLocation.setAttribute('length', '' + attLen)
          elemLocation.setAttribute('offset', '' + attOfs)
          elemAnn.appendChild(elemLocation)

          const elemAText = xmlDoc.createElement('text')
          elemAText.appendChild(
            xmlDoc.createCDATASection(ann.text.substring(loc[0], loc[1]))
          )
          elemAnn.appendChild(elemAText)

          // Other attributes as infon
          for (const key in tag) {
            if (!Object.hasOwn(tag, key)) continue
            if (['id', 'spans', 'text', 'tag'].includes(key)) continue

            const elemInfon = xmlDoc.createElement('infon')
            elemInfon.setAttribute('key', key)
            elemInfon.appendChild(xmlDoc.createTextNode(tag[key]))
            elemAnn.appendChild(elemInfon)
          }

          elemPassage.appendChild(elemAnn)
        }
      } else if (tagDef.type === 'rtag') {
        const elemRel = xmlDoc.createElement('relation')
        elemRel.setAttribute('id', tag.id)

        for (const key in tag) {
          if (!Object.hasOwn(tag, key)) continue
          if (['id', 'spans', 'text', 'tag'].includes(key)) continue

          const attDef = tagDef.attr_dict[key]

          if (attDef && attDef.vtype === 'idref') {
            const elemNode = xmlDoc.createElement('node')
            elemNode.setAttribute('refid', tag[key])
            elemNode.setAttribute('role', attDef.name)
            elemRel.appendChild(elemNode)
          } else {
            const elemInfon = xmlDoc.createElement('infon')
            elemInfon.setAttribute('key', key)
            elemInfon.appendChild(xmlDoc.createTextNode(tag[key]))
            elemRel.appendChild(elemInfon)
          }
        }

        elemPassage.appendChild(elemRel)
      }
    }

    elemDoc.appendChild(elemPassage)
    root.appendChild(elemDoc)
  }

  return xmlDoc
}

// ── BioC XML → String ──

export function xml2str(xmlDoc: XMLDocument): string {
  const serializer = new XMLSerializer()
  let xmlStr = serializer.serializeToString(xmlDoc)

  if (!xmlStr.startsWith('<?xml')) {
    xmlStr = '<?xml version="1.0" encoding="UTF-8" ?>\n<!DOCTYPE collection SYSTEM "BioC.dtd">\n' + xmlStr
  }

  return xmlStr
}

// ── Download BioC dataset ──

export function downloadDatasetBioc(anns: Ann[], dtd: Dtd, fn: string): string {
  const xmlDoc = anns2xml(anns, dtd)
  const xmlStr = xml2str(xmlDoc)

  const blob = new Blob([xmlStr], { type: 'text/xml;charset=utf-8' })
  // Use native download instead of FileSaver
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fn
  a.click()
  URL.revokeObjectURL(url)

  return xmlStr
}
