install:
	git submodule update --init
	npm install

install-dev:
	git submodule update --init
	npm install --include=dev

IOS_APP_BUNDLE ?= src/native/gen/apple/build/syng_iOS.xcarchive/Products/Applications/Syng.app
IOS_BUNDLE_ID ?= xyz.bytecraft.syng
IOS_DEVICE ?=
IOS_OFFLINE_CONFIG ?= tauri.ios.offline.conf.json
ANDROID_JAVA_HOME ?= /Applications/Android Studio.app/Contents/jbr/Contents/Home
ANDROID_KEYSTORE_PROPERTIES := src/native/gen/android/keystore.properties
ANDROID_AAB := src/native/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab
TAURI_CLI_VERSION := 2.9.6

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
	npm run bundle:check

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

# Mac App Store build: excludes the self-updater via the `mas` feature + config overlay.
package-mas:
	rustup target add aarch64-apple-darwin
	rustup target add x86_64-apple-darwin
	cargo tauri build --features mas --config tauri.mas.conf.json --target aarch64-apple-darwin
	cargo tauri build --features mas --config tauri.mas.conf.json --target x86_64-apple-darwin

package-ios:
	@echo "iOS packaging not currently implemented"

release-android:
	@if [ "$$(uname -s)" != "Darwin" ]; then \
		printf 'release-android is a local macOS release target.\n'; \
		exit 1; \
	fi
	@if [ ! -d "$(ANDROID_JAVA_HOME)" ]; then \
		printf 'Android JDK not found at %s. Install Android Studio or set ANDROID_JAVA_HOME.\n' "$(ANDROID_JAVA_HOME)"; \
		exit 1; \
	fi
	@if [ ! -f "$(ANDROID_KEYSTORE_PROPERTIES)" ]; then \
		printf 'Android signing credentials are missing: %s\nSee RELEASING.md for upload-key setup.\n' "$(ANDROID_KEYSTORE_PROPERTIES)"; \
		exit 1; \
	fi
	@actual_version="$$(cargo tauri --version 2>/dev/null | awk '{print $$2}')"; \
	if [ "$$actual_version" != "$(TAURI_CLI_VERSION)" ]; then \
		printf 'Tauri CLI %s is required (found %s). Install it with: cargo install tauri-cli --version %s --locked\n' "$(TAURI_CLI_VERSION)" "$${actual_version:-not installed}" "$(TAURI_CLI_VERSION)"; \
		exit 1; \
	fi
	npm run build
	cd src/native && JAVA_HOME="$(ANDROID_JAVA_HOME)" cargo tauri android build --config tauri.mobile.conf.json --aab true --apk false --target aarch64 armv7 i686 x86_64
	@if [ ! -f "$(ANDROID_AAB)" ]; then \
		printf 'Expected Android App Bundle was not created: %s\n' "$(ANDROID_AAB)"; \
		exit 1; \
	fi
	@verification_output="$$("$(ANDROID_JAVA_HOME)/bin/jarsigner" -verify "$(ANDROID_AAB)" 2>&1)"; \
	printf '%s\n' "$$verification_output"; \
	printf '%s\n' "$$verification_output" | grep -q '^jar verified\.' || { \
		printf 'AAB signature verification failed: %s\n' "$(ANDROID_AAB)"; \
		exit 1; \
	}
	@printf 'Signed Android App Bundle: %s\n' "$(ANDROID_AAB)"
