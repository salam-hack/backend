#!/bin/sh

set -e

echo "Waiting for database..."

until node -e "const net=require('net'); const s=net.connect({host:'db',port:5432},()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1)); setTimeout(()=>process.exit(1),2000);"; do
  echo "DB not ready yet... retrying"
  sleep 2
done

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed || true

echo "Starting backend..."
npm start
