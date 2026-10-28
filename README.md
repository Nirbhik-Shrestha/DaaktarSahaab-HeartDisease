# DaaktarSahab (MERN)

Heart-disease risk checks and doctor appointments, with patient, doctor and
admin portals. This is the MERN version of the PHP/MySQL project in
`C:\wamp64\www\DoctorProjectTest`: same features, same look, same data.

- **M**ongoDB (Mongoose): data
- **E**xpress 5: REST API under `/api`
- **R**eact 19 (Vite, React Router): the whole UI
- **N**ode 22: runs the API, the heart-risk model and the PDF export

No PHP, MySQL or Python is needed any more. The random-forest model
(`server/src/ml/heart_model.json`) is scored in JavaScript and gives exactly the
same scores as the old `predict.py`.

## Run it

Needs Node 22+ and MongoDB on `127.0.0.1:27017` (MongoDB Compass works for viewing it).

```bash
npm install            # once, from this folder
npm run dev            # API on :5000 + React on http://localhost:5173
```

Open http://localhost:5173. Settings live in `server/.env` (see `server/.env.example`).

**Production / single port:** `npm run build` then `npm start`, and open http://localhost:5000.
Express serves the built React app and the API together. Set a real `JWT_SECRET`
and `NODE_ENV=production` first.

## Data

Your MySQL data has already been copied into the `daaktarsahab` database
(10 doctors, 9 patients, 13 sessions, 17 appointments, 24 heart checks, 17 chats).
Everyone signs in with the same email and password as before.

| Script | What it does |
| --- | --- |
| `npm run migrate:mysql -- --force` | Copy the MySQL `doctorProject` database into MongoDB again (replaces what is there; needs WAMP's MySQL running) |
| `npm run seed` | Fresh install only: the specialties and a first admin (`admin@doctorproject.com` / `admin123` unless set in `.env`) |
| `npm run train-model` | Retrain the model from `heart_cleveland_upload.csv` (add `-- --dry-run` to only print accuracy) |
| `npm test` | End-to-end API tests on a throwaway database |

## Layout

```
shared/         used by both sides: the 13 heart-check fields + validation, limits, time zone
server/src/
  models/       Mongoose schemas (one file; mirrors the old MySQL tables)
  routes/       auth, public, patient, doctor, admin, chat
  lib/          dates (Asia/Kathmandu), sessions, cascade deletes, readings, PDF
  ml/           predict.js (scoring), train.js (training), model + dataset
  scripts/      seed, migrateFromMysql
server/test/    API tests (node:test)
client/src/
  pages/        public, auth, patient, doctor, admin
  components/   header/footer/layout, chat, assessment form + risk card, trend chart, admin shell
  styles/       the original CSS, scoped per page type (see below)
client/public/images/   the original images
```

## How the PHP pieces map

| PHP | MERN |
| --- | --- |
| PHP sessions + `auth.php` `requireRole()` | httpOnly sign-in cookie (JWT) + `requireRole()` middleware; account reloaded on every request |
| `connection.php`, MySQL foreign keys | Mongoose models; ON DELETE rules in `server/src/lib/cascade.js`; unique indexes for one-booking-per-slot etc. |
| `predict.py` via `shell_exec` | `server/src/ml/predict.js`, in-process |
| FPDF `downloadAssessment.php` | pdfkit, `GET /api/patient/readings/:id/pdf` |
| `chat.php` + `chatApi.php` + `chat.js` | `routes/chat.js` + `components/Chat.jsx` (same polling, read receipts, drafts, attachments, quick replies) |
| `?msg=` redirects | in-page notices after each action |
| `css/*.css` | copied unchanged except for scoping: `site.css`, `home.css` and `admin.css` rules are prefixed with `:where(.site-page)` etc., which adds no specificity, so the old cascade still holds. Inline `<style>` blocks are in `styles/pages.css` |

## Notes

- **Password reset** still shows the reset link on screen, as the PHP version did,
  because there is no email service. In production (`NODE_ENV=production`) the link
  is only written to the server log; hook up email before relying on it.
- Changes need the `X-Requested-With: fetch` header (CSRF guard) and the cookie is
  `SameSite=Lax`; the React app's `api()` helper sends it.
- Chat attachments are stored in `server/uploads/chat` (not publicly served; only
  the two people in the conversation can download them).
- The "My Questions" and "My Medical Reports" header links were placeholders (`#`)
  in the PHP version and were left out.
