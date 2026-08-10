#!/usr/bin/env python3
"""
Pretendard(한글)를 앱이 실제로 쓰는 글자만 남겨 서브셋으로 만든다.

왜 서브셋인가:
  원본 가변 폰트 2,010KB / 한글 음절 전체 블록 1,713KB / 실사용 글자만 약 140KB.
  부스는 행사장 wifi에서 첫 로딩이 되어야 하므로 이 차이가 결정적이다.

왜 안전한가:
  이 스크립트는 사용한 글자 목록을 charset.txt로 함께 남기고,
  src/test/fontCoverage.test.ts 가 소스의 글자가 전부 포함됐는지 검증한다.
  문제를 고쳐 새 글자가 생기면 테스트가 깨지고, 이 스크립트를 다시 돌리면 된다.

사용법:
  python3 scripts/build-fonts.py

의존성:
  pip install fonttools brotli
"""

from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIRS = [ROOT / "src"]
EXTRA_FILES = [ROOT / "index.html"]
OUT_DIR = ROOT / "public" / "fonts"
OUT_FONT = OUT_DIR / "Pretendard-subset.woff2"
OUT_CHARSET = OUT_DIR / "Pretendard-subset.charset.txt"

PRETENDARD_VERSION = "v1.3.9"
PRETENDARD_URL = (
    f"https://cdn.jsdelivr.net/gh/orioncactus/pretendard@{PRETENDARD_VERSION}"
    "/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"
)

# 서브셋에 항상 포함할 범위. 라틴/문장부호/한글 자모/전각기호는
# 문구를 조금 바꿔도 깨지지 않도록 통째로 넣는다(비용이 작다).
ALWAYS_UNICODES = ",".join(
    [
        "U+0020-007E",  # 기본 라틴
        "U+00A0-00FF",  # 라틴-1 보충
        "U+2000-206F",  # 일반 문장부호 (·, —, … 등)
        "U+20A9,U+20AC",  # ₩, €
        "U+2190-21FF",  # 화살표
        "U+2460-24FF",  # 원문자
        "U+25A0-25FF",  # 도형
        "U+3000-303F",  # CJK 문장부호
        "U+3131-318E",  # 한글 호환 자모
        "U+FF00-FFEF",  # 전각 형태
    ]
)


def collect_source_text() -> str:
    """화면에 렌더되는 소스만 읽어 실제로 등장하는 글자를 모은다.

    테스트는 제외한다. 화면에 나가지 않는 글자까지 넣으면 서브셋이 커지고,
    커버리지 테스트가 자기 자신의 글자를 요구하는 자기참조에 빠진다.
    """
    chunks: list[str] = []
    for directory in SRC_DIRS:
        for path in sorted(directory.rglob("*")):
            if "test" in path.relative_to(ROOT).parts:
                continue
            if path.suffix in {".ts", ".tsx", ".css", ".html"} and path.is_file():
                chunks.append(path.read_text(encoding="utf-8"))
    for path in EXTRA_FILES:
        if path.is_file():
            chunks.append(path.read_text(encoding="utf-8"))
    return "".join(chunks)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    source_text = collect_source_text()
    used = sorted(set(source_text) - {"\n", "\r", "\t"})
    hangul = [c for c in used if "가" <= c <= "힣"]
    print(f"소스에서 수집한 고유 문자 {len(used)}개 (한글 음절 {len(hangul)}개)")

    charset = "".join(used)
    OUT_CHARSET.write_text(charset, encoding="utf-8")

    cache = ROOT / ".cache" / f"PretendardVariable-{PRETENDARD_VERSION}.woff2"
    if not cache.is_file():
        cache.parent.mkdir(parents=True, exist_ok=True)
        print(f"Pretendard {PRETENDARD_VERSION} 내려받는 중…")
        urllib.request.urlretrieve(PRETENDARD_URL, cache)

    charset_file = OUT_DIR / ".charset.tmp"
    charset_file.write_text(charset, encoding="utf-8")
    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                str(cache),
                f"--text-file={charset_file}",
                f"--unicodes={ALWAYS_UNICODES}",
                "--layout-features=*",
                "--flavor=woff2",
                f"--output-file={OUT_FONT}",
            ],
            check=True,
        )
    finally:
        charset_file.unlink(missing_ok=True)

    size_kb = OUT_FONT.stat().st_size / 1024
    original_kb = cache.stat().st_size / 1024
    print(f"\n{OUT_FONT.relative_to(ROOT)}  {size_kb:.1f} KB  (원본 {original_kb:.1f} KB)")
    print(f"{OUT_CHARSET.relative_to(ROOT)}  글자 {len(used)}개")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
