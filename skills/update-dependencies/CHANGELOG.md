# Changelog

## 0.1.0

Keep every repository on this machine up to date safely. Discovers git repositories and their npm projects, Node.js versions, Dockerfiles, GitHub Actions, Python pins, and Xcode SwiftPM and CocoaPods dependencies; picks the newest release that is at least 7 days old and never lower than what is installed; reviews npm upgrades by diffing the published tarballs for install scripts, binaries, obfuscation, secret access, publisher and provenance changes, and license changes; migrates breaking changes; verifies with each repository's checks; pins Actions by commit SHA and Docker images by digest; and keeps settings, holds, notes, a write-ahead log, and per-repository logs in ~/dependencies.
