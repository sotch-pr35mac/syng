install:
	git submodule update --init
	npm install --force

install-dev:
	git submodule update --init
	npm install --include=dev --force

build:
	npm run build

start:
	npm run svelte-build
	cargo tauri dev

start-prod:
	npm start

lint:
	cd src-tauri && cargo fmt --check
	npm run lint

fix-lint:
	cd src-tauri && cargo fmt
	npm run fix-lint

test:
	npm test
