#!/bin/bash
echo "Pulling latest code..."
cd /home/singhpranjwal/coverletter-generator-api
git pull

echo "Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "Restarting backend..."
sudo systemctl restart backend

echo "Restarting celery worker..."
sudo systemctl restart celery

echo "Restarting celery beat..."
sudo systemctl restart celerybeat

echo "Restarting nginx..."
sudo systemctl restart nginx

echo "All done!"
sudo systemctl status backend --no-pager
sudo systemctl status celery --no-pager