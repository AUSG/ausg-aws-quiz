import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
const CHARSET_PATH = join(ROOT, 'scripts', 'font-charset.txt')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html'])

/**
 * 주석은 화면에 렌더되지 않으므로 검사 대상이 아니다.
 * 이걸 빼먹으면 한글 주석을 쓸 때마다 테스트가 깨지고, 결국 주석을
 * 영어로 바꾸게 된다 — 폰트 최적화가 코드 가독성을 갉아먹는 셈이다.
 * scripts/build-fonts.py 의 strip_comments 와 같은 규칙이어야 한다.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

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
    for (const char of stripComments(readFileSync(file, 'utf8'))) {
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

  it('주석의 한글은 서브셋을 키우지 않는다', () => {
    // 주석을 한글로 쓴다고 폰트가 커지면 안 된다. 그러면 개발자가
    // 테스트를 통과시키려고 주석을 영어로 바꾸게 된다.
    const withComment = stripComments('// 주석에만 있는 글자 뷁\nconst a = 1')
    expect(withComment).not.toContain('뷁')
    expect(withComment).toContain('const a = 1')
  })

  it('빌드 산출물이 배포에 실려 나가지 않는다', () => {
    // charset.txt를 public/ 에 두면 dist/ 로 복사되고 서비스 워커까지 캐시한다.
    expect(existsSync(join(ROOT, 'public', 'fonts', 'Pretendard-subset.charset.txt'))).toBe(false)
  })

  it('서브셋이 부스에서 받을 만한 크기다', () => {
    const bytes = statSync(join(ROOT, 'public', 'fonts', 'Pretendard-subset.woff2')).size
    // 행사장 wifi 기준. 넘어가면 서브셋 전략이 무너진 것이다.
    expect(bytes).toBeLessThan(400 * 1024)
  })
})
