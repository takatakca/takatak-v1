"""Check tar paths/links before extracting a CI artifact; never extract here."""
import posixpath
import sys
import tarfile


def validate_members(members):
    names = [member.name.rstrip("/") for member in members]
    if len(names) != len(set(names)):
        raise ValueError("Archive entries must not overwrite an earlier path")
    links = {member.name.rstrip("/") for member in members if member.issym() or member.islnk()}
    for member in members:
        name = member.name.rstrip("/")
        if name.startswith("/") or ".." in name.split("/") or name not in ("app", "build-metadata.json") and not name.startswith("app/"):
            raise ValueError("Archive entry escapes the application artifact")
        if member.isdev() or member.isfifo():
            raise ValueError("Archive must not contain devices or pipes")
        parts = name.split("/")
        if any("/".join(parts[:index]) in links for index in range(1, len(parts))):
            raise ValueError("Archive entry traverses another archive link")
        if member.issym() or member.islnk():
            target = member.linkname
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target)) if member.issym() else posixpath.normpath(target)
            if target.startswith("/") or resolved != "app" and not resolved.startswith("app/"):
                raise ValueError("Archive link escapes the application artifact")
            # Check the uncollapsed target: resolving '..' after a symlink differs
            # from lexical normpath, so chained links are not accepted.
            cursor = posixpath.dirname(name).split("/") if member.issym() else []
            for part in target.split("/"):
                if part in ("", "."):
                    continue
                if part == "..":
                    cursor.pop()
                else:
                    cursor.append(part)
                if "/".join(cursor) in links:
                    raise ValueError("Archive link target traverses another archive link")


if __name__ == "__main__":
    with tarfile.open(sys.argv[1], "r:gz") as archive:
        validate_members(archive.getmembers())
    print("Archive paths and links are confined to the application artifact.")
