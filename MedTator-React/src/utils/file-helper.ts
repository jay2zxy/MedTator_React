/**
 * File operations helper for browser environment
 *
 * Uses HTML5 File API (input + drag&drop) instead of File System Access API
 * Will be replaced with Electron Node.js fs in M7
 */

/**
 * Read a File object as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Read multiple files as text
 */
export async function readFilesAsText(files: File[]): Promise<Array<{ name: string; text: string }>> {
  const results: Array<{ name: string; text: string }> = []

  for (const file of files) {
    try {
      const text = await readFileAsText(file)
      results.push({ name: file.name, text })
    } catch (error) {
      console.error(`Failed to read file ${file.name}:`, error)
    }
  }

  return results
}

/**
 * Filter files by extensions
 */
export function filterFilesByExtension(files: FileList | File[], extensions: string[]): File[] {
  const fileArray = Array.from(files)
  const extSet = new Set(extensions.map(ext => ext.toLowerCase()))

  return fileArray.filter(file => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return extSet.has(ext)
  })
}

/**
 * Check if file is a schema file (.dtd, .json, .yaml, .yml)
 */
export function isSchemaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['dtd', 'json', 'yaml', 'yml'].includes(ext)
}

/**
 * Check if file is an annotation file (.xml, .txt)
 */
export function isAnnotationFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['xml', 'txt'].includes(ext)
}

/**
 * Download text as file
 */
export function downloadTextAsFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
