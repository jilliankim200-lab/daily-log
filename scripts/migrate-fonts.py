"""
하드코딩 fontSize → 디자인 토큰 마이그레이션
사용: python migrate-fonts.py <file1> <file2> ...
"""
import re, sys, pathlib

# px → 토큰 매핑
def px_to_token(px: int) -> str:
    if px <= 12:   return "var(--text-xs)"
    if px <= 14:   return "var(--text-sm)"
    if px <= 16:   return "var(--text-base)"
    if px <= 18:   return "var(--text-lg)"
    if px <= 22:   return "var(--text-xl)"
    if px <= 26:   return "var(--text-2xl)"
    if px <= 31:   return "var(--text-3xl)"
    return "var(--text-4xl)"

# 정규식: fontSize: 13   /   fontSize: '13px'   /   fontSize: "13px"
NUM_RE = re.compile(r"fontSize:\s*(\d+)(?=\s*[,\}\)])")
STR_RE = re.compile(r"fontSize:\s*['\"](\d+)px['\"]")

def migrate(path: pathlib.Path) -> tuple[int, int]:
    src = path.read_text(encoding="utf-8")
    n_num = n_str = 0

    def num_repl(m: re.Match) -> str:
        nonlocal n_num
        n_num += 1
        return f"fontSize: '{px_to_token(int(m.group(1)))}'"
    def str_repl(m: re.Match) -> str:
        nonlocal n_str
        n_str += 1
        return f"fontSize: '{px_to_token(int(m.group(1)))}'"

    out = NUM_RE.sub(num_repl, src)
    out = STR_RE.sub(str_repl, out)

    if n_num + n_str > 0:
        path.write_text(out, encoding="utf-8")
    return n_num, n_str

if __name__ == "__main__":
    total_num = total_str = 0
    for arg in sys.argv[1:]:
        p = pathlib.Path(arg)
        if not p.exists():
            print(f"  ! not found: {p}")
            continue
        n_num, n_str = migrate(p)
        total_num += n_num
        total_str += n_str
        print(f"  {p.name}: {n_num} num + {n_str} str = {n_num + n_str}")
    print(f"\nTotal: {total_num} num + {total_str} str = {total_num + total_str} replacements")
