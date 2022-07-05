install:
	npm install --force

install-dev:
	npm install --include=dev --force

build:
	npm run build

start:
	npm run dev

start-prod:
	npm start

lint:
	npm run lint

fix-lint:
	npm run fix-lint

test:
	npm test
