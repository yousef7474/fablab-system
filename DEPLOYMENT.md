# 🚀 Deployment Guide for fablabsahsa.com

## Overview

This guide will deploy your FABLAB system to DigitalOcean with:
- ✅ Your domain: fablabsahsa.com
- ✅ HTTPS (SSL certificate)
- ✅ PostgreSQL database
- ✅ 24/7 availability
- ✅ Auto-restart on crashes

---

## Part 1: Create DigitalOcean Droplet

### Step 1: Login to DigitalOcean
Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)

### Step 2: Create Droplet
1. Click **"Create"** → **"Droplets"**
2. Choose settings:

| Setting | Value |
|---------|-------|
| **Region** | Choose closest to Saudi Arabia (e.g., Frankfurt or Bangalore) |
| **Image** | Ubuntu 22.04 (LTS) x64 |
| **Size** | Basic → Regular → **$12/mo** (2GB RAM, 1 CPU) |
| **Authentication** | Password (easier) or SSH Key (more secure) |
| **Hostname** | `fablab-server` |

3. Click **"Create Droplet"**
4. Wait ~1 minute for it to create
5. **Copy the IP address** (e.g., `123.456.789.10`)

---

## Part 2: Connect Domain to Server

### Step 1: In DigitalOcean
1. Go to **"Networking"** → **"Domains"**
2. Add domain: `fablabsahsa.com`
3. Add these DNS records:

| Type | Hostname | Value |
|------|----------|-------|
| A | @ | YOUR_DROPLET_IP |
| A | www | YOUR_DROPLET_IP |

### Step 2: In Your Domain Registrar (Namecheap/GoDaddy)
Change nameservers to:
```
ns1.digitalocean.com
ns2.digitalocean.com
ns3.digitalocean.com
```

⏳ DNS takes 15-30 minutes to update (sometimes up to 24 hours)

---

## Part 3: Server Setup

### Step 1: Connect to Server

**On Windows:** Use PowerShell or download [PuTTY](https://putty.org)

```bash
ssh root@YOUR_DROPLET_IP
```

Enter your password when prompted.

### Step 2: Run These Commands (Copy & Paste)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Git
apt install -y git

# Create app directory
mkdir -p /var/www/fablab
mkdir -p /var/log/fablab

# Check versions
node -v
npm -v
psql --version
nginx -v
```

### Step 3: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Run these SQL commands:
CREATE USER fablab_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE fablab_db OWNER fablab_user;
GRANT ALL PRIVILEGES ON DATABASE fablab_db TO fablab_user;
\q
```

**Important:** Replace `YOUR_STRONG_PASSWORD_HERE` with a strong password and save it!

---

## Part 4: Upload Your Code

### Option A: Using Git (Recommended)

On your local computer, initialize git and push to GitHub:

```bash
cd "F:\fablab regiser"
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/fablab-system.git
git push -u origin main
```

Then on the server:
```bash
cd /var/www/fablab
git clone https://github.com/YOUR_USERNAME/fablab-system.git .
```

### Option B: Using SFTP (FileZilla)

1. Download [FileZilla](https://filezilla-project.org)
2. Connect:
   - Host: YOUR_DROPLET_IP
   - Username: root
   - Password: your password
   - Port: 22
3. Upload all files to `/var/www/fablab/`

---

## Part 5: Configure & Build

### Step 1: Create Production .env

```bash
cd /var/www/fablab
nano .env
```

Paste this (update the values!):

```env
PORT=5000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=fablab_db
DB_USER=fablab_user
DB_PASSWORD=YOUR_DATABASE_PASSWORD_HERE

JWT_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_KEY_HERE_AT_LEAST_64_CHARS

SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=noreply@fablabsahsa.com
SENDGRID_FROM_NAME=FABLAB Al-Ahsa

EMPLOYEE_ELECTRONICS_EMAIL=electronics@fablabsahsa.com
EMPLOYEE_CNC_LASER_EMAIL=laser@fablabsahsa.com
EMPLOYEE_CNC_WOOD_EMAIL=wood@fablabsahsa.com
EMPLOYEE_3D_EMAIL=3d@fablabsahsa.com
EMPLOYEE_ROBOTIC_AI_EMAIL=robotic@fablabsahsa.com
EMPLOYEE_KIDS_CLUB_EMAIL=kids@fablabsahsa.com
EMPLOYEE_VINYL_CUTTING_EMAIL=vinyl@fablabsahsa.com

CLIENT_URL=https://fablabsahsa.com
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 2: Install Dependencies & Build

```bash
# Install backend dependencies
npm install

# Install frontend dependencies and build
cd client
npm install --legacy-peer-deps
npm run build
cd ..
```

### Step 3: Start the Application

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 config (auto-start on reboot)
pm2 save
pm2 startup
```

---

## Part 6: Configure Nginx

### Step 1: Create Nginx Config

```bash
nano /etc/nginx/sites-available/fablabsahsa.com
```

Paste this (temporary HTTP only version):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name fablabsahsa.com www.fablabsahsa.com;

    root /var/www/fablab/client/build;
    index index.html;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

### Step 2: Enable Site

```bash
# Create symlink
ln -s /etc/nginx/sites-available/fablabsahsa.com /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Restart nginx
systemctl restart nginx
```

---

## Part 7: Setup SSL (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d fablabsahsa.com -d www.fablabsahsa.com

# Follow the prompts:
# - Enter email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)
```

---

## Part 8: Create First Admin

```bash
cd /var/www/fablab
node createFirstAdmin.js
```

---

## ✅ Done! Your Site is Live!

Visit: **https://fablabsahsa.com**

Admin login: **https://fablabsahsa.com/admin/login**
- Username: `admin`
- Password: `Admin@123`

---

## 🔧 Useful Commands

```bash
# View app status
pm2 status

# View logs
pm2 logs fablab-api

# Restart app
pm2 restart fablab-api

# Restart nginx
systemctl restart nginx

# Check nginx errors
tail -f /var/log/nginx/error.log
```

---

## 🔄 How to Update the Site Later

```bash
cd /var/www/fablab
git pull origin main
npm install
cd client
npm install --legacy-peer-deps
npm run build
cd ..
pm2 restart fablab-api
```

---

## 🔥 Firewall Setup (Security)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 📊 Monitoring (Optional)

```bash
# Install monitoring
pm2 install pm2-logrotate

# Set log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```
