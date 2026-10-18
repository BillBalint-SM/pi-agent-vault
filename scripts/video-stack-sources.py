"""Fetch a small, fixed set of public compatibility sources; no model/wheel/ISO downloads."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.request

LIMIT = 2 * 1024 * 1024
SOURCES = {
    "amd-matrix": "https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html",
    "amd-pytorch": "https://rocm.docs.amd.com/projects/ai-ecosystem/en/latest/frameworks/pytorch/install.html",
    "comfy-master-ref": "https://api.github.com/repos/Comfy-Org/ComfyUI/git/ref/heads/master",
    "ubuntu-24-release": "https://releases.ubuntu.com/24.04/",
}


def fetch(item, output):
    name, url = item
    record = {"name": name, "requestedUrl": url, "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Pi-compatibility-research/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            data = response.read(LIMIT + 1)
            if len(data) > LIMIT:
                raise ValueError("Source exceeds the conservative 2 MiB read limit")
            record.update(status=response.status, finalUrl=response.url, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        (output / (name + (".json" if "api.github.com" in url else ".html"))).write_bytes(data)
    except Exception as error:
        record["error"] = str(error)
    return record


def main():
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != "--details"):
        raise SystemExit("Usage: python scripts/video-stack-sources.py PRIVATE_OUTPUT_DIRECTORY [--details]")
    output = pathlib.Path(sys.argv[1])
    output.mkdir(parents=True, exist_ok=True)
    sources = SOURCES
    manifest = "manifest.json"
    if len(sys.argv) == 3:
        commit = json.loads((output / "comfy-master-ref.json").read_text(encoding="utf-8"))["object"]["sha"]
        if len(commit) != 40 or any(c not in "0123456789abcdef" for c in commit):
            raise ValueError("Invalid ComfyUI commit ref")
        sources = {
            "comfy-pinned-readme": f"https://raw.githubusercontent.com/Comfy-Org/ComfyUI/{commit}/README.md",
            "comfy-pinned-requirements": f"https://raw.githubusercontent.com/Comfy-Org/ComfyUI/{commit}/requirements.txt",
            "amd-next-torch-index": "https://stable.repo.amd.com/rocm/whl-next/torch/",
            "amd-next-vision-index": "https://stable.repo.amd.com/rocm/whl-next/torchvision/",
            "amd-multiarch-torch-index": "https://repo.amd.com/rocm/whl-multi-arch/torch/",
            "amd-multiarch-vision-index": "https://repo.amd.com/rocm/whl-multi-arch/torchvision/",
            "ubuntu-checksums": "https://releases.ubuntu.com/24.04/SHA256SUMS",
        }
        manifest = "details-manifest.json"
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records = list(pool.map(lambda item: fetch(item, output), sources.items()))
    (output / manifest).write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(records, ensure_ascii=True, indent=2))
    if any("error" in record for record in records):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
