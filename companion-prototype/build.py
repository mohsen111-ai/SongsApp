"""Bundle template.html + poses/*.jpg into one self-contained index.html."""
import base64, json, pathlib

here = pathlib.Path(__file__).parent
poses = sorted((here / "poses").glob("*.jpg"))
uris = ["data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode() for p in poses]
feats = (here / "feats.json").read_text()
html = (here / "template.html").read_text().replace("/*POSES*/[]", json.dumps(uris)).replace("/*FEATS*/[]", feats)
(here / "index.html").write_text(html)
print(f"index.html: {len(html) / 1e6:.1f} MB, {len(uris)} poses")
