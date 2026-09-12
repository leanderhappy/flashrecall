#!/usr/bin/env python3
"""
app.py - 智能双语文档提取与默写闪卡系统服务端
完全使用 Python 3 标准库，无需安装任何额外 pip 依赖。
提供本地 Web 服务与命令行交互练习双模式。
"""

import os
import sys
import json
import argparse
import subprocess
import webbrowser
from pathlib import Path
from typing import Optional
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from extractor import BilingualExtractor

BASE_DIR = Path(__file__).parent.resolve()
WEB_DIR = BASE_DIR / "web"
DB_FILE = BASE_DIR / "flashcards.json"


def pick_directory_native(initial_dir: str = ".") -> Optional[str]:
    """通过系统原生弹窗选择目录"""
    init_dir = initial_dir if os.path.isdir(initial_dir) else os.path.dirname(initial_dir) or "."
    if sys.platform == 'darwin':
        script = 'POSIX path of (choose folder with prompt "请选择要扫描的 Markdown/Txt 文档目录:")'
        try:
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=60
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception as e:
            print(f"osascript error: {e}")

    # 回退尝试 tkinter
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        path = filedialog.askdirectory(initialdir=init_dir, title="请选择文档目录")
        root.destroy()
        if path:
            return path
    except Exception:
        pass

    return None


def pick_file_native(initial_dir: str = ".") -> Optional[str]:
    """通过系统原生弹窗选择单个 Markdown/Txt 文档"""
    init_dir = initial_dir if os.path.isdir(initial_dir) else os.path.dirname(initial_dir) or "."
    if sys.platform == 'darwin':
        script = 'POSIX path of (choose file of type {"md", "txt", "markdown", "text", "public.plain-text"} with prompt "请选择要提取的 Markdown/Txt 文档:")'
        try:
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=60
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception:
            pass

        # 备用无类型过滤选择
        try:
            script_any = 'POSIX path of (choose file with prompt "请选择要提取的 Markdown/Txt 文档:")'
            res = subprocess.run(
                ["osascript", "-e", script_any],
                capture_output=True,
                text=True,
                timeout=60
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip()
        except Exception:
            pass

    # 回退尝试 tkinter
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        path = filedialog.askopenfilename(
            initialdir=init_dir,
            title="请选择 Markdown/Txt 文档",
            filetypes=[("Markdown/Text files", "*.md *.txt"), ("All files", "*.*")]
        )
        root.destroy()
        if path:
            return path
    except Exception:
        pass

    return None



class FlashcardManager:
    def __init__(self, target_dir: str = "."):
        self.target_dir = str(Path(target_dir).resolve())
        self.cards = []
        self.load_or_scan()

    def load_or_scan(self):
        """加载已保存的卡片库，或首次扫描"""
        saved_cards_map = {}
        if DB_FILE.exists():
            try:
                with open(DB_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        saved_cards = data.get("cards", [])
                        if "target_dir" in data:
                            self.target_dir = data["target_dir"]
                    else:
                        saved_cards = data
                    for c in saved_cards:
                        saved_cards_map[c.get("id")] = c
            except Exception as e:
                print(f"读取数据库失败: {e}")

        # 扫描当前目标目录
        self.rescan(self.target_dir, saved_cards_map)

    def rescan(self, new_dir: str, preserved_status_map: dict = None) -> list:
        """重新扫描指定目录并保留已有掌握进度"""
        self.target_dir = str(Path(new_dir).resolve())
        if preserved_status_map is None:
            preserved_status_map = {c["id"]: c for c in self.cards}

        extractor = BilingualExtractor(self.target_dir)
        fresh_cards = extractor.extract_all()

        merged_cards = []
        for card in fresh_cards:
            cid = card["id"]
            if cid in preserved_status_map:
                old = preserved_status_map[cid]
                card["status"] = old.get("status", "new")
                card["review_count"] = old.get("review_count", 0)
                card["error_count"] = old.get("error_count", 0)
                card["last_practiced"] = old.get("last_practiced", None)
                card["note"] = old.get("note", "")
            else:
                card["note"] = ""
            merged_cards.append(card)

        self.cards = merged_cards
        self.save_to_db()
        return self.cards

    def save_to_db(self):
        """保存卡片进度到本地 JSON 文件"""
        try:
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "target_dir": self.target_dir,
                    "cards": self.cards
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存数据库失败: {e}")

    def update_card(self, card_id: str, status: str, increment_error: bool = False, note: Optional[str] = None):
        """更新单个卡片状态与可选笔记"""
        for c in self.cards:
            if c["id"] == card_id:
                c["status"] = status
                c["review_count"] = c.get("review_count", 0) + 1
                if increment_error:
                    c["error_count"] = c.get("error_count", 0) + 1
                c["last_practiced"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if note is not None:
                    c["note"] = note
                self.save_to_db()
                return c
        return None

    def update_card_note(self, card_id: str, note: str):
        """更新单个卡片笔记"""
        for c in self.cards:
            if c["id"] == card_id:
                c["note"] = note
                self.save_to_db()
                return c
        return None

    def export_anki_tsv(self) -> str:
        """生成 Anki 格式的 TSV 文本"""
        lines = ["#separator:tab", "#html:true", "#tags column:3"]
        for c in self.cards:
            front = c["chinese"].replace("\t", " ").replace("\n", "<br>")
            back = c["english"].replace("\t", " ").replace("\n", "<br>")
            tag = f"BilingualDoc::{Path(c['source_file']).stem}"
            lines.append(f"{front}\t{back}\t{tag}")
        return "\n".join(lines)


# 全局管理实例
manager = FlashcardManager()


class FlashcardHTTPHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        """将请求路径映射到 web 目录下的静态资源"""
        parsed = urlparse(path)
        clean_path = parsed.path.lstrip('/')
        if clean_path == '' or clean_path == 'index.html':
            return str(WEB_DIR / 'index.html')
        target = WEB_DIR / clean_path
        if target.exists() and target.is_file():
            return str(target)
        return super().translate_path(path)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/cards':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            response_data = {
                "target_directory": manager.target_dir,
                "cards": manager.cards
            }
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            return

        elif parsed.path == '/api/export':
            params = parse_qs(parsed.query)
            fmt = params.get('format', ['anki'])[0]
            if fmt == 'json':
                content = json.dumps(manager.cards, ensure_ascii=False, indent=2)
                filename = "flashcards_backup.json"
                mimetype = "application/json"
            else:
                content = manager.export_anki_tsv()
                filename = "flashcards_anki.tsv"
                mimetype = "text/tab-separated-values"

            self.send_response(200)
            self.send_header('Content-Type', f'{mimetype}; charset=utf-8')
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))
            return

        # 其它静态资源请求交由基类处理
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(post_body) if post_body else {}
        except Exception:
            data = {}

        if parsed.path == '/api/scan':
            scan_dir = data.get('directory', manager.target_dir)
            updated_cards = manager.rescan(scan_dir)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "target_directory": manager.target_dir,
                "cards": updated_cards
            }, ensure_ascii=False).encode('utf-8'))
            return

        elif parsed.path == '/api/update_card':
            card_id = data.get('id')
            status = data.get('status', 'learning')
            inc_err = data.get('increment_error', False)
            note = data.get('note')
            updated = manager.update_card(card_id, status, inc_err, note=note)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"card": updated}, ensure_ascii=False).encode('utf-8'))
            return

        elif parsed.path in ('/api/update_card_note', '/api/update_note'):
            card_id = data.get('id')
            note = data.get('note', '')
            updated = manager.update_card_note(card_id, note)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"card": updated}, ensure_ascii=False).encode('utf-8'))
            return

        elif parsed.path == '/api/choose_folder':
            chosen = pick_directory_native(manager.target_dir)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "path": chosen,
                "canceled": chosen is None
            }, ensure_ascii=False).encode('utf-8'))
            return

        elif parsed.path == '/api/choose_file':
            chosen = pick_file_native(manager.target_dir)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({
                "path": chosen,
                "canceled": chosen is None
            }, ensure_ascii=False).encode('utf-8'))
            return

        self.send_error(404, "API Endpoint Not Found")

    def log_message(self, format, *args):
        """控制台只显示关键日志"""
        pass


def run_cli_dictation(manager: FlashcardManager):
    """终端命令行默写模式"""
    cards = manager.cards
    if not cards:
        print("未提取到任何卡片，请检查当前目录下是否有 .md 或 .txt 文件。")
        return

    print("\n" + "="*50)
    print(f"📚 双语终端默写练习 (共 {len(cards)} 张闪卡)")
    print("输入对应英文后按回车对比，输入 ':h' 提示，输入 ':q' 退出")
    print("="*50 + "\n")

    for idx, card in enumerate(cards):
        print(f"\n[{idx+1}/{len(cards)}] 来源: {card['source_file']} (L{card['line_number']})")
        print(f"🇨🇳 中文提示: {card['chinese']}")

        while True:
            try:
                user_ans = input("✍️  默写英文: ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\n已退出练习。")
                return

            if user_ans == ':q':
                print("练习结束。")
                return
            elif user_ans == ':h':
                words = card['english'].split()
                masked = " ".join([w[0] + "·"*(len(w)-1) if len(w) > 1 else w for w in words])
                print(f"💡 首字母提示: {masked}")
                continue

            target = card['english'].strip()
            if user_ans.lower() == target.lower():
                print("🎉 【完全正确！】100% 吻合！")
                manager.update_card(card['id'], 'mastered')
                break
            else:
                print(f"❌ 【拼写有差异】\n  你的输入: {user_ans}\n  标准答案: {target}")
                manager.update_card(card['id'], 'learning', increment_error=True)
                retry = input("  需要再试一次吗？(y/n 回车跳过): ").lower()
                if retry == 'y':
                    continue
                break


def main():
    port_from_env = os.environ.get("PORT")
    default_port = int(port_from_env) if port_from_env else 8765
    default_host = os.environ.get("HOST", "0.0.0.0" if port_from_env else "127.0.0.1")

    parser = argparse.ArgumentParser(description="文档双语自动提取与默写闪卡系统")
    parser.add_argument("--path", "--dir", dest="dir", default=".", help="要扫描提取的文档目录或单文件路径 (默认: 当前目录)")
    parser.add_argument("--host", default=default_host, help=f"Web 服务监听地址 (默认: {default_host})")
    parser.add_argument("--port", type=int, default=default_port, help=f"本地 Web 服务端口 (默认: {default_port})")
    parser.add_argument("--no-browser", action="store_true", help="启动服务后不自动打开浏览器")
    parser.add_argument("--cli", action="store_true", help="进入终端命令行默写模式，不启动 Web 服务")

    args = parser.parse_args()

    # 初始化管理器
    global manager
    manager = FlashcardManager(args.dir)

    print(f"已加载卡片库: 共提取到 {len(manager.cards)} 张闪卡。")
    print(f"扫描目录: {manager.target_dir}")

    if args.cli:
        run_cli_dictation(manager)
        return

    server_address = (args.host, args.port)
    try:
        httpd = HTTPServer(server_address, FlashcardHTTPHandler)
    except OSError:
        if not port_from_env:
            # 仅在本地开发且未指定云端端口时递增尝试
            args.port += 1
            server_address = (args.host, args.port)
            httpd = HTTPServer(server_address, FlashcardHTTPHandler)
        else:
            raise

    url = f"http://{args.host}:{args.port}"
    print("\n" + "="*50)
    print(f"🚀 双语默写闪卡服务已启动！")
    print(f"🌐 访问地址: {url}")
    print("="*50 + "\n")

    # 云端容器环境 (如 Render) 或无桌面环境时不自动唤起浏览器
    if not args.no_browser and not port_from_env and os.environ.get("RENDER") is None:
        try:
            webbrowser.open(f"http://127.0.0.1:{args.port}" if args.host == "0.0.0.0" else url)
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止。")
        httpd.server_close()


if __name__ == '__main__':
    main()
