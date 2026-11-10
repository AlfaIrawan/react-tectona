import unittest
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch as mock_patch

from fix_onlyoffice_nginx import parse, patch, server_blocks, is_tls, apply_update, plan_update


class NginxPatchTests(unittest.TestCase):
    def server(self, source):
        matches = server_blocks(parse(source), 'tectona-dev.adira.co.id')
        self.assertEqual(len(matches), 1)
        return matches[0]

    def test_existing_location_is_replaced_idempotently(self):
        source = '''server {
    listen 443 ssl;
    server_name tectona-dev.adira.co.id;
    location ^~ /onlyoffice-ds/ {
        proxy_pass http://127.0.0.1:8085/;
    }
    location / { try_files $uri /index.html; }
}
'''
        result = patch(source, self.server(source), 8085)
        self.assertIn('X-Forwarded-Host $host/onlyoffice-ds', result)
        self.assertIn('X-Frame-Options "SAMEORIGIN"', result)
        self.assertIn('location / { try_files $uri /index.html; }', result)
        self.assertEqual(patch(result, self.server(result), 8085), result)

    def test_insert_does_not_touch_another_host(self):
        unrelated = 'server { server_name other.example; location / { return 200; } }\n'
        source = unrelated + 'server { server_name tectona-dev.adira.co.id; listen 443 ssl; }'
        result = patch(source, self.server(source), 8085)
        self.assertTrue(result.startswith(unrelated))
        self.assertTrue(is_tls(self.server(result)))
        self.assertEqual(result.count('location ^~ /onlyoffice-ds/'), 1)
        self.assertEqual(patch(result, self.server(result), 8085), result)

    def test_comments_quotes_regex_and_variables_do_not_break_boundaries(self):
        source = '''http {
    # server { server_name tectona-dev.adira.co.id; }
    server {
        server_name tectona-dev.adira.co.id;
        set $literal "braces { } and ; # text";
        set $brace "{";
        set $semicolon ";";
        location ~ ^/v[0-9]{1,3}/ { return 200 "${scheme}://ok"; }
    }
}'''
        result = patch(source, self.server(source), 8085)
        self.assertEqual(len(server_blocks(parse(result), 'tectona-dev.adira.co.id')), 1)
        self.assertIn('^/v[0-9]{1,3}/', result)

    def test_duplicate_onlyoffice_locations_are_rejected(self):
        source = 'server { server_name tectona-dev.adira.co.id; location /onlyoffice-ds/ { } location ^~ /onlyoffice-ds/ { } }'
        with self.assertRaises(ValueError):
            patch(source, self.server(source), 8085)

    def test_partial_host_names_are_not_matched(self):
        source = 'server { server_name not-tectona-dev.adira.co.id; }'
        self.assertEqual(server_blocks(parse(source), 'tectona-dev.adira.co.id'), [])

    def test_unclosed_blocks_are_rejected(self):
        with self.assertRaises(ValueError):
            parse('server { server_name tectona-dev.adira.co.id;')

    def test_failed_validation_or_reload_restores_original_and_keeps_backup(self):
        for failed_call in (1, 2):
            with self.subTest(failed_call=failed_call), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / 'site.conf'
                target.write_text('original', encoding='utf-8')
                calls = []
                def run(command):
                    calls.append(command)
                    if len(calls) == failed_call:
                        raise subprocess.CalledProcessError(1, command)
                with mock_patch('fix_onlyoffice_nginx.atomic_write', lambda path, text: path.write_text(text, encoding='utf-8')), mock_patch('fix_onlyoffice_nginx.run', run):
                    with self.assertRaises(subprocess.CalledProcessError):
                        apply_update(target, 'original', 'updated', 'nginx', Path(directory) / 'backups')
                self.assertEqual(target.read_text(), 'original')
                self.assertEqual(len(list((Path(directory) / 'backups').glob('*.bak'))), 1)
                self.assertEqual(calls[-2:], [['nginx', '-t'], ['systemctl', 'reload', 'nginx']])

    def test_concurrent_site_change_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'site.conf'
            target.write_text('changed by admin', encoding='utf-8')
            with self.assertRaises(RuntimeError):
                apply_update(target, 'original', 'updated', 'nginx', Path(directory) / 'backups')
            self.assertEqual(target.read_text(), 'changed by admin')

    def test_compact_modifier_is_replaced_not_duplicated(self):
        source = 'server { server_name tectona-dev.adira.co.id; location ^~/onlyoffice-ds/ { proxy_pass http://127.0.0.1:8085/; } }'
        updated = patch(source, self.server(source), 8085)
        self.assertEqual(updated.count('/onlyoffice-ds/ {'), 1)
        self.assertNotIn('location ^~/onlyoffice-ds/', updated)

    def make_sources(self, directory, shared=False, nested=False):
        root = Path(directory) / 'nginx.conf'
        site = Path(directory) / 'site.conf'
        snippet = Path(directory) / 'onlyoffice.conf'
        middle = Path(directory) / 'middle.conf'
        root.write_text('events { } http { include site.conf; }', encoding='utf-8')
        site.write_text('server { listen 443 ssl; server_name tectona-dev.adira.co.id; include ' + ('middle.conf' if nested else 'onlyoffice.conf') + '; }', encoding='utf-8')
        if shared:
            site.write_text(site.read_text() + '\nserver { server_name other.example; include onlyoffice.conf; }', encoding='utf-8')
        snippet.write_text('location /onlyoffice-ds/ { proxy_pass http://127.0.0.1:8085/; }', encoding='utf-8')
        paths = [root, site, snippet]
        if nested:
            middle.write_text('include onlyoffice.conf;', encoding='utf-8')
            paths.append(middle)
        return root, site, snippet, {path.resolve(): path.read_text(encoding='utf-8') for path in paths}

    def test_included_location_is_updated_in_place(self):
        for nested in (False, True):
            with self.subTest(nested=nested), tempfile.TemporaryDirectory() as directory:
                root, site, snippet, sources = self.make_sources(directory, nested=nested)
                target, original, updated = plan_update(site, self.server(sources[site]), sources, root, 8085)
                self.assertEqual(target, snippet)
                self.assertEqual(original, sources[snippet])
                self.assertEqual(updated.count('location '), 1)
                self.assertIn('X-Forwarded-Host $host/onlyoffice-ds', updated)
                self.assertNotIn('X-Forwarded-Host', site.read_text())

    def test_shared_include_is_not_modified(self):
        with tempfile.TemporaryDirectory() as directory:
            root, site, snippet, sources = self.make_sources(directory, shared=True)
            with self.assertRaisesRegex(ValueError, 'shared file'):
                plan_update(site, self.server(sources[site]), sources, root, 8085)
            self.assertEqual(snippet.read_text(), sources[snippet])

    def test_missing_location_is_not_inserted_without_consent(self):
        with tempfile.TemporaryDirectory() as directory:
            root, site, snippet, sources = self.make_sources(directory)
            snippet.write_text('proxy_read_timeout 60s;', encoding='utf-8')
            sources[snippet] = snippet.read_text()
            with self.assertRaisesRegex(ValueError, 'Refusing to insert'):
                plan_update(site, self.server(sources[site]), sources, root, 8085)

    def test_regex_does_not_replace_a_prefix_location(self):
        source = 'server { server_name tectona-dev.adira.co.id; location ~ /onlyoffice-ds/ { return 200; } location ^~ /onlyoffice-ds/ { proxy_pass http://127.0.0.1:8085/; } }'
        result = patch(source, self.server(source), 8085)
        self.assertIn('location ~ /onlyoffice-ds/ { return 200; }', result)
        self.assertEqual(result.count('location ^~ /onlyoffice-ds/'), 1)


if __name__ == '__main__':
    unittest.main()
