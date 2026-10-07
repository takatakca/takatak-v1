import importlib.util
import sys
from pathlib import Path
import tarfile
import unittest

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location("archive_policy", Path(__file__).with_name("validate-production-archive.py"))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class ArchivePolicyTests(unittest.TestCase):
    def member(self, name, target=None):
        member = tarfile.TarInfo(name)
        if target is not None:
            member.type = tarfile.SYMTYPE
            member.linkname = target
        return member

    def test_node_bin_links_remain_inside_app(self):
        policy.validate_members([self.member("app/node_modules/.bin/tsx", "../tsx/dist/cli.mjs"), self.member("build-metadata.json")])

    def test_absolute_traversal_and_symlink_escape_are_rejected(self):
        for member in [self.member("/etc/passwd"), self.member("app/../../other"), self.member("app/node_modules/link", "../../../outside")]:
            with self.assertRaises(ValueError):
                policy.validate_members([member])


if __name__ == "__main__":
    unittest.main()
