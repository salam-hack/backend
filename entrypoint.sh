#!/bin/sh

set -e

echo "Waiting for database..."

until pg_isready -h db -p 5432 -U postgres; do
  echo "DB not ready yet... retrying"
  sleep 2
done

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed || true

echo "Starting backend..."
npm start
