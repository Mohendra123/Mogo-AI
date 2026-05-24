#!/bin/bash
cd /Volumes/Storage/mogo-server
git pull origin main
npm install
pm2 restart mogo-backend
echo "Deployment successful!"
