"""確認用のローカルサーバー。
ブラウザにキャッシュさせないので、直した内容がそのまま画面に出る。
本番(GitHub Pages)はETagを返すのでこの問題は起きない。"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8778
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVE = os.path.dirname(REPO)   # /axis-training-manager/ のパスで開けるよう親から配る


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(NoCache, directory=SERVE)
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print("serving", SERVE, "on", PORT, "(no-store)")
        httpd.serve_forever()
