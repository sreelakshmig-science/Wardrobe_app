# My Wardrobe — Try-On, Cart, Sync & Auto-Fit

```
wardrobe-app/
├── frontend/          ← static site: index.html, styles.css, app.js
└── backend/           ← Node/Express API + MongoDB, for login + cross-device sync
```

## What's new in this version

- **Auto-fit**: a pose-detection model (TensorFlow.js + MoveNet) finds your
  shoulders/hips/ankles from the camera feed and automatically positions,
  scales, and rotates the selected garment onto your body. Tap **"Auto-fit: Off"**
  to turn it on. Dragging the garment or moving a slider turns it back off
  so you can fine-tune manually.
- **Backend + accounts**: a small Express API with sign-up/login (JWT-based)
  and MongoDB storage for your wardrobe and cart.
- **Sync across devices**: log into the same account on your laptop and phone
  and you'll see the same wardrobe/cart on both, because the data now lives
  on the server instead of just `localStorage`.

---

## 1. Set up the database (MongoDB Atlas — free)

1. Go to mongodb.com/cloud/atlas, create a free account, and create a free
   "M0" cluster.
2. Under **Database Access**, create a user + password.
3. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) — fine for
   a personal project.
4. Click **Connect → Drivers**, copy the connection string, it looks like:
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
5. Add a database name to the end, e.g. `.../wardrobe`.

## 2. Run the backend locally

```bash
cd backend
cp .env.example .env
# edit .env: paste your MONGODB_URI, and set JWT_SECRET to any long random string
npm install
npm start
```

You should see `Connected to MongoDB` and `API listening on port 4000`.

## 3. Run the frontend locally

```bash
cd frontend
python3 -m http.server 5500
```

Open `http://localhost:5500`. On the sign-in screen, set **Backend URL** to
`http://localhost:4000/api`, then sign up with a username/password.

## 4. Put it on GitHub

```bash
cd wardrobe-app
git init
git add .
git commit -m "Wardrobe app: frontend + backend"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

`backend/.gitignore` already excludes `node_modules` and your real `.env`,
so secrets won't be pushed.

## 5. Deploy the backend (Render, free tier, auto-deploys from GitHub)

GitHub Pages can only host static files — it can't run your Node server. Render
can, and it's free and deploys straight from your GitHub repo:

1. Go to render.com, sign in with GitHub, click **New → Web Service**.
2. Pick your repo. Set:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
3. Add environment variables (same values as your local `.env`):
   `MONGODB_URI`, `JWT_SECRET`.
4. Deploy. You'll get a URL like `https://your-app.onrender.com`. Your API
   base becomes `https://your-app.onrender.com/api`.
5. From now on, every `git push` to `main` auto-redeploys the backend.

(Free-tier Render services sleep after inactivity and take ~30s to wake up
on the first request — normal for a personal project.)

## 6. Deploy the frontend (GitHub Pages, free, real HTTPS)

1. In your GitHub repo settings → **Pages**, set the source to the `main`
   branch and the folder to `/frontend` (GitHub Pages supports serving from
   a subfolder).
2. Save — GitHub gives you a URL like
   `https://<your-username>.github.io/<repo-name>/`.
3. Open that URL — on your **phone or laptop** — and on the sign-in screen,
   set the Backend URL to your Render URL from step 5
   (`https://your-app.onrender.com/api`), then sign up/log in.

Because both GitHub Pages and Render serve over real HTTPS, the camera
works immediately on your phone — no tunneling needed anymore.

## 7. Using it across devices

- Sign up once (say, on your phone).
- On your laptop, open the same GitHub Pages URL, enter the same Backend
  URL, and log in with the same username/password.
- Add clothes from either device — both will show the same wardrobe and
  cart, because they're both reading from the same MongoDB database.

## How auto-fit works (and its limits)

MoveNet estimates ~17 body keypoints per frame (shoulders, hips, ankles,
etc.) directly in the browser. For each category:
- **Top / Outerwear / Dress** anchor to the shoulder midpoint and scale to
  shoulder width.
- **Bottom** anchors to the hip midpoint and hip width.
- **Shoes** anchor to ankle midpoint (falls back to hips if ankles aren't
  visible in frame).

It's a fast approximation, not real cloth simulation — there's no fabric
draping or occlusion (a garment won't disappear behind your arm). It gets
you close, then manual drag/resize/rotate finishes the job. A future
upgrade path, if you want it later, is a proper cloth-warping model, but
that's a much bigger project than this.

## Notes / things to know

- Clothing photos and try-on snapshots are stored as base64 text in MongoDB
  for simplicity. Fine for personal use; if you outgrow the free Atlas tier
  (512MB), switching to file storage (e.g. Cloudinary or S3) is the next
  step — ask if you want that built out.
- `cors()` is wide open in `server.js` for simplicity. If you want to lock
  the API to only your frontend's domain, say so and it's a one-line change.
- No password reset flow yet — this is intentionally minimal for a personal
  project with one or two users.
