"""Serve only the production bundle at /review/idleops/, without rewrite rules."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

build = Path("dist").resolve()
if not (build / "index.html").is_file():
    raise SystemExit("Run npm run build first")

with TemporaryDirectory() as root:
    mount = Path(root, "review", "idleops")
    mount.parent.mkdir()
    mount.symlink_to(build, target_is_directory=True)
    handler = partial(SimpleHTTPRequestHandler, directory=root)
    with ThreadingHTTPServer(("127.0.0.1", 4175), handler) as server:
        server.serve_forever()
