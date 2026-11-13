#!/usr/bin/env python3
"""Explicit allowlist, deterministic unsigned XPI; no dependencies or build step."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'LICENSE', 'NOTICE', 'content/theme.css', 'content/theme.js',
    'icons/icon-48.png', 'icons/icon-96.png', 'manifest.json',
)


def validate():
    source = ROOT / 'extension'
    actual = set()
    for path in source.rglob('*'):
        if path.is_symlink():
            raise ValueError(f'symlink forbidden: {path}')
        if path.is_file():
            actual.add(path.relative_to(source).as_posix())
    if actual != set(FILES):
        raise ValueError(f'extension allowlist mismatch: {actual ^ set(FILES)}')
    m = json.loads((source / 'manifest.json').read_text())
    if set(m) != {'manifest_version', 'name', 'version', 'description', 'icons',
                  'content_scripts', 'browser_specific_settings'}:
        raise ValueError('unexpected manifest fields / permissions')
    assert m['manifest_version'] == 3
    assert m['name'] == 'Gmail Canvas Dark — Unofficial Audit'
    assert m['version'] == '1.0.6'
    assert m['icons'] == {'48': 'icons/icon-48.png', '96': 'icons/icon-96.png'}
    assert m['content_scripts'] == [
        {'matches': ['https://mail.google.com/*'], 'css': ['content/theme.css'],
         'run_at': 'document_start', 'all_frames': True},
        {'matches': ['https://mail.google.com/*'], 'js': ['content/theme.js'],
         'run_at': 'document_idle', 'all_frames': True},
    ]
    assert m['browser_specific_settings'] == {'gecko': {
        'id': 'gmail-canvas-dark-audit@tidley.invalid', 'strict_min_version': '140.0',
        'data_collection_permissions': {'required': ['none']},
    }}
    return source


def archive():
    source = validate()
    result = io.BytesIO()
    with zipfile.ZipFile(result, 'w', compression=zipfile.ZIP_STORED) as z:
        for name in FILES:
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_STORED
            z.writestr(entry, (source / name).read_bytes())
    return result.getvalue()


def validate_storage(dest):
    # The machine-local rules identify this environment even if the required
    # mount disappears. Mount existence alone must not enable a silent fallback.
    configured = Path('/home/tom/.config/opencode/AGENTS.md').is_file()
    mount = Path('/mnt/fastbuild')
    if (configured or mount.exists()) and (not os.path.ismount(mount) or not dest.is_relative_to(mount)):
        raise ValueError('configured build mount required; use the central storage adapter')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='validate twice in memory; write nothing')
    parser.add_argument('--output-dir', type=Path, help='output directory supplied by approved storage adapter')
    args = parser.parse_args()
    data = archive()
    if data != archive():
        raise ValueError('non-reproducible archive bytes')
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.namelist() == list(FILES)
        assert z.testzip() is None
        for name in FILES:
            assert z.read(name) == (ROOT / 'extension' / name).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if args.check:
        if args.output_dir:
            parser.error('--check never writes artifacts; omit --output-dir')
        print(f'allowlist/manifest/reproducibility OK; in-memory unsigned XPI SHA-256 {digest}')
        return
    if not args.output_dir:
        parser.error('pass --output-dir from the approved build-storage adapter; no automatic fallback')
    dest = args.output_dir.resolve(strict=True)
    if not dest.is_dir():
        parser.error('output directory must already exist')
    try:
        validate_storage(dest)
    except ValueError as error:
        parser.error(str(error))
    output = dest / 'gmail-canvas-dark-audit-1.0.6-unsigned.xpi'
    # Do not replace another candidate accidentally.
    if output.exists():
        if output.read_bytes() != data:
            parser.error('existing artifact differs; obtain a new adapter output directory')
    else:
        with output.open('xb') as f:
            f.write(data)
    if output.read_bytes() != data:
        raise ValueError('artifact read-back mismatch')
    print(f'unsigned XPI: {output}\nSHA-256: {digest}')


if __name__ == '__main__':
    main()
