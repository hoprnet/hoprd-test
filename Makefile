

.POSIX:

all: help

.PHONY: install
install:
	python3 -m pip install --upgrade pip
	python3 -m pip install -r requirements.txt
	docker pull europe-west3-docker.pkg.dev/hoprassociation/docker-images/hopr-pluto:latest

.PHONY: pluto-start
pluto-start:
	docker-compose up 2&>1 > /dev/null &

.PHONY: pluto-stop
pluto-stop:
	docker-compose down

.PHONY: test
test:
	pytest -v src/test_plans/integration/test_api.py

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'