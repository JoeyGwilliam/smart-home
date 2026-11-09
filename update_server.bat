ssh joeyg@mini-pc
cd C:\Users\Joeyg\PycharmProjects\smart-home
git pull
docker compose down
docker compose up -d -build
pause