import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

/**
 * Pretendard는 앱이 실제로 쓰는 글자만 남긴 서브셋(약 180KB)이다.
 * 문제나 UI 문구를 고쳐 새 글자가 생기면 그 글자가 폰트에 없어 깨진다.
 *
 * 이 테스트가 그걸 잡는다. 실패하면:
 *     python3 scripts/build-fonts.py
 * 를 다시 돌리고 public/fonts/ 변경분을 커밋하면 된다.
 */

const ROOT = join(import.meta.dirname, '..', '..')
const CHARSET_PATH = join(ROOT, 'public', 'fonts', 'Pretendard-subset.charset.txt')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html'])

/** 테스트 디렉터리는 화면에 렌더되지 않으므로 제외한다(자기참조 방지). */
function collectFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'test') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectFiles(full, found)
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      found.push(full)
    }
  }
  return found
}

function sourceCharacters(): Set<string> {
  const files = [...collectFiles(join(ROOT, 'src')), join(ROOT, 'index.html')]
  const chars = new Set<string>()
  for (const file of files) {
    for (const char of readFileSync(file, 'utf8')) {
      if (char !== '\n' && char !== '\r' && char !== '\t') chars.add(char)
    }
  }
  return chars
}

const isHangul = (char: string) => char >= '가' && char <= '힣'

describe('Pretendard 서브셋 커버리지', () => {
  it('서브셋 문자 목록 파일이 있다', () => {
    expect(() => readFileSync(CHARSET_PATH, 'utf8')).not.toThrow()
  })

  it('소스에 쓰인 한글이 모두 서브셋에 들어 있다', () => {
    const covered = new Set(readFileSync(CHARSET_PATH, 'utf8'))
    const missing = [...sourceCharacters()].filter((c) => isHangul(c) && !covered.has(c))

    expect(
      missing,
      `폰트 서브셋에 없는 한글: ${missing.join('')}\n` +
        '→ python3 scripts/build-fonts.py 를 다시 실행하세요.',
    ).toEqual([])
  })

  it('서브셋이 부스에서 받을 만한 크기다', () => {
    const bytes = statSync(join(ROOT, 'public', 'fonts', 'Pretendard-subset.woff2')).size
    // 행사장 wifi 기준. 넘어가면 서브셋 전략이 무너진 것이다.
    expect(bytes).toBeLessThan(400 * 1024)
  })
})
