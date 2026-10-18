"""Bounded I/O fixture, not a system backup or restore certification. Never follows reparse/cloud files."""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import stat
import subprocess
import time
import uuid
import zipfile

LIMIT = 32 * 1024 * 1024
UNSAFE_ATTRIBUTES = 0x400 | 0x1000 | 0x40000 | 0x400000  # reparse, offline, recall-on-open/data-access


def safe_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > LIMIT:
        raise ValueError(f"Not a bounded regular fixture file: {path}")
    for item in (path, *path.parents):
        if getattr(item.lstat(), "st_file_attributes", 0) & UNSAFE_ATTRIBUTES or item.is_symlink():
            raise ValueError(f"Refusing a reparse, offline or recall path: {item}")
    return info.st_size


def digest(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(block)
    return result.hexdigest()


def file_digest(path):
    with path.open("rb") as stream:
        return digest(stream)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination-parent", required=True)
    parser.add_argument("--archives-base")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    root = pathlib.Path(__file__).absolute().parent.parent
    relative = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=root).decode().split("\0")
    selected = []
    for name in filter(None, relative):
        source = root / name
        if not source.exists():
            continue
        # Never include private/generated material, even if accidentally tracked.
        if any(part in (".local", ".pi", "node_modules", "sessions", "runs", ".git") for part in pathlib.PurePosixPath(name).parts):
            raise ValueError("Private/generated path found in public-source fixture")
        selected.append((source, pathlib.PurePosixPath("source") / name, safe_file(source)))
    if args.archives_base:
        for source in sorted(pathlib.Path(args.archives_base).glob("*/source.tgz")):
            selected.append((source, pathlib.PurePosixPath("archives") / source.parent.name / source.name, safe_file(source)))
    total = sum(size for _, _, size in selected)
    if not selected or total > LIMIT or len(selected) > 100:
        raise ValueError("Fixture exceeds the 32 MiB / 100 file limit, or is empty; re-plan instead of scaling automatically")
    parent = pathlib.Path(args.destination_parent)
    if not parent.is_dir() or shutil.disk_usage(parent).free < 512 * 1024 * 1024:
        raise ValueError("Destination must exist and have at least 512 MiB free")
    for item in (parent, *parent.parents):
        if getattr(item.lstat(), "st_file_attributes", 0) & UNSAFE_ATTRIBUTES or item.is_symlink():
            raise ValueError("Refusing a reparse/cloud destination")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = parent / f"IO-pilot-{stamp}-{uuid.uuid4().hex[:8]}"
    destination.mkdir(exist_ok=False)
    checks = []
    start = time.perf_counter()
    for source, relative, size in selected:
        before = file_digest(source)
        target = destination / "copy" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        if file_digest(target) != before or file_digest(source) != before:
            raise ValueError("Copy verification failed or source changed; stop and preserve the fresh fixture")
        checks.append({"relative": str(relative), "bytes": size, "sha256": before})
    copy_seconds = time.perf_counter() - start
    start = time.perf_counter()
    archive = destination / "fixture.zip"
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for item in checks:
            output.write(destination / "copy" / item["relative"], item["relative"].replace(os.sep, "/"))
    zip_seconds = time.perf_counter() - start
    start = time.perf_counter()
    with zipfile.ZipFile(archive) as output:
        for item in checks:
            with output.open(item["relative"].replace(os.sep, "/")) as stream:
                if digest(stream) != item["sha256"]:
                    raise ValueError("Archive readback hash mismatch")
    verify_seconds = time.perf_counter() - start
    record = {"status": "PASS", "kind": "small non-sensitive I/O fixture only", "sourceBytes": total, "fileCount": len(checks), "copyAndHashSeconds": copy_seconds, "zipSeconds": zip_seconds, "zipBytes": archive.stat().st_size, "zipReadbackSeconds": verify_seconds, "destination": str(destination), "checks": checks, "limits": "Not an image benchmark, cold-disk read test, ACL/ADS/app-consistency check, or bare-metal restore test. No throughput extrapolation to a whole-disk backup. Existing files were not overwritten or deleted."}
    report = pathlib.Path(args.report)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in record.items() if k != "checks"}, indent=2))


if __name__ == "__main__":
    main()
