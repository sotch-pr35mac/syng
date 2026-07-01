# Releasing Syng

## Version Locations

Update these together for every release:

1. `package.json` - `version`
2. `src/native/Cargo.toml` - `[package] version`
3. `src/native/tauri.conf.json` - `version`
4. `src/native/gen/apple/project.yml` - `CFBundleShortVersionString` and `CFBundleVersion`
   (iOS, manual). If `gen/apple/` is regenerated with `cargo tauri ios init`, re-apply this
   version.

Android `versionName` / `versionCode` are derived from `tauri.conf.json` through the generated
`tauri.properties`; do not edit `gen/android/app/build.gradle.kts` for release versions.

## Steps

1. Update `CHANGELOG.md`: set the release date and summarize user-facing changes.
2. Bump every version location above to the same value.
3. Build and publish the release artifacts through the current release targets/process.
4. Create the GitHub release and upload artifacts.
5. Update `latest-release.json` to the published desktop version and updater artifact URLs.
