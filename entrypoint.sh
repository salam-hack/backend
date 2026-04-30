#!/bin/sh

set -e

echo "Running Prisma DB sync..."

npx prisma db push --accept-data-loss

echo "database synced successfully"

echo "Starting backend..."

npm start
