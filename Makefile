install:
	git submodule update --init
	npm install

install-dev:
	git submodule update --init
	npm install --include=dev

build:
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
