export type ApkMetadata = {
  packageName: string
  version: string
  permissions: string[]
}

export async function readApk(file: File): Promise<ApkMetadata> {
  const bytes = await file.arrayBuffer()
  const zip = new DataView(bytes)
  const u16 = (i: number) => zip.getUint16(i, true)
  const u32 = (i: number) => zip.getUint32(i, true)
  let end = bytes.byteLength - 22
  for (; end >= Math.max(0, bytes.byteLength - 65557); end--) {
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.byteLength) break
  }
  if (end < Math.max(0, bytes.byteLength - 65557)) throw new Error('This file is not a readable APK.')
  let entry = u32(end + 16)
  for (let index = 0; index < u16(end + 10); index++) {
    if (u32(entry) !== 0x02014b50) break
    const nameLength = u16(entry + 28)
    const name = new TextDecoder().decode(new Uint8Array(bytes, entry + 46, nameLength))
    if (name === 'AndroidManifest.xml') {
      const size = u32(entry + 24)
      const compressed = u32(entry + 20)
      const local = u32(entry + 42)
      if (size > 2_000_000 || compressed > 2_000_000 || u32(local) !== 0x04034b50) {
        throw new Error('The APK manifest is invalid or too large.')
      }
      const start = local + 30 + u16(local + 26) + u16(local + 28)
      const blob = new Blob([new Uint8Array(bytes, start, compressed)])
      const method = u16(entry + 10)
      if (method === 0) return readManifest(await blob.arrayBuffer())
      if (method !== 8) throw new Error('Unsupported APK compression.')
      const reader = blob.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
      const result = new Uint8Array(size)
      let offset = 0
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          result.set(value, offset)
          offset += value.length
        }
      } finally {
        await reader.cancel()
      }
      if (offset !== size) throw new Error('The APK manifest is incomplete.')
      return readManifest(result.buffer)
    }
    entry += 46 + nameLength + u16(entry + 30) + u16(entry + 32)
  }
  throw new Error('AndroidManifest.xml was not found in this APK.')
}

export function readManifest(bytes: ArrayBuffer): ApkMetadata {
  const data = new DataView(bytes)
  const u16 = (i: number) => data.getUint16(i, true)
  const u32 = (i: number) => data.getUint32(i, true)
  const strings: string[] = []
  const permissions = new Set<string>()
  let packageName = ''
  let version = ''
  if (u16(0) !== 3) throw new Error('Unsupported Android manifest format.')
  for (let pos = u16(2); pos + 8 <= bytes.byteLength;) {
    const kind = u16(pos)
    const header = u16(pos + 2)
    const size = u32(pos + 4)
    if (header < 8 || size < header || pos + size > bytes.byteLength) {
      throw new Error('Invalid Android manifest.')
    }
    if (kind === 1) {
      const count = u32(pos + 8)
      const utf8 = Boolean(u32(pos + 16) & 0x100)
      const decoder = new TextDecoder(utf8 ? 'utf-8' : 'utf-16le')
      const base = pos + u32(pos + 20)
      if (count > (size - header) / 4) throw new Error('Invalid manifest strings.')
      for (let i = 0; i < count; i++) {
        let at = base + u32(pos + header + i * 4)
        let length: number
        if (utf8) {
          at += data.getUint8(at) & 128 ? 2 : 1
          const first = data.getUint8(at++)
          length = first & 128 ? ((first & 127) << 8) | data.getUint8(at++) : first
        } else {
          length = u16(at)
          at += 2
          if (length & 32768) {
            length = (length & 32767) * 65536 + u16(at)
            at += 2
          }
          length *= 2
        }
        if (at + length > pos + size) throw new Error('Invalid manifest string.')
        strings.push(decoder.decode(new Uint8Array(bytes, at, length)))
      }
    }
    if (kind === 0x0102) {
      const ext = pos + header
      const tag = strings[u32(ext + 4)]
      const start = ext + u16(ext + 8)
      const stride = u16(ext + 10)
      const count = u16(ext + 12)
      if (stride < 20 || start + stride * count > pos + size) throw new Error('Invalid manifest attributes.')
      for (let i = 0; i < count; i++) {
        const at = start + i * stride
        const key = strings[u32(at + 4)]
        const value = strings[u32(at + 8)] ??
          (data.getUint8(at + 15) === 3 ? strings[u32(at + 16)] : undefined)
        if (!value) continue
        if (tag === 'manifest' && key === 'package') packageName = value
        if (tag === 'manifest' && key === 'versionName') version = value
        if ((tag === 'uses-permission' || tag === 'uses-permission-sdk-23' || tag === 'uses-permission-sdk-m') && key === 'name') {
          permissions.add(value)
        }
      }
    }
    pos += size
  }
  if (!packageName) throw new Error('The APK has no readable application ID.')
  return { packageName, version, permissions: [...permissions].sort() }
}
