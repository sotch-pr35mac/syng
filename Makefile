install:
	git submodule update --init
	npm install

install-dev:
	git submodule update --init
	npm install --include=dev

build:
	npm run build

build-ci:
	cd src/native && cargo build
	npm run build

start:
	npm run build
	cargo tauri dev

lint:
	cd src/native && cargo fmt --check
	npm run lint

fix-lint:
	cd src/native && cargo fmt
	npm run fix-lint

test:
	cd src/native && cargo test
	npm test
	
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
	chmod +x /Users/runner/work/syng/syng/src/native/target/x86_64-apple-darwin/release/bundle/macos/Syng.app/Contents/MacOS/Syng
	chmod +x /Users/runner/work/syng/syng/src/native/target/aarch64-apple-darwin/release/bundle/macos/Syng.app/Contents/MacOS/Syng

package-linux:
	rustup target add x86_64-unknown-linux-gnu
	rustup target add i686-unknown-linux-gnu
	rustup target add aarch64-unknown-linux-gnu
	cargo tauri build --target x86_64-unknown-linux-gnu
	cargo tauri build --target i686-unknown-linux-gnu
	cargo tauri build --target aarch64-unknown-linux-gnu
