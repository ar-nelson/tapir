.PHONY: setup clean run all

all: clean setup run

clean:
	docker-compose down
	sudo rm -rf mastodon/data

setup:
	mkdir -p mastodon/data/public/system
	mkdir -p mastodon/data/postgres
	mkdir -p mastodon/data/redis
	chmod -R 777 mastodon/data
	docker-compose build
	docker-compose run mastodon rails db:migrate
	docker-compose run mastodon tootctl accounts create mu --email mu@mastodon.local --confirmed --role Owner --force > mastodon-password.txt

run:
	docker-compose up
