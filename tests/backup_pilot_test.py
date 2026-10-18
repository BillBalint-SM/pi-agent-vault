import contextlib
import hashlib
import importlib.util
import io
import pathlib
import stat
import sys
import tempfile
import types
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('backup_io_pilot', ROOT / 'scripts' / 'backup-io-pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class BackupPilotTests(unittest.TestCase):
    def test_hash_stream(self):
        self.assertEqual(pilot.digest(io.BytesIO(b'fixture')), hashlib.sha256(b'fixture').hexdigest())

    def test_regular_file_and_directory_rejection(self):
        with tempfile.TemporaryDirectory(prefix='pi-backup-test-') as directory:
            root = pathlib.Path(directory)
            file = root / 'source.txt'
            file.write_bytes(b'fixture')
            self.assertEqual(pilot.safe_file(file), 7)
            with self.assertRaises(ValueError):
                pilot.safe_file(root)
            with mock.patch.object(pilot, 'LIMIT', 4), self.assertRaises(ValueError):
                pilot.safe_file(file)

    def test_offline_attribute_is_rejected_without_opening_data(self):
        info = types.SimpleNamespace(st_mode=stat.S_IFREG, st_size=1, st_file_attributes=0x1000)
        with mock.patch.object(pathlib.Path, 'lstat', return_value=info), self.assertRaisesRegex(ValueError, 'offline'):
            pilot.safe_file(pathlib.Path('offline-fixture'))

    def test_copy_zip_and_hash_preserve_existing_destination_files(self):
        with tempfile.TemporaryDirectory(prefix='pi-backup-test-') as directory:
            root = pathlib.Path(directory)
            source = root / 'source'
            source.mkdir()
            (source / 'README.md').write_bytes(b'Non-sensitive fixture\n')
            destination = root / 'destination'
            destination.mkdir()
            sentinel = destination / 'keep.txt'
            sentinel.write_bytes(b'KEEP')
            report = root / 'report.json'
            args = ['pilot', '--destination-parent', str(destination), '--report', str(report)]
            with mock.patch.object(pilot, '__file__', str(source / 'scripts' / 'pilot.py')), mock.patch.object(pilot.subprocess, 'check_output', return_value=b'README.md\0'), mock.patch.object(sys, 'argv', args), contextlib.redirect_stdout(io.StringIO()):
                pilot.main()
            import json
            actual = json.loads(report.read_text(encoding='utf-8'))
            self.assertEqual(actual['status'], 'PASS')
            self.assertEqual(actual['fileCount'], 1)
            self.assertEqual(sentinel.read_bytes(), b'KEEP')
            self.assertEqual((source / 'README.md').read_bytes(), b'Non-sensitive fixture\n')

    def test_private_source_is_rejected_before_destination_write(self):
        with tempfile.TemporaryDirectory(prefix='pi-backup-test-') as directory:
            root = pathlib.Path(directory)
            source = root / 'source'
            (source / '.local').mkdir(parents=True)
            (source / '.local' / 'private.txt').write_bytes(b'PRIVATE-FIXTURE')
            destination = root / 'destination'
            destination.mkdir()
            args = ['pilot', '--destination-parent', str(destination), '--report', str(root / 'report.json')]
            with mock.patch.object(pilot, '__file__', str(source / 'scripts' / 'pilot.py')), mock.patch.object(pilot.subprocess, 'check_output', return_value=b'.local/private.txt\0'), mock.patch.object(sys, 'argv', args), self.assertRaises(ValueError):
                pilot.main()
            self.assertEqual(list(destination.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
