# Changelog

## 0.2.0

Paths in `exclude` are now banned outright, not only skipped while walking. A plain path such as `~/old-laptop` or `/Volumes/Backup` bans that directory and everything below it, on a path boundary, and globs still work. Discovery never enters them and drops entries it had added under them; entries you wrote notes, commands, holds, or skip into are kept but ignored. `start` leaves them out of the scope and lists them as excluded, `plan` refuses them, and `status` shows the patterns and the ignored entries.

## 0.1.0

Keep every repository on this machine up to date safely. Discovers git repositories and their npm projects, Node.js versions, Dockerfiles, GitHub Actions, Python pins, and Xcode SwiftPM and CocoaPods dependencies; picks the newest release that is at least 7 days old and never lower than what is installed; reviews npm upgrades by diffing the published tarballs for install scripts, binaries, obfuscation, secret access, publisher and provenance changes, and license changes; migrates breaking changes; verifies with each repository's checks; pins Actions by commit SHA and Docker images by digest; and keeps settings, holds, notes, a write-ahead log, and per-repository logs in ~/dependencies.
