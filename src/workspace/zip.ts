import { zipSync, strToU8 } from 'fflate'
import { fileMarkdown } from './reducer.ts'
import type { WorkspaceFile } from './types.ts'

// Bundle workspace files into a ZIP, preserving the directory layout (keyed by each
// file's displayPath, relative to the loaded subfolder). Only files that have been
// opened (and thus have content) are included; `onlyDirty` narrows to edited files.
// Returns null when there is nothing to export.
export async function exportZip(
  files: Map<string, WorkspaceFile>,
  { onlyDirty }: { onlyDirty: boolean },
): Promise<Blob | null> {
  const entries: Record<string, Uint8Array> = {}
  for (const file of files.values()) {
    if (!file.history?.present) continue
    if (onlyDirty && !file.dirty) continue
    entries[file.displayPath] = strToU8(fileMarkdown(file))
  }
  if (Object.keys(entries).length === 0) return null
  const zipped = zipSync(entries, { level: 6 })
  // Copy into a fresh ArrayBuffer so the Blob owns a plain ArrayBuffer (not the
  // typed-array's underlying buffer view), satisfying the BlobPart type.
  return new Blob([zipped.slice()], { type: 'application/zip' })
}
