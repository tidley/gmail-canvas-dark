"""Storage guard regressions, run by the Node qualification suite; write nothing."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('package', Path(__file__).resolve().parents[1] / 'scripts/package.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class StorageTests(unittest.TestCase):
    def check_storage(self, configured, exists, mounted, destination, rejected):
        with patch.object(Path, 'is_file', return_value=configured), \
                patch.object(Path, 'exists', return_value=exists), \
                patch.object(package.os.path, 'ismount', return_value=mounted):
            if rejected:
                with self.assertRaisesRegex(ValueError, 'configured build mount required'):
                    package.validate_storage(Path(destination))
            else:
                package.validate_storage(Path(destination))

    def test_configured_missing_mount_rejects_system_output(self):
        self.check_storage(True, False, False, '/tmp/output', True)

    def test_configured_unmounted_directory_rejected(self):
        self.check_storage(True, True, False, '/mnt/fastbuild/output', True)

    def test_configured_mounted_system_output_rejected(self):
        self.check_storage(True, True, True, '/tmp/output', True)

    def test_configured_mounted_output_accepted(self):
        self.check_storage(True, True, True, '/mnt/fastbuild/output', False)

    def test_existing_mount_still_requires_storage_guard_without_marker(self):
        self.check_storage(False, True, False, '/tmp/output', True)

    def test_unconfigured_environment_accepts_normal_output(self):
        self.check_storage(False, False, False, '/tmp/output', False)


if __name__ == '__main__':
    unittest.main()
