// ── Schema / DTD 类型 ──

export interface DtdAttr {
  name: string
  vtype: 'text' | 'list' | 'idref' | 'dfix' | ''
  require: string // '' | 'IMPLIED' | 'REQUIRED'
  values: string[]
  default_value: string
  element: string
  type: 'attr'
}

export interface DtdTag {
  name: string
  description?: string
  type: 'etag' | 'rtag'
  is_non_consuming: boolean
  attrs: DtdAttr[]
  attr_dict: Record<string, DtdAttr>
  id_prefix: string
  shortcut: string | null
  style: { color: string }
}

export interface Dtd {
  name: string
  etags: DtdTag[]
  rtags: DtdTag[]
  id_prefix_dict: Record<string, DtdTag>
  tag_dict: Record<string, DtdTag>
  text: string | null
  meta?: Record<string, any>
}

// ── Annotation 类型 ──

export interface AnnTag {
  tag: string
  id: string
  spans?: string
  text?: string
  [key: string]: any
}

export interface Ann {
  text: string
  dtd_name: string
  tags: AnnTag[]
  meta: Record<string, any[]>
  _fh: any
  _filename: string | null
  _has_saved: boolean
  _sentences: any[]
  _sentences_text: string
}

// ── BRAT 可视化类型 ──

export type BratEntity = [string, string, number[][]]
export type BratRelation = [string, string, [string, string][]]
export type BratAttribute = [string, string, string, string]

export interface BratDocData {
  text: string
  entities: BratEntity[]
  relations: BratRelation[]
  attributes?: BratAttribute[]
}

export interface BratEntityType {
  type: string
  labels: string[]
  bgColor: string
  borderColor: string
}

export interface BratRelationType {
  type: string
  labels: string[]
  color: string
  args: { role: string }[]
}

export interface BratColData {
  entity_types: BratEntityType[]
  relation_types?: BratRelationType[]
  entity_attribute_types?: any[]
}
