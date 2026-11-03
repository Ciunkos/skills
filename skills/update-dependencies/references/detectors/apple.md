# Xcode: SwiftPM and CocoaPods

- SwiftPM pins come from `Package.resolved` (in `*.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/` or next to `Package.swift`). Targets come from the package's GitHub releases. Update the requirement in `Package.swift` or the Xcode project's package settings, then resolve: `swift package update <name>` or `xcodebuild -resolvePackageDependencies`.
- CocoaPods versions come from `Podfile.lock`; targets from CocoaPods trunk. Update with `pod update <name>` after adjusting the `Podfile` requirement if needed.
- Verify with `swift build` / `swift test`, or `xcodebuild -scheme <scheme> build` when a shared scheme exists; record that a build was not possible when no scheme or toolchain is available.
- Packages outside GitHub are listed for review.
