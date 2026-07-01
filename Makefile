install:
	git submodule update --init
	npm install

install-dev:
	git submodule update --init
	npm install --include=dev

IOS_APP_BUNDLE ?= src/native/gen/apple/build/syng_iOS.xcarchive/Products/Applications/Syng.app
IOS_BUNDLE_ID ?= org.syng.app
IOS_DEVICE ?=
IOS_OFFLINE_CONFIG ?= tauri.ios.offline.conf.json

build:
	npm run build

build-ci:
	cd src/native && cargo build
	npm run build

start:
	npm run build
	cargo tauri dev

start-ios:
	npm run build
	cd src/native && cargo tauri ios dev --config tauri.mobile.conf.json

run-ios-device:
	npm run build
	cd src/native && cargo tauri ios build --config tauri.mobile.conf.json --config $(IOS_OFFLINE_CONFIG) --export-method debugging
	@device="$(IOS_DEVICE)"; \
	if [ -z "$$device" ]; then \
		device="$$(xcrun devicectl list devices --filter "connectionProperties.tunnelState != 'unavailable' AND hardwareProperties.reality == 'physical' AND hardwareProperties.platform == 'iOS'" --hide-default-columns --hide-headers --columns identifier | head -n 1)"; \
	fi; \
	if [ -z "$$device" ]; then \
		printf 'No connected iOS device found. Connect a paired iPhone/iPad or run make run-ios-device IOS_DEVICE=<device-id-or-name>\n'; \
		exit 1; \
	fi; \
	xcrun devicectl device install app --device "$$device" "$(IOS_APP_BUNDLE)" && \
	xcrun devicectl device process launch --device "$$device" --terminate-existing "$(IOS_BUNDLE_ID)"

start-android:
	npm run build
	cd src/native && cargo tauri android dev --config tauri.mobile.conf.json

check:
	cd src/native && cargo fmt --check
	cd src/native && cargo clippy
	npm run format:check
	npm run lint
	npm run typecheck

fix-lint:
	cd src/native && cargo fmt
	npm run format
	npm run fix-lint

test:
	cd src/native && cargo test
	npm test

audit:
	cd src/native && cargo audit
	npm audit

icon:
	cargo tauri icon assets/icon.png

package-windows:
	rustup target add i686-pc-windows-msvc
	rustup target add x86_64-pc-windows-msvc
	cargo tauri build --target i686-pc-windows-msvc
	cargo tauri build --target x86_64-pc-windows-msvc

package-macos:
	rustup target add aarch64-apple-darwin
	rustup target add x86_64-apple-darwin
	cargo tauri build --target aarch64-apple-darwin
	cargo tauri build --target x86_64-apple-darwin

package-linux-arm64:
	rustup target add aarch64-unknown-linux-gnu
	cargo tauri build --target aarch64-unknown-linux-gnu

package-linux-amd64:
	rustup target add x86_64-unknown-linux-gnu
	cargo tauri build --target x86_64-unknown-linux-gnu

# --- Release targets -------------------------------------------------------
# Build release binaries per channel. Distribution-channel submission (code
# signing, provisioning, store upload) is deferred — see RELEASING.md.

release-desktop: release-macos release-windows release-linux

release-macos: package-macos

release-windows: package-windows

release-linux: package-linux-amd64 package-linux-arm64

# Mac App Store build: excludes the self-updater via the `mas` feature + config overlay.
release-mas:
	rustup target add aarch64-apple-darwin
	rustup target add x86_64-apple-darwin
	cd src/native && cargo tauri build --features mas --config tauri.mas.conf.json --target aarch64-apple-darwin
	cd src/native && cargo tauri build --features mas --config tauri.mas.conf.json --target x86_64-apple-darwin

# iOS App Store export — deferred: needs an Apple distribution cert, provisioning
# profile, and an app-store-connect ExportOptions. See RELEASING.md.
release-ios:
	@echo "iOS App Store submission is deferred — see RELEASING.md (needs Apple Developer signing)."; exit 1

# Android Play release bundle — deferred: needs a signing keystore + signingConfig. See RELEASING.md.
release-android:
	@echo "Android Play submission is deferred — see RELEASING.md (needs signing config)."; exit 1
