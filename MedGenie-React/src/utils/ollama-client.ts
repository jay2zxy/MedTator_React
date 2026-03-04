export interface OllamaConfig {
  baseUrl: string
  model: string
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen3:8b',
}

export async function checkOllamaStatus(config: OllamaConfig): Promise<boolean> {
  try {
    const resp = await fetch(`${config.baseUrl}/api/tags`)
    return resp.ok
  } catch {
    return false
  }
}

export interface OllamaModelInfo {
  name: string
  isRemote: boolean
}

export async function listModels(config: OllamaConfig): Promise<OllamaModelInfo[]> {
  const resp = await fetch(`${config.baseUrl}/api/tags`)
  if (!resp.ok) throw new Error(`Ollama API error: ${resp.status}`)
  const data = await resp.json()
  return (data.models || []).map((m: any) => ({
    name: m.name as string,
    isRemote: typeof m.remote_model === 'string' && m.remote_model.length > 0,
  }))
}

export interface LlmAnnotation {
  keyword: string
  tag: string
}

/**
 * Robustly extract a JSON object from arbitrary LLM output.
 * Handles: <think> blocks, unclosed <think>, markdown fences, surrounding text.
 */
function extractJson(raw: string): any {
  // 1. Strip closed <think>...</think> blocks (Qwen 3, DeepSeek-R1, etc.)
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
  // 2. Strip unclosed <think> (model cut off or never closed)
  const openIdx = text.lastIndexOf('<think>')
  if (openIdx !== -1) text = text.slice(0, openIdx)
  text = text.trim()

  // 3. Extract content from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  // 4. Try direct parse
  try { return JSON.parse(text) } catch { /* continue */ }

  // 5. Bracket-matching: find all balanced {...} candidates, try longest first
  const candidates: string[] = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      let depth = 0
      for (let j = i; j < text.length; j++) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        if (depth === 0) {
          candidates.push(text.slice(i, j + 1))
          break
        }
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length)
  for (const c of candidates) {
    try { return JSON.parse(c) } catch { /* next */ }
  }

  return null
}

export async function requestAutoAnnotation(
  config: OllamaConfig,
  text: string,
  etags: Array<{ name: string; description?: string }>,
  signal?: AbortSignal
): Promise<LlmAnnotation[]> {
  const tagList = etags.map(t => t.name).join(', ')
  const tagLines = etags.map(t =>
    t.description ? `  - ${t.name}: ${t.description}` : `  - ${t.name}`
  ).join('\n')

  const systemPrompt = `You are a text annotation assistant. Given a text and a list of entity tag types, identify all relevant keywords/phrases in the text and classify each one with the appropriate tag type. Return ONLY valid JSON.`

  const userPrompt = `Text:
"""
${text}
"""

Entity tags:
${tagLines}

Return a JSON object with this exact format:
{"annotations": [{"keyword": "exact phrase from text", "tag": "TAG_NAME"}, ...]}

Rules:
- keyword must be the shortest core clinical term (1-3 words), NOT a full sentence or clause
- keyword must appear verbatim in the text (exact spelling, case-insensitive)
- ONLY use these exact tag names: ${tagList}
- Do not invent or substitute other tag names
- Find ALL relevant mentions, including duplicates at different positions
- Do NOT explain. Output the JSON object ONLY.`

  console.log('[LLM prompt] tags:', etags.map(t => t.description ? `${t.name}: ${t.description}` : t.name))
  console.log('[LLM prompt] user prompt:\n', userPrompt)

  const resp = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Ollama API error ${resp.status}: ${errText}`)
  }

  const data = await resp.json()
  const rawContent = data.message?.content || ''
  console.log('[LLM raw response]', rawContent)

  const parsed = extractJson(rawContent)
  if (!parsed) {
    throw new Error(`Failed to parse LLM response as JSON: ${rawContent.slice(0, 300)}`)
  }

  const annotations: LlmAnnotation[] = parsed.annotations || parsed.results || []
  if (!Array.isArray(annotations)) {
    throw new Error(`LLM response missing annotations array: ${rawContent.slice(0, 300)}`)
  }

  return annotations.filter(
    (a) => typeof a.keyword === 'string' && typeof a.tag === 'string' && a.keyword.length > 0
  )
}
