"""
extractor.py - 通用双语文档提取引擎
支持递归扫描指定目录下的 .md 和 .txt 文件，自动提取同行或上下两行的中英文对照条目。
"""

import os
import re
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple


def count_cjk(text: str) -> int:
    """计算文本中 CJK 汉字数量"""
    return len(re.findall(r'[\u4e00-\u9fff]', text))


def count_en_words(text: str) -> int:
    """计算文本中英文字词数量（至少1个英文字母组成的单词）"""
    return len(re.findall(r'[a-zA-Z]+', text))


def is_predominantly_zh(text: str, min_cjk: int = 1) -> bool:
    """判断是否主要为中文"""
    cjk = count_cjk(text)
    en = count_en_words(text)
    if cjk < min_cjk:
        return False
    return (cjk >= en) or (en == 0)


def is_predominantly_en(text: str, min_en: int = 1) -> bool:
    """判断是否主要为英文"""
    cjk = count_cjk(text)
    en = count_en_words(text)
    if en < min_en:
        return False
    return (en >= cjk) or (cjk == 0)


def is_heading_or_divider(line: str) -> bool:
    """判断是否为标题行或分割线"""
    s = line.strip()
    if not s:
        return False
    if re.match(r'^#{1,6}\s+', s):
        return True
    if re.match(r'^(\-{3,}|\={3,}|\*{3,})$', s):
        return True
    return False


def is_intro_label(text: str) -> bool:
    """判断是否为纯引言/标签行（如'注意：'、'有空行的情况：'、'Note:'等）"""
    s = text.strip()
    if not s:
        return False
    if re.match(r'^(?:有空行的情况|例如|比如|注意|提示|示例|场景|说明|测试|Note|Notice|Example|Tips?)[:：]$', s, re.IGNORECASE):
        return True
    if len(s) <= 12 and s.endswith((':', '：')) and not re.search(r'[\s,，。]', s[:-1]):
        return True
    return False



def clean_markdown_and_decorations(text: str) -> str:
    """清理 Markdown 语法标记和首尾特殊符号"""
    if not text:
        return ""
    s = text.strip()
    # 移除行首 Markdown 标记（引用 >、列表符号 * - +、数字列表 1. 等、标题 #）
    s = re.sub(r'^[>\s*\-•\+\#\d\.\:\：\|\t]+', '', s)
    # 移除 Markdown 链接语法 [text](url) -> text
    s = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', s)
    # 移除 Markdown 强调符号 * _ `
    s = re.sub(r'[*_`]', '', s)
    # 移除首尾多余空白和常见成对包裹括号（如果是外层全包裹）
    s = s.strip()
    if (s.startswith('(') and s.endswith(')')) or (s.startswith('（') and s.endswith('）')):
        s = s[1:-1].strip()
    if (s.startswith('[') and s.endswith(']')) or (s.startswith('【') and s.endswith('】')):
        s = s[1:-1].strip()
    return s.strip()


class BilingualExtractor:
    def __init__(self, target_dir: str = "."):
        self.target_dir = Path(target_dir).resolve()

    def scan_files(self) -> List[Path]:
        """查找目标目录下所有的 .md 和 .txt 文件"""
        if not self.target_dir.exists():
            return []
        if self.target_dir.is_file():
            if self.target_dir.suffix.lower() in ['.md', '.txt']:
                return [self.target_dir]
            return []
        
        valid_files = []
        for ext in ['*.md', '*.txt']:
            valid_files.extend(self.target_dir.rglob(ext))
        # 排除隐藏目录（如 .git, .gemini 等）
        filtered = [f for f in valid_files if not any(part.startswith('.') for part in f.parts)]
        return sorted(filtered)

    def extract_from_file(self, filepath: Path) -> List[Dict[str, Any]]:
        """从单个文件中提取双语卡片"""
        filepath = Path(filepath).resolve()
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return []

        cards = []
        lines = content.splitlines()
        if self.target_dir.is_file():
            rel_path = filepath.name
        else:
            try:
                rel_path = str(filepath.relative_to(self.target_dir))
                if rel_path == ".":
                    rel_path = filepath.name
            except Exception:
                rel_path = filepath.name

        # 预处理：标记代码块区间并跳过
        is_code_block = False
        valid_lines = []
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('```'):
                is_code_block = not is_code_block
                valid_lines.append((idx + 1, "", True, False, False))  # line_no, content, is_code, is_heading, is_quote
                continue
            if is_code_block:
                valid_lines.append((idx + 1, "", True, False, False))
            else:
                is_heading = is_heading_or_divider(stripped)
                is_quote = stripped.startswith('>')
                valid_lines.append((idx + 1, line, False, is_heading, is_quote))

        # 1. 解析同一行（表格、括号配对、分隔符）
        current_headers = []
        in_table = False
        for line_no, raw_line, is_code, is_heading, is_quote in valid_lines:
            if is_code or is_heading or not raw_line.strip():
                in_table = False
                current_headers = []
                continue

            # A. Markdown 表格行检测
            if '|' in raw_line:
                stripped = raw_line.strip()
                if re.match(r'^\s*\|?\s*[-:]+\s*\|', stripped):
                    # 表格分隔行
                    in_table = True
                    continue
                cells = [clean_markdown_and_decorations(c) for c in stripped.split('|')]
                cells = [c for c in cells if c]
                if not in_table and not any(is_predominantly_en(c) and is_predominantly_zh(c) for c in cells):
                    # 表头行
                    current_headers = cells
                    in_table = True
                    continue
                else:
                    # 数据行
                    table_card = self._parse_table_row(cells, current_headers, rel_path, line_no)
                    if table_card:
                        cards.append(table_card)
                        continue
            else:
                in_table = False
                current_headers = []

            # B. 同一行内正则配对（括号与分隔符）
            inline_cards = self._parse_inline_pairs(raw_line, rel_path, line_no)
            if inline_cards:
                cards.extend(inline_cards)

        # 2. 解析上下两行（相邻两行或相隔1空行）
        i = 0
        while i < len(valid_lines):
            line_no_1, raw_1, is_code_1, is_heading_1, is_quote_1 = valid_lines[i]
            if is_code_1 or is_heading_1 or not raw_1.strip() or '|' in raw_1:
                i += 1
                continue

            clean_1 = clean_markdown_and_decorations(raw_1)
            if not clean_1 or is_intro_label(clean_1):
                i += 1
                continue

            # 寻找紧邻的下一行（如果当前是引用行 >，优先寻找同样是引用的下一行）
            target_idx = -1
            for offset in [1, 2]:
                cand_idx = i + offset
                if cand_idx < len(valid_lines):
                    _, cand_raw, cand_code, cand_heading, cand_quote = valid_lines[cand_idx]
                    if cand_code or cand_heading:
                        break
                    if not cand_raw.strip():
                        continue  # 允许跳过一个空行
                    clean_cand = clean_markdown_and_decorations(cand_raw)
                    if is_intro_label(clean_cand):
                        continue
                    # 检查类型匹配
                    if is_quote_1 and not cand_quote and offset == 1:
                        # 引用行优先配对引用行
                        continue
                    target_idx = cand_idx
                    break

            if target_idx != -1:
                line_no_2, raw_2, _, _, _ = valid_lines[target_idx]
                if '|' not in raw_2:
                    clean_2 = clean_markdown_and_decorations(raw_2)
                    pair = self._check_bilingual_pair(clean_1, clean_2)
                    if pair:
                        zh, en = pair
                        cards.append(self._create_card(
                            chinese=zh,
                            english=en,
                            source_file=rel_path,
                            line_number=line_no_1,
                            extract_type="adjacent_lines"
                        ))
                        i = target_idx + 1
                        continue

            i += 1

        return cards

    def _parse_table_row(self, cells: list, headers: list, rel_path: str, line_no: int) -> Optional[Dict[str, Any]]:
        """智能解析表格行，根据表头或语义推断中英对应列"""
        if len(cells) < 2:
            return None

        zh_col = None
        en_col = None

        # 1. 优先根据表头关键词匹配对应列
        if headers:
            for idx, h in enumerate(headers[:len(cells)]):
                if re.search(r'中文|含义|释义|翻译|分析|Chinese|Prompt', h, re.IGNORECASE):
                    if zh_col is None:
                        zh_col = idx
                elif re.search(r'英文|表达|句子|English|Answer|Target', h, re.IGNORECASE):
                    if en_col is None:
                        en_col = idx

        if zh_col is not None and en_col is not None and zh_col < len(cells) and en_col < len(cells):
            c_zh = cells[zh_col]
            c_en = cells[en_col]
            if is_predominantly_zh(c_zh, min_cjk=1) and is_predominantly_en(c_en, min_en=1):
                return self._create_card(
                    chinese=c_zh,
                    english=c_en,
                    source_file=rel_path,
                    line_number=line_no,
                    extract_type="markdown_table"
                )

        # 2. 回退启发式查找
        zh_candidates = []
        en_candidates = []
        for idx, c in enumerate(cells):
            # 排除显式的备注/说明列
            if headers and idx < len(headers):
                if re.search(r'备注|说明|Tips?|Notes?|避坑|心法', headers[idx], re.IGNORECASE):
                    continue
            if is_predominantly_zh(c, min_cjk=1) and not c.startswith(('杜绝', '注意', '提示', '说明', 'Note:')):
                zh_candidates.append(c)
            elif is_predominantly_en(c, min_en=1):
                en_candidates.append(c)

        if zh_candidates and en_candidates:
            best_zh = max(zh_candidates, key=lambda s: len(s))
            best_en = max(en_candidates, key=lambda s: len(s))
            if best_zh != best_en:
                return self._create_card(
                    chinese=best_zh,
                    english=best_en,
                    source_file=rel_path,
                    line_number=line_no,
                    extract_type="markdown_table"
                )
        return None

    def _parse_inline_pairs(self, raw_line: str, rel_path: str, line_no: int) -> List[Dict[str, Any]]:
        """提取同一行内的中英对照条目"""
        cards = []
        cleaned_line = clean_markdown_and_decorations(raw_line)
        if not cleaned_line:
            return cards

        # 规则 1: 括号型提取
        bracket_patterns = [
            (r'([a-zA-Z0-9\s\-\'\"/,]{1,})\s*[（\(]([\u4e00-\u9fff\s，、；。？！“”‘’A-Za-z0-9\-\_]+)[）\)]', 'en_zh'),
            (r'([\u4e00-\u9fff\s，、；。？！“”‘’A-Za-z0-9\-\_]{1,})\s*[（\(]([a-zA-Z0-9\s\-\'\"/,]{1,})[）\)]', 'zh_en'),
            (r'[【\[]([\u4e00-\u9fff\s，、]+)[】\]]\s*([a-zA-Z0-9\s\-\'\"/,]{1,})', 'zh_en'),
            (r'[【\[]([a-zA-Z0-9\s\-\'\"/,]{1,})[】\]]\s*([\u4e00-\u9fff\s，、]+)', 'en_zh'),
        ]

        matched_spans = []
        for pat, order in bracket_patterns:
            for match in re.finditer(pat, raw_line):
                span = match.span()
                if any(s[0] <= span[0] and span[1] <= s[1] for s in matched_spans):
                    continue
                p1 = clean_markdown_and_decorations(match.group(1))
                p2 = clean_markdown_and_decorations(match.group(2))
                zh, en = ("", "")
                if order == 'en_zh':
                    if is_predominantly_en(p1) and count_cjk(p2) >= 1:
                        zh, en = p2, p1
                else:
                    if count_cjk(p1) >= 1 and is_predominantly_en(p2):
                        zh, en = p1, p2

                if zh and en and len(en) >= 1 and len(zh) >= 1:
                    matched_spans.append(span)
                    cards.append(self._create_card(
                        chinese=zh,
                        english=en,
                        source_file=rel_path,
                        line_number=line_no,
                        extract_type="inline_bracket"
                    ))

        # 规则 2: 分隔符型提取
        if not cards:
            delimiters = [r'\s*——\s*', r'\s*—\s*', r'\s*--\s*', r'\s*:\s*', r'\s*：\s*', r'\t+', r'\s+-\s+']
            for delim in delimiters:
                parts = re.split(delim, cleaned_line, maxsplit=1)
                if len(parts) == 2:
                    p1 = clean_markdown_and_decorations(parts[0])
                    p2 = clean_markdown_and_decorations(parts[1])
                    pair = self._check_bilingual_pair(p1, p2)
                    if pair:
                        zh, en = pair
                        cards.append(self._create_card(
                            chinese=zh,
                            english=en,
                            source_file=rel_path,
                            line_number=line_no,
                            extract_type="inline_delimiter"
                        ))
                        break

        return cards

    def _check_bilingual_pair(self, text1: str, text2: str) -> Optional[Tuple[str, str]]:
        """判断两段文本是否构成一中一英配对，返回 (zh, en)"""
        t1_zh = is_predominantly_zh(text1, min_cjk=1)
        t1_en = is_predominantly_en(text1, min_en=1)
        t2_zh = is_predominantly_zh(text2, min_cjk=1)
        t2_en = is_predominantly_en(text2, min_en=1)

        # 必须一边是中文，一边是英文
        if t1_en and t2_zh and not (t1_zh and t1_en and t2_zh and t2_en):
            return (text2, text1)
        elif t1_zh and t2_en and not (t1_zh and t1_en and t2_zh and t2_en):
            return (text1, text2)
        return None

    def _create_card(self, chinese: str, english: str, source_file: str, line_number: int, extract_type: str) -> Dict[str, Any]:
        """生成标准闪卡对象"""
        raw_key = f"{chinese.strip()}|||{english.strip()}"
        card_id = hashlib.md5(raw_key.encode('utf-8')).hexdigest()[:12]
        return {
            "id": card_id,
            "chinese": chinese.strip(),
            "english": english.strip(),
            "source_file": source_file,
            "line_number": line_number,
            "extract_type": extract_type,
            "status": "new",  # new, learning, mastered
            "review_count": 0,
            "error_count": 0,
            "last_practiced": None
        }

    def extract_all(self) -> List[Dict[str, Any]]:
        """扫描并提取所有文件，去重后返回"""
        files = self.scan_files()
        all_cards = []
        seen_keys = set()

        for f in files:
            file_cards = self.extract_from_file(f)
            for card in file_cards:
                key = (card['chinese'], card['english'])
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_cards.append(card)

        return all_cards
