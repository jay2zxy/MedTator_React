export interface OllamaConfig {
  baseUrl: string
  model: string
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'mistral:latest',
}

export async function checkOllamaStatus(config: OllamaConfig): Promise<boolean> {
  try {
    const resp = await fetch(`${config.baseUrl}/api/tags`)
    return resp.ok
  } catch {
    return false
  }
}

export async function listModels(config: OllamaConfig): Promise<string[]> {
  const resp = await fetch(`${config.baseUrl}/api/tags`)
  if (!resp.ok) throw new Error(`Ollama API error: ${resp.status}`)
  const data = await resp.json()
  return (data.models || []).map((m: any) => m.name as string)
}

export interface LlmAnnotation {
  keyword: string
  tag: string
}

export async function requestAutoAnnotation(
  config: OllamaConfig,
  text: string,
  etagNames: string[]
): Promise<LlmAnnotation[]> {
  const tagList = etagNames.join(', ')

  const systemPrompt = `You are a text annotation assistant. Given a text and a list of entity tag types, identify all relevant keywords/phrases in the text and classify each one with the appropriate tag type. Return ONLY valid JSON.`

  const userPrompt = `Text:
"""
${text}
"""

Entity tags: ${tagList}

Return a JSON object with this exact format:
{"annotations": [{"keyword": "exact phrase from text", "tag": "TAG_NAME"}, ...]}

Rules:
- Each keyword must appear EXACTLY as written in the text (case-sensitive match)
- Only use tag names from the provided list
- Find ALL relevant mentions, including duplicates at different positions
- Keep keywords short (1-4 words typically)`

  const resp = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      format: 'json',
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
  const content = data.message?.content || ''

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${content.slice(0, 200)}`)
  }

  const annotations: LlmAnnotation[] = parsed.annotations || parsed.results || []
  if (!Array.isArray(annotations)) {
    throw new Error(`LLM response missing annotations array: ${content.slice(0, 200)}`)
  }

  return annotations.filter(
    (a) => typeof a.keyword === 'string' && typeof a.tag === 'string' && a.keyword.length > 0
  )
}
