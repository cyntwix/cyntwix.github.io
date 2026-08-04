import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path
from unittest import mock

import server


class CyntwixApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_patch = mock.patch.object(
            server,
            "DATABASE_PATH",
            Path(self.temp_dir.name) / "entries.db",
        )
        self.db_patch.start()
        server.submission_times.clear()
        server.initialize_db()

        handler = partial(server.CyntwixHandler, directory=str(server.SITE_ROOT))
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        self.db_patch.stop()
        self.temp_dir.cleanup()

    def request_json(self, path, method="GET", payload=None):
        data = None
        headers = {"Accept": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(
            self.base_url + path,
            method=method,
            data=data,
            headers=headers,
        )
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)

    def test_submission_is_visible_in_public_archive(self):
        payload = {
            "name": "A Test Visitor",
            "words": ["fire", "grain", "angel"],
            "text": "An angel found fire inside a grain of sand.",
            "website": "",
        }
        status, created = self.request_json(
            "/api/entries", method="POST", payload=payload
        )
        self.assertEqual(status, 201)
        self.assertEqual(created["entry"]["name"], "A Test Visitor")

        status, archive = self.request_json("/api/entries")
        self.assertEqual(status, 200)
        self.assertEqual(len(archive["entries"]), 1)
        self.assertEqual(archive["entries"][0]["text"], payload["text"])

    def test_submission_must_use_every_prompt_word(self):
        payload = {
            "name": "A Test Visitor",
            "words": ["fire", "grain", "angel"],
            "text": "An angel found a grain of sand.",
            "website": "",
        }
        request = urllib.request.Request(
            self.base_url + "/api/entries",
            method="POST",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )

        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(request)
        self.assertEqual(caught.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
