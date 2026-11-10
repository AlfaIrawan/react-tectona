#!/usr/bin/env python3
"""Repair the OnlyOffice location in an active Nginx site; no frontend deployment."""

import argparse
from collections import Counter
from dataclasses import dataclass, field
import glob
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid


@dataclass
class Node:
    words: list
    start: int
    end: int
    close: int = 0
    children: list = field(default_factory=list)


def tokens(source):
    """Keep offsets, ignoring comments and punctuation inside quotes or regex words."""
    i = 0
    while i < len(source):
        if source[i].isspace():
            i += 1
            continue
        if source[i] == '#':
            end = source.find('\n', i)
            i = len(source) if end < 0 else end + 1
            continue
        start = i
        if source[i] in '{};':
            i += 1
            yield source[start:i], start, i, True
            continue
        value = ''
        quote = None
        while i < len(source):
            ch = source[i]
            if ch == '\\' and i + 1 < len(source):
                value += source[i:i + 2]
                i += 2
                continue
            if quote:
                if ch == quote:
                    quote = None
                else:
                    value += ch
                i += 1
                continue
            if ch in "\"'":
                quote = ch
                i += 1
                continue
            if ch.isspace() or ch in ';#':
                break
            value += ch
            i += 1
        if quote:
            raise ValueError('Unterminated quoted Nginx value; no changes made.')
        yield value, start, i, False


def parse(source):
    stream = list(tokens(source))

    def block(index, nested=False):
        result = []
        while index < len(stream):
            if stream[index][3] and stream[index][0] == '}':
                if not nested:
                    raise ValueError('Unexpected closing brace.')
                return result, index + 1, stream[index][1]
            start = stream[index][1]
            words = []
            while index < len(stream) and not (stream[index][3] and stream[index][0] in ('{', '}', ';')):
                words.append(stream[index][0])
                index += 1
            if not words or index == len(stream) or stream[index][0] == '}':
                raise ValueError('Unsupported Nginx syntax; no changes made.')
            if stream[index][0] == ';':
                result.append(Node(words, start, stream[index][2]))
                index += 1
            else:
                children, index, close = block(index + 1, True)
                result.append(Node(words, start, stream[index - 1][2], close, children))
        if nested:
            raise ValueError('Unclosed Nginx block.')
        return result, index, len(source)

    return block(0)[0]


def server_blocks(nodes, host):
    result = []
    for node in nodes:
        if node.words == ['server'] and any(
            child.words[0] == 'server_name' and host in child.words[1:] for child in node.children
        ):
            result.append(node)
        result.extend(server_blocks(node.children, host))
    return result


def is_tls(server):
    return any(child.words[0] == 'listen' and 'ssl' in child.words for child in server.children)


def location(port):
    return f'''location ^~ /onlyoffice-ds/ {{
    proxy_pass http://127.0.0.1:{port}/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host/onlyoffice-ds;
    proxy_hide_header X-Frame-Options;
    add_header X-Frame-Options "SAMEORIGIN" always;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    client_max_body_size 200m;
}}'''


def is_onlyoffice_location(node):
    if not node.words or node.words[0] != 'location' or len(node.words) < 2:
        return False
    args = node.words[1:]
    if args[0] in ('~', '~*', '=') or args[0].startswith(('~', '=')):
        # Regex and exact-match locations may coexist with the prefix location.
        return False
    value = args[1] if args[0] == '^~' and len(args) > 1 else (args[0][2:] if args[0].startswith('^~') else args[0])
    return value == '/onlyoffice-ds/'


def replace_location(source, old, port):
    indent = source[source.rfind('\n', 0, old.start) + 1:old.start]
    if indent.strip():
        indent = ''
    replacement = location(port).replace('\n', '\n' + indent)
    return source[:old.start] + replacement + source[old.end:]


def patch(source, server, port):
    locations = [child for child in server.children if is_onlyoffice_location(child)]
    if len(locations) > 1:
        raise ValueError('Multiple OnlyOffice locations found; refusing an ambiguous edit.')
    replacement = location(port)
    if locations:
        return replace_location(source, locations[0], port)
    replacement = '\n'.join('    ' + line for line in replacement.splitlines())
    return source[:server.close] + '\n' + replacement + '\n' + source[server.close:]


def included_paths(node, sources, prefix):
    if len(node.words) != 2:
        raise ValueError('Unsupported include directive; no changes made.')
    pattern = Path(node.words[1])
    if not pattern.is_absolute():
        pattern = prefix / pattern
    matches = sorted(glob.glob(str(pattern)))
    if not matches and not glob.has_magic(str(pattern)):
        raise ValueError('An include could not be resolved; no changes made.')
    result = []
    for match in matches:
        path = Path(match).resolve(strict=True)
        if path not in sources:
            raise ValueError(f'Include {path} was not present in nginx -T; no changes made.')
        result.append(path)
    return result


def effective_children(nodes, path, sources, prefix, chain=()):
    if path in chain:
        raise ValueError('Cyclic Nginx include; no changes made.')
    for node in nodes:
        if node.words[0] == 'include':
            for included in included_paths(node, sources, prefix):
                yield from effective_children(parse(sources[included]), included, sources, prefix, chain + (path,))
        else:
            yield path, node


def include_usage(root, sources, prefix):
    counts = Counter({root: 1})
    def visit(nodes, path, chain):
        if path in chain:
            raise ValueError('Cyclic Nginx include; no changes made.')
        for node in nodes:
            if node.words[0] == 'include':
                for included in included_paths(node, sources, prefix):
                    counts[included] += 1
                    visit(parse(sources[included]), included, chain + (path,))
            else:
                visit(node.children, path, chain)
    visit(parse(sources[root]), root, ())
    return counts


def plan_update(site, server, sources, root, port, allow_insert=False):
    """Find the existing effective prefix location before ever inserting another one."""
    prefix = root.parent
    locations = [(path, node) for path, node in effective_children(server.children, site, sources, prefix)
                 if is_onlyoffice_location(node)]
    if len(locations) > 1:
        raise ValueError('Multiple effective OnlyOffice prefix locations found; no changes made.')
    usage = include_usage(root, sources, prefix)
    if locations:
        target, old = locations[0]
        if usage[target] != 1:
            raise ValueError(f'OnlyOffice location is in shared file {target} ({usage[target]} uses). Refusing to change other virtual hosts; no changes made.')
        print(f'Existing OnlyOffice location: {target}:{sources[target].count(chr(10), 0, old.start) + 1}', flush=True)
        return target, sources[target], replace_location(sources[target], old, port)
    if usage[site] != 1:
        raise ValueError('The selected site is included more than once; no changes made.')
    if not allow_insert:
        raise ValueError('No existing OnlyOffice prefix location was found. Refusing to insert a potentially duplicate location. Inspect the configuration before using --allow-insert; no changes made.')
    print('No existing OnlyOffice prefix location found after resolving includes.', flush=True)
    return site, sources[site], patch(sources[site], server, port)


def atomic_write(target, contents):
    stat = target.stat()
    fd, name = tempfile.mkstemp(prefix='.' + target.name + '-', dir=str(target.parent))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as out:
            out.write(contents)
            out.flush()
            os.fsync(out.fileno())
        os.chmod(name, stat.st_mode & 0o7777)
        os.chown(name, stat.st_uid, stat.st_gid)
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def run(command):
    subprocess.run(command, check=True)


def apply_update(target, original, updated, nginx, backup_dir):
    if target.read_text(encoding='utf-8') != original:
        raise RuntimeError('Site file changed during the checks. Run again; no changes made.')
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup_dir.chmod(0o700)
    backup = backup_dir / (target.name + '.' + time.strftime('%Y%m%d-%H%M%S') + '.' + uuid.uuid4().hex[:8] + '.bak')
    shutil.copy2(target, backup)
    print(f'Backup: {backup}', flush=True)
    try:
        atomic_write(target, updated)
        run([nginx, '-t'])
        run(['systemctl', 'reload', 'nginx'])
    except BaseException:
        print('Validation/reload failed. Restoring the previous configuration.', file=sys.stderr)
        atomic_write(target, original)
        run([nginx, '-t'])
        run(['systemctl', 'reload', 'nginx'])
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', action='version', version='fix_onlyoffice_nginx 2.0')
    parser.add_argument('--host', default='tectona-dev.adira.co.id')
    parser.add_argument('--site', help='Optional active site file when auto-detection is ambiguous.')
    parser.add_argument('--port', type=int, default=8085, help='Local OnlyOffice port (default: 8085).')
    parser.add_argument('--allow-insert', action='store_true', help='Explicitly allow inserting a new location when none exists (off by default).')
    parser.add_argument('--dry-run', action='store_true', help='Check and report only; do not write or reload.')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9.-]+', args.host) or not 1 <= args.port <= 65535:
        parser.error('Invalid host or port.')
    if not hasattr(os, 'geteuid') or os.geteuid() != 0:
        raise RuntimeError('Run on the Linux Nginx server using sudo python3.')
    import fcntl
    lock = open('/run/lock/tectona-onlyoffice-nginx.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    nginx = shutil.which('nginx')
    if not nginx:
        raise RuntimeError('nginx is not installed or is not on PATH.')
    if not shutil.which('systemctl'):
        raise RuntimeError('This script requires a systemd-managed nginx service.')
    run([nginx, '-t'])
    run(['systemctl', 'is-active', '--quiet', 'nginx'])
    # No proxy environment variables: this must reach the local Document Server.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(f'http://127.0.0.1:{args.port}/web-apps/apps/api/documents/api.js', timeout=15) as response:
        body = response.read(4 * 1024 * 1024).decode('utf-8', errors='replace')
        if response.status != 200 or body.lstrip().startswith('<') or 'DocsAPI' not in body:
            raise RuntimeError('The local port is not serving OnlyOffice api.js. No changes made.')
    dump = subprocess.run([nginx, '-T'], capture_output=True, text=True, check=True)
    filenames = re.findall(r'^# configuration file (/.+):$', dump.stdout, re.M)
    if not filenames:
        raise RuntimeError('nginx -T returned no configuration file index; no changes made.')
    root = Path(filenames[0]).resolve(strict=True)
    paths = set(Path(name).resolve(strict=True) for name in filenames)
    sources = {path: path.read_text(encoding='utf-8') for path in paths}
    if args.site:
        requested = Path(args.site).resolve(strict=True)
        if requested not in paths:
            raise RuntimeError('--site is not an active file in nginx -T. No changes made.')
        paths = {requested}
    candidates = []
    for path in sorted(paths):
        source = sources[path]
        for server in server_blocks(parse(source), args.host.lower()):
            candidates.append((path, source, server))
    tls = [candidate for candidate in candidates if is_tls(candidate[2])]
    candidates = tls or candidates
    if len(candidates) != 1:
        raise RuntimeError(f'Found {len(candidates)} matching server blocks. Use --site to select an active site file; no changes made.')
    site, _, server = candidates[0]
    print('Script version: 2.0', flush=True)
    print(f'Site: {site}', flush=True)
    target, original, updated = plan_update(site, server, sources, root, args.port, args.allow_insert)
    print(f'File to update: {target}', flush=True)
    if args.dry_run:
        print('DRY RUN: Include-aware edit plan checked. No files changed or reload performed. nginx -t will validate the edited configuration during apply.')
        return
    if updated == original:
        print('OnlyOffice location already matches. No changes or reload needed.')
        return
    apply_update(target, original, updated, nginx, Path('/var/backups/tectona-nginx'))
    print('SUCCESS: OnlyOffice proxy updated; nginx configuration validated and reloaded.')
    print('Frontend code is not deployed by this script. Reopen the document editor after deployment.')
    print("Verify: curl -I 'https://" + args.host + "/onlyoffice-ds/web-apps/apps/documenteditor/main/index.html'")
    print('Expected: HTTP 200 and X-Frame-Options SAMEORIGIN, with no frame-ancestors none policy.')


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
