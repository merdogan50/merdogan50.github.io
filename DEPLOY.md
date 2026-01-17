# GitHub Pages Deployment Guide
## maruninternalmedicine.github.io

### Step 1: Create GitHub Account
1. Go to https://github.com
2. Create account with username: **maruninternalmedicine**

### Step 2: Create Repository
1. Click "New repository"
2. Repository name: **maruninternalmedicine.github.io**
3. Make it **Public**
4. Click "Create repository"

### Step 3: Upload Files
Upload these files from `/Users/merdogan50/.gemini/ders_program/`:
```
index.html
styles.css
app.js
data/
  ├── settings.json
  ├── blocks.json
  ├── sessions.json
  ├── courses.json
  └── instructors.json
```

### Step 4: Enable GitHub Pages
1. Go to repository Settings
2. Click "Pages" in sidebar
3. Source: "Deploy from a branch"
4. Branch: "main" / "root"
5. Click "Save"

### Step 5: Access
Wait 1-2 minutes, then:

- **Public (for instructors):** https://maruninternalmedicine.github.io
- **Admin (for you):** https://maruninternalmedicine.github.io?admin=true

---

## Quick Upload via Terminal

```bash
cd /Users/merdogan50/.gemini/ders_program
git init
git add .
git commit -m "Initial schedule system"
git branch -M main
git remote add origin https://github.com/maruninternalmedicine/maruninternalmedicine.github.io.git
git push -u origin main
```

---

## Updating Schedule

1. Go to admin URL: `?admin=true`
2. Make changes
3. Click "Export Data" to download JSON backup
4. Upload new JSON files to GitHub

---

## Links Quick Reference

| Purpose | URL |
|---------|-----|
| Public View | https://maruninternalmedicine.github.io |
| Admin View | https://maruninternalmedicine.github.io?admin=true |
| Repository | https://github.com/maruninternalmedicine/maruninternalmedicine.github.io |
