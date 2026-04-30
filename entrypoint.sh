#!/bin/sh

set -e

echo "Waiting for database..."

until npx prisma db execute --stdin < /dev/null; do
  echo "DB not ready yet... retrying"
  sleep 2
done

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database (if needed)..."
npx prisma db seed || true

echo "Starting backend..."
npm start
