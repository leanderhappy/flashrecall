import os
import shutil
import tempfile
import unittest
from pathlib import Path
from extractor import BilingualExtractor, clean_markdown_and_decorations


class TestBilingualExtractor(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.test_path = Path(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_same_line_brackets(self):
        sample_md = """
# 词汇清单
1. Opportunity Cost (机会成本)
2. 沉没成本 (Sunk Cost)
3. 【民间慈善】Philanthropy
4. [Public Welfare] 公共福祉
"""
        filepath = self.test_path / "vocab.md"
        filepath.write_text(sample_md, encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        cards = extractor.extract_from_file(filepath)
        
        self.assertGreaterEqual(len(cards), 4)
        pairs = {(c['chinese'], c['english']) for c in cards}
        self.assertIn(('机会成本', 'Opportunity Cost'), pairs)
        self.assertIn(('沉没成本', 'Sunk Cost'), pairs)
        self.assertIn(('民间慈善', 'Philanthropy'), pairs)
        self.assertIn(('公共福祉', 'Public Welfare'), pairs)

    def test_same_line_delimiters(self):
        sample_txt = """
apple - 苹果
香蕉 : banana
猫咪 —— cat
dog\t狗
"""
        filepath = self.test_path / "simple.txt"
        filepath.write_text(sample_txt, encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        cards = extractor.extract_from_file(filepath)

        pairs = {(c['chinese'], c['english']) for c in cards}
        self.assertIn(('苹果', 'apple'), pairs)
        self.assertIn(('香蕉', 'banana'), pairs)
        self.assertIn(('猫咪', 'cat'), pairs)
        self.assertIn(('狗', 'dog'), pairs)

    def test_markdown_table(self):
        sample_md = """
| 功能分类 | 中文释义 | 英文表达 | 备注 |
| :--- | :--- | :--- | :--- |
| 中心句 | 这个说法太绝对了，必须分情况讨论。 | This claim is overly broad and requires analysis. | 常用 |
| 总结 | 历史教训清楚证明了这一点。 | Historical lessons clearly demonstrate this point. | 结尾 |
"""
        filepath = self.test_path / "table.md"
        filepath.write_text(sample_md, encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        cards = extractor.extract_from_file(filepath)

        pairs = {(c['chinese'], c['english']) for c in cards}
        self.assertIn(('这个说法太绝对了，必须分情况讨论。', 'This claim is overly broad and requires analysis.'), pairs)
        self.assertIn(('历史教训清楚证明了这一点。', 'Historical lessons clearly demonstrate this point.'), pairs)

    def test_adjacent_lines(self):
        sample_md = """
# 重点论述

> Admittedly, certain public objectives are essential to society.
> （诚然，某些公共目标对社会至关重要。）

*切入点：科技探索的本质是未知的。*
*Scientific research, by its nature, explores uncharted territory.*

有空行的情况：
History offers few foolproof panaceas for policymaking.

历史极少为现代政策制定提供万灵药。
"""
        filepath = self.test_path / "adjacent.md"
        filepath.write_text(sample_md, encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        cards = extractor.extract_from_file(filepath)

        pairs = {(c['chinese'], c['english']) for c in cards}
        self.assertIn(('诚然，某些公共目标对社会至关重要。', 'Admittedly, certain public objectives are essential to society.'), pairs)
        self.assertIn(('切入点：科技探索的本质是未知的。', 'Scientific research, by its nature, explores uncharted territory.'), pairs)
        self.assertIn(('历史极少为现代政策制定提供万灵药。', 'History offers few foolproof panaceas for policymaking.'), pairs)

    def test_ignore_code_blocks(self):
        sample_md = """
下面是代码示例：
```python
# comment - 注释
hello_world = "你好世界"
```
正文中的内容：
Hello world (你好世界)
"""
        filepath = self.test_path / "code.md"
        filepath.write_text(sample_md, encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        cards = extractor.extract_from_file(filepath)

        # 应该只提取出正文中的 Hello world
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]['english'], 'Hello world')
        self.assertEqual(cards[0]['chinese'], '你好世界')

    def test_recursive_directory_scan(self):
        # 创建子目录
        sub1 = self.test_path / "sub1"
        sub1.mkdir()
        (sub1 / "doc1.md").write_text("Hello (你好)\nWorld (世界)", encoding='utf-8')
        
        sub2 = self.test_path / "sub2" / "nested"
        sub2.mkdir(parents=True)
        (sub2 / "doc2.txt").write_text("Computer - 计算机\n", encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        all_cards = extractor.extract_all()
        pairs = {(c['chinese'], c['english']) for c in all_cards}
        self.assertIn(('你好', 'Hello'), pairs)
        self.assertIn(('世界', 'World'), pairs)
        self.assertIn(('计算机', 'Computer'), pairs)

    def test_deduplication(self):
        # 相同中英文配对在不同地方出现，extract_all 应当自动去重
        file1 = self.test_path / "f1.md"
        file2 = self.test_path / "f2.txt"
        file1.write_text("Artificial Intelligence (人工智能)", encoding='utf-8')
        file2.write_text("人工智能 : Artificial Intelligence", encoding='utf-8')

        extractor = BilingualExtractor(self.test_dir)
        all_cards = extractor.extract_all()
        ai_cards = [c for c in all_cards if c['chinese'] == '人工智能']
        self.assertEqual(len(ai_cards), 1)
        self.assertEqual(ai_cards[0]['english'], 'Artificial Intelligence')


if __name__ == '__main__':
    unittest.main()

