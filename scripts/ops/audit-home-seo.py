"""Read-only checks of actual homepage HTML, without executing JavaScript.
Usage: python3 scripts/ops/audit-home-seo.py https://takatak.ca
"""
import json
import sys
from html.parser import HTMLParser
from urllib.request import Request, urlopen


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = None
        self.title = ""
        self.description = ""
        self.links = []
        self.images = []
        self.graphs = []
        self.h1 = 0
        self.in_title = False
        self.ld = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta" and attrs.get("name") == "description":
            self.description = attrs.get("content", "")
        if tag == "link":
            self.links.append(attrs)
        if tag == "img":
            self.images.append(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.ld = ""

    def handle_data(self, text):
        if self.in_title:
            self.title += text
        if self.ld is not None:
            self.ld += text

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.ld is not None:
            self.graphs.append(json.loads(self.ld))
            self.ld = None


def audit(origin):
    for lang, path in [("en", "/"), ("fr", "/?lang=fr")]:
        url = origin.rstrip("/") + path
        with urlopen(Request(url, headers={"User-Agent": "TAKATAK-SEO-Verification/1.0"}), timeout=45) as response:
            page = Page()
            page.feed(response.read().decode("utf-8"))
        alternates = {link.get("hreflang"): link.get("href") for link in page.links if link.get("hreflang")}
        canonicals = [link.get("href") for link in page.links if link.get("rel") == "canonical"]
        nodes = [node for graph in page.graphs for node in graph.get("@graph", [graph])]
        types = {node.get("@type") for node in nodes}
        checks = {
            "server_language": page.lang == lang,
            "title_length": 50 <= len(page.title) <= 65,
            "description_length": 140 <= len(page.description) <= 165,
            "one_h1": page.h1 == 1,
            "canonical": len(canonicals) == 1 and canonicals[0].rstrip("/") == url.rstrip("/"),
            "hreflang": set(alternates) == {"en-CA", "fr-CA", "x-default"},
            "structured_data": {"Organization", "WebSite", "WebPage"} <= types,
            "image_alt_attributes": all("alt" in img for img in page.images),
        }
        print(json.dumps({"url": url, "title": page.title, "description_length": len(page.description), "checks": checks, "images": len(page.images), "decorative_images": sum(not img.get("alt") for img in page.images)}, ensure_ascii=False))
        if not all(checks.values()):
            raise SystemExit("Homepage SEO checks failed; see actual HTML results above")


if __name__ == "__main__":
    audit(sys.argv[1] if len(sys.argv) > 1 else "https://takatak.ca")
