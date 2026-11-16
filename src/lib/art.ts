// Card artwork manifest.
// Drop official files into src/assets/cards/ and rebuild — they are picked up automatically:
//   red-01.png … red-13.png, blue-01.png …, green-…, yellow-…, purple-…, card-back.png
// and the logo into src/assets/brand/flip-clash-logo.png
// Any card without a file falls back to the built-in placeholder design.

const files = import.meta.glob('../assets/{cards,brand}/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const byName = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const base = path.split('/').pop()!.replace(/\.[a-z]+$/i, '').toLowerCase()
  byName.set(base, url)
}

export function artFor(name: string): string | undefined {
  return byName.get(name.toLowerCase())
}

export const hasAnyCardArt = byName.size > 0
