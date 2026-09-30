## Adding a Feature
1. Fork it!
2. Create a branch `git checkout -b my-feature`
3. Commit your changes `git commit`
4. Submit a pull request

## Reporting an Issue or Enhancement
Please be as detailed as possible. Provide errors and/or logs where possible. When including enhancements, describe them as clearly as possible and provide links to similar features elsewhere (if possible). Be sure to include the version of Syng you are using, your operating system and architecture, and any other information about your system that may be relevant.

## Documentation / Code Clarity
Please document your code as clearly as possible. For variables, use clear and understandable variable names.

## Linux package verification

The native runtime and JavaScript API use Tauri 2.12.0, with Tauri CLI 2.12.0
for packaging and `tauri-build` 2.7.0. These were the latest stable releases
checked on September 30, 2026. Keep `TAURI_CLI_VERSION` in the Makefile and the
CLI installation in `.github/workflows/release.yml` synchronized when updating.
Use stable releases and commit both dependency lockfiles. Tauri 2.12 requires
Rust 1.90 or newer.

The runtime update includes the [upstream Wayland titlebar fix](https://github.com/tauri-apps/tao/pull/1218).
The CLI update includes [AppImage display-library and launcher fixes](https://github.com/tauri-apps/tauri/pull/16062).
These are candidate fixes for Syng's Linux issues until the packaged builds pass
the checks below. In particular, an AppImage white screen alone does not identify
its cause or establish that it is specific to ARM64.

### Obtain comparable packages

After the branch is pushed, run the **Release** workflow manually against that
branch. Its `workflow_dispatch` path uploads packages and updater signatures as
Actions artifacts; it does not publish a GitHub release. Download
`Packages-aarch64-unknown-linux-gnu` for ARM64 VMs. Keep the previously failing
packages in a separate directory and record the workflow run and commit for the
new packages. Both Linux architectures retain the Ubuntu 22.04 build baseline.

Install the `.deb` on Ubuntu and the `.rpm` on Fedora, and test the AppImage on
both. Record which exact file was tested, the distribution version, Parallels
version, display scaling, and whether Parallels Tools are installed. Build/test
results on x86 runners do not substitute for interactive package verification.

### Capture the VM environment

Run these commands in each Linux VM. Missing optional diagnostic tools do not
require installing anything before the initial launch test.

```sh
cat /etc/os-release
uname -m
printf 'Session: %s\nDesktop: %s\nGDK backend override: %s\n' \
  "$XDG_SESSION_TYPE" "$XDG_CURRENT_DESKTOP" "${GDK_BACKEND:-unset}"
env | LC_ALL=C sort | grep -E '^(WEBKIT_|LIBGL_|MESA_|GDK_|WAYLAND_DISPLAY=|DISPLAY=)' || true
command -v lspci >/dev/null && lspci -nnk | grep -A 3 -Ei 'vga|3d|display'
command -v glxinfo >/dev/null && glxinfo -B
if command -v dpkg-query >/dev/null; then
  dpkg-query -W 'libwebkit2gtk*' 'libgtk-3*' 'libgl1-mesa-dri' 2>/dev/null
elif command -v rpm >/dev/null; then
  rpm -qa | grep -Ei 'webkit2gtk|^gtk3-|^mesa-'
fi
```

### Check character-window controls

1. Start the installed package normally and open a character window.
2. Before resizing or double-clicking the titlebar, test the native minimize,
   maximize/restore, and close buttons. The character window should hide on close
   while the main window remains usable.
3. Reopen it, choose another word, switch simplified/traditional characters, and
   play stroke order. Repeat opening and closing ten times, checking the native
   controls after reopening.
4. Close the main window with the character window open. Both windows and the
   application process should exit.
5. For an original build with dead titlebar buttons, record whether resizing or
   double-clicking the titlebar makes them respond, and whether Alt+F4 closes the
   character window. These observations help distinguish input handling from the
   application's close handler.

For a backend comparison, first close Syng completely, find its installed command
with `command -v Syng` or `command -v syng`, then run it with
`env GDK_BACKEND=x11 /absolute/path/to/installed/Syng`. This requires X11/XWayland;
record a display-connection failure separately from a titlebar failure. Keep this
override limited to the diagnostic launch.

### Capture AppImage startup and isolate rendering failures

In Bash, replace the example path with the exact original or rebuilt AppImage.
Use a fresh log directory for each package. Close Syng completely between runs;
if a blank window cannot close, stop that terminal launch with Ctrl+C.

```sh
syng_appimage='/absolute/path/to/Syng_aarch64.AppImage'
syng_diagnostics="$(mktemp -d -t syng-diagnostics.XXXXXX)"
file "$syng_appimage"
sha256sum "$syng_appimage"
printf 'Logs: %s\n' "$syng_diagnostics"
"$syng_appimage" 2>&1 | tee "$syng_diagnostics/baseline.log"
```

Confirm that the normal launch renders the app, permits dictionary search, and
opens the character window with functioning native controls. Record any visible
startup text as well as terminal errors. If the window remains white, run each
command below separately, restarting the app between commands. Avoid exporting
these variables into the shell; inherited rendering overrides captured above
must be cleared before comparing individual settings.

```sh
env WEBKIT_DISABLE_DMABUF_RENDERER=1 "$syng_appimage" 2>&1 | tee "$syng_diagnostics/no-dmabuf.log"
env WEBKIT_DISABLE_COMPOSITING_MODE=1 "$syng_appimage" 2>&1 | tee "$syng_diagnostics/no-compositing.log"
env LIBGL_ALWAYS_SOFTWARE=1 "$syng_appimage" 2>&1 | tee "$syng_diagnostics/software-gl.log"
env GDK_BACKEND=x11 "$syng_appimage" 2>&1 | tee "$syng_diagnostics/x11.log"
```

The session type alone does not prove which backend the AppImage used: older
launchers can force X11. If further investigation is needed, extract a copy into
a fresh temporary directory and inspect its launcher and bundled display libraries:

```sh
syng_extracted="$(mktemp -d -t syng-appimage.XXXXXX)"
(cd "$syng_extracted" && "$syng_appimage" --appimage-extract)
grep -RInE 'GDK_BACKEND|LD_LIBRARY_PATH|WEBKIT_|LIBGL_|GST_PLUGIN' \
  "$syng_extracted/squashfs-root/AppRun"* \
  "$syng_extracted/squashfs-root/apprun-hooks" 2>/dev/null
find "$syng_extracted/squashfs-root/usr" -type f \
  \( -name 'libwayland*' -o -name 'libxkbcommon*' -o -name 'libEGL*' \
  -o -name 'libGL*' -o -name '*WebKit*Process*' \) -print
```

Retain the logs and report which individual variation changed the behavior. A
successful diagnostic override is evidence for further investigation, not a
reason to enable it permanently for all Linux users. Verify the rebuilt packages
without overrides on both Ubuntu and Fedora before marking either issue fixed.
Also smoke-test main/character window behavior on macOS and Windows 11 ARM64.
