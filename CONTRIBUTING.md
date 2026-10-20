## Adding a Feature
1. Fork it!
2. Create a branch `git checkout -b my-feature`
3. Commit your changes `git commit`
4. Submit a pull request

## Reporting an Issue or Enhancement
Please be as detailed as possible. Provide errors and/or logs where possible. When including enhancements, describe them as clearly as possible and provide links to similar features elsewhere (if possible). Be sure to include the version of Syng you are using, your operating system and architecture, and any other information about your system that may be relevant.

## Documentation / Code Clarity
Please document your code as clearly as possible. For variables, use clear and understandable variable names.

## Release Notes

For each release, add its version, date, platform restrictions (if any), and an explicit
`announce` choice to `RELEASES` in `src/views/templates/utils/whatsNew.ts`. Use `announce: true`
for releases that should open What's New after updating. Maintenance releases can use
`false`; their notes remain accessible from Settings and are included in cumulative updates.

Add matching content in `src/views/templates/components/WhatsNew/whatsNewContent.ts`.
Keep the introduction short, describe user-visible benefits, and reuse existing SyComponents
for optional live settings. Notes use a standalone, onboarding-style page with compact,
icon-led highlights and a persistent Continue action. Keep the collapsed view short;
additional changes and earlier releases expand within the scrolling body. The 2.6.0 notes
include Increase Contrast as their only live feature control. Future highlight actions can
open a particular Settings section or control. Filter platform-specific changes, and retain
earlier entries for users who skip versions. The first recorded release is 2.6.0; do not
invent earlier upgrade history.

Use **Settings → General → Developer → What's New testing** to preview notes or simulate
an update from an older version. Preview preserves release history; live controls still
save their settings. Simulation changes only release history and reloads the app.
Verify fresh-install suppression, cumulative notes, and both desktop and mobile layouts
before release. Keep the changelog in sync with the release notes.
