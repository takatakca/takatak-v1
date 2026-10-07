"""Check tar paths/links before extracting a CI artifact; never extract here."""
import posixpath
import sys
import tarfile


def validate_members(members):
    for member in members:
        name = member.name.rstrip("/")
        if name.startswith("/") or ".." in name.split("/") or name not in ("app", "build-metadata.json") and not name.startswith("app/"):
            raise ValueError("Archive entry escapes the application artifact")
        if member.isdev() or member.isfifo():
            raise ValueError("Archive must not contain devices or pipes")
        if member.issym() or member.islnk():
            target = member.linkname
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target)) if member.issym() else posixpath.normpath(target)
            if target.startswith("/") or resolved != "app" and not resolved.startswith("app/"):
                raise ValueError("Archive link escapes the application artifact")


if __name__ == "__main__":
    with tarfile.open(sys.argv[1], "r:gz") as archive:
        validate_members(archive.getmembers())
    print("Archive paths and links are confined to the application artifact.")
