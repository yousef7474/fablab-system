# Faby AI Integration — HTTP API Reference

Faby is an external AI assistant that observes the FabLab Al-Ahsa system. This
document is the complete contract between Faby and the server. Everything below
is grounded in the actual code — file:line pointers are given so you can verify.

**Important scope note:** the API is **read-only across the whole system**. It
was built to let Faby answer questions like *"how many pending registrations?",
"who's late on tasks?", "what did volunteer X do last week?"*. Booking,
attendance marking, sending messages, and any other mutation are **not
supported** — no such endpoints exist. Anywhere the questions below assume
write functionality, the answer is `does not exist`.

---

## Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://fablabsahsa.com/api/ai` |
| Local dev | `http://localhost:5000/api/ai` |

Routes mounted in `server/index.js:92`. Controller: `server/controllers/aiController.js`.
Route table: `server/routes/aiRoutes.js`.

---

## Authentication

Every endpoint except `/health` requires an API key. Middleware:
`server/middleware/aiAuth.js`.

Pick one of these three ways to pass the key — they are all equivalent:

| Method | Header / param | Example format |
|---|---|---|
| Preferred | `X-Api-Key: <key>` | `X-Api-Key: <YOUR_FABY_API_KEY>` |
| Bearer | `Authorization: Bearer <key>` | `Authorization: Bearer <YOUR_FABY_API_KEY>` |
| Query param | `?apiKey=<key>` | `?apiKey=<YOUR_FABY_API_KEY>` |

The key is a single opaque string stored in `AI_API_KEY` on the server's
`.env`. Format: any string ≥ 8 characters (the current key is a 43-char
url-safe base64). No expiry, no scopes — one key, all-or-nothing access to the
whole read-only surface.

---

## Endpoints

### 1. `GET /health` — public health probe (no auth)

Returns whether the server booted with an `AI_API_KEY` configured. Does not
reveal or accept the key. Handy for smoke tests after deploy.

**Request:**
```
GET https://fablabsahsa.com/api/ai/health
```

**Response 200 (armed):**
```json
{
  "ok": true,
  "status": "armed",
  "note": "AI API is armed. Send X-Api-Key on the other endpoints."
}
```

**Response 200 (not configured):**
```json
{
  "ok": false,
  "status": "not_configured",
  "note": "Set AI_API_KEY (>=8 chars) in server/.env and restart pm2."
}
```

Source: `server/routes/aiRoutes.js:7-18`.

---

### 2. `GET /schema` — list every queryable resource

Returns the resource registry so Faby can discover what it can query.

**Request:**
```
GET https://fablabsahsa.com/api/ai/schema
Headers: X-Api-Key: <YOUR_FABY_API_KEY>
```

**Response 200 (truncated — real response is ~21 KB, 74 resources):**
```json
{
  "note": "Every resource is read-only. Use /api/ai/resource/{name} to query.",
  "count": 74,
  "resources": {
    "users": {
      "model": "User",
      "table": "users",
      "primaryKey": "userId",
      "fields": ["userId", "applicationType", "firstName", "lastName", "sex",
                 "nationality", "nationalId", "phoneNumber", "email",
                 "profilePicture", "createdAt", "updatedAt"],
      "excluded": []
    },
    "admins": {
      "model": "Admin",
      "table": "admins",
      "primaryKey": "adminId",
      "fields": ["adminId", "username", "fullName", "role", "createdAt", "updatedAt"],
      "excluded": ["password"]
    }
    // ...72 more resources
  }
}
```

Every resource declared in `RESOURCES` at `server/controllers/aiController.js:26-133`
is returned. Sensitive columns (`password`, `fileData`, base64 blobs, huge JSON
reports) are auto-excluded per the `exclude` array in the registry.

The full list at time of writing includes: `users, registrations, admins,
employees, tasks, ratings, evaluations, employee-activity, manager-todos,
volunteers, volunteer-opportunities, volunteer-ratings, volunteer-attendance,
volunteer-receipts, workers, worker-opportunities, worker-ratings,
worker-receipts, interns, intern-trainings, intern-ratings, intern-attendance,
trainer-assistants, trainer-assignments, trainer-attendance, fablab-staff,
fablab-staff-attendance, overtime-requests, fablab-visits, section-availability,
registration-closures, working-hours-overrides, mawhba-students,
mawhba-attendance, mawhba-seasons, mawhba-course-colors, summer-programs,
summer-teachers, summer-teacher-ratings, summer-students,
summer-student-attendance, summer-seasons, workshops, workshop-students,
education, education-ratings, education-students, education-attendance,
borrowings, contracts, customers, workspaces, workspace-ratings, store-items,
store-orders, store-coupons, store-customers, print3d-requests,
institution-projects, elite-users, elite-ratings, elite-credits, elite-tasks,
elite-works, elite-schedule, elite-courses, elite-course-lessons,
elite-course-enrollments, elite-lesson-progress, elite-course-quizzes,
elite-quiz-questions, elite-quiz-attempts, calendar-events, settings`.

---

### 3. `GET /snapshot` — one-shot system-wide summary

Counts, active season pointers, current admin toggles, and 10 recent items of
each high-signal type. Designed so Faby can answer *"how many X"*, *"what
changed today"*, *"current state of Y"* without dozens of round trips.

**Request:**
```
GET https://fablabsahsa.com/api/ai/snapshot
Headers: X-Api-Key: <YOUR_FABY_API_KEY>
```

**Response 200 (structure — real values will vary):**
```json
{
  "generatedAt": "2026-09-01T07:00:48.611Z",
  "today": "2026-09-01",
  "counts": {
    "registrations": { "total": 337, "pending": 12, "approved": 162 },
    "users": 219,
    "employees_active": 9,
    "tasks": { "total": 472, "active": 182 },
    "team": {
      "volunteers": 0, "workers": 0, "interns": 0,
      "trainer_assistants": 0, "fablab_staff": 0
    },
    "overtime": { "total": 0, "pending_approval": 0 },
    "fablab_visits": { "total": 0, "pending_approval": 0 },
    "mawhba": { "active_students": 0, "active_season": null },
    "summer": { "active_students": 0, "active_programs": 0, "active_season": null },
    "workshops": { "total": 0, "students": 0 },
    "contracts": 0,
    "customers": 0,
    "workspaces": 0,
    "borrowings": 0,
    "store": {
      "items": 0,
      "orders": { "total": 0, "pending": 0, "completed": 0 },
      "revenue_paid_total": 0,
      "revenue_this_month": 0,
      "customers": 0,
      "active_coupons": 0
    },
    "print3d": {
      "total": 0, "submitted": 0, "printing": 0, "completed": 0,
      "revenue_paid_total": 0
    },
    "institution_support": { "total": 0, "active": 0 },
    "calendar_events": 0
  },
  "current_settings": {
    "working_hours_start": "<setting value>",
    "working_hours_end": "<setting value>",
    "working_days": "<setting value>",
    "registration_disabled": "<setting value>"
  },
  "recent": {
    "registrations": [ /* up to 10 most recent Registration rows */ ],
    "store_orders": [ /* up to 10 most recent StoreOrder rows */ ],
    "print3d_requests": [ /* up to 10 most recent Print3DRequest rows, file blobs stripped */ ],
    "fablab_visits": [ /* up to 10 most recent FablabVisit rows */ ]
  }
}
```

Source: `server/controllers/aiController.js:203-380`. Every count uses a
`safeCount` helper so a single broken table cannot break the whole snapshot.

---

### 4. `GET /resource/:name` — paginated list of one resource

**Path params:**
- `:name` — one of the ~74 keys from `/schema`.

**Query params (all optional):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | `50` | Max `500` |
| `offset` | int | `0` | For pagination |
| `from` | ISO date | — | Filter by `createdAt >= from`; ignored if the model has no `createdAt` |
| `to` | ISO date | — | Filter by `createdAt <= to`; same ignore rule |
| `order` | string | `createdAt DESC` | `<fieldName> <ASC|DESC>`; falls back to `createdAt` if the field doesn't exist on the model |

**Request:**
```
GET https://fablabsahsa.com/api/ai/resource/volunteers?limit=25&offset=0&from=2026-08-01
Headers: X-Api-Key: <YOUR_FABY_API_KEY>
```

**Response 200 (shape):**
```json
{
  "resource": "volunteers",
  "total": 42,
  "limit": 25,
  "offset": 0,
  "returned": 25,
  "items": [
    /* Sequelize toJSON of each row, minus columns in the resource's exclude list */
  ]
}
```

Source: `server/controllers/aiController.js:383-415`.

---

### 5. `GET /resource/:name/:id` — one record by primary key

**Request:**
```
GET https://fablabsahsa.com/api/ai/resource/volunteers/<VOLUNTEER_UUID>
Headers: X-Api-Key: <YOUR_FABY_API_KEY>
```

**Response 200:** the raw record (Sequelize `toJSON`), sensitive columns
excluded per the resource's `exclude` list.

Source: `server/controllers/aiController.js:418-432`.

---

### 6. `GET /search?q=...` — cross-resource text search

Best-effort ILIKE search across the highest-signal resources. Returns a hit
list per resource so Faby can dig further via `/resource/:name/:id`.

**Query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | required | Min 2 characters, else 400 |
| `limit` | int | `10` | Max `50`, per-resource cap |

**Searched resources and fields:**

| Resource | Fields searched |
|---|---|
| `users` | `firstName, lastName, name, email, phoneNumber, nationalId` |
| `registrations` | `fablabSection, requiredServices, purpose` |
| `employees` | `name, email, section, position` |
| `tasks` | `title, description` |
| `volunteers` | `name, email, phone, nationalId` |
| `fablab-staff` | `name, email, position, nationalId` |
| `store-items` | `name, nameEn, description, category, sku` |
| `store-orders` | `customerName, customerPhone, customerEmail` |
| `store-customers` | `name, email, phone` |
| `fablab-visits` | `entityName, personInCharge, email, phone, purpose` |
| `print3d-requests` | `customerName, customerEmail, customerPhone, fileName` |
| `institution-projects` | `projectName, supervisorName, evaluation` |
| `contracts` | `customerName, customerEmail, customerPhone` |
| `workshops` | `title, section, instructorName` |
| `mawhba-students` | `studentName, studentId, fablabSection` |
| `summer-students` | `name, nationalId` |
| `summer-programs` | `name, teacherName, fablabSection` |
| `summer-teachers` | `name, email, fablabSection` |

Source: `server/controllers/aiController.js:445-469`.

**Request:**
```
GET https://fablabsahsa.com/api/ai/search?q=ahmad&limit=5
Headers: X-Api-Key: <YOUR_FABY_API_KEY>
```

**Response 200 (shape):**
```json
{
  "query": "ahmad",
  "totalResourcesWithHits": 3,
  "results": {
    "users":       [ /* up to `limit` matching User rows */ ],
    "volunteers":  [ /* up to `limit` matching Volunteer rows */ ],
    "registrations": [ /* etc. */ ]
  }
}
```

Only resources with at least one hit appear in `results`. Zero-hit resources
are omitted (not returned as empty arrays).

---

## Error responses (every status the API can emit)

| Status | Body | When it happens |
|---|---|---|
| `400` | `{"error":"q must be at least 2 characters"}` | `GET /search` with a `q` shorter than 2 chars. Source: `aiController.js:441`. |
| `401` | `{"error":"Missing API key","hint":"Send it as X-Api-Key header, Authorization: Bearer <key>, or ?apiKey= query param."}` | No key on a protected route. Source: `middleware/aiAuth.js:29-33`. |
| `401` | `{"error":"Invalid API key"}` | Key does not match the configured `AI_API_KEY`. Source: `middleware/aiAuth.js:36`. |
| `404` | `{"error":"Unknown resource","available":[/* sorted keys */]}` | `GET /resource/:name` with a name not in the registry. Source: `aiController.js:387-390`. |
| `404` | `{"error":"Unknown resource"}` | `GET /resource/:name/:id` with an unknown name. Source: `aiController.js:421`. |
| `404` | `{"error":"Not found"}` | `GET /resource/:name/:id` where `:id` doesn't exist. Source: `aiController.js:426`. |
| `500` | `{"error":"<error message>"}` | Any unhandled DB / server exception. Emitted uniformly across all endpoints. Sources: `aiController.js:193, 378, 413, 430, 496`. |
| `500` | `{"error":"Model <Name> not registered"}` | Registry lists a model that isn't actually exported. Should never happen in prod — indicates a code bug. Source: `aiController.js:393`. |
| `503` | `{"error":"AI API is not configured","hint":"Set AI_API_KEY in the server .env (at least 8 chars) and restart pm2."}` | Server booted without `AI_API_KEY` set (or shorter than 8 chars). Source: `middleware/aiAuth.js:17-20`. |

Rate limiting: **does not exist.** No 429 response is possible.

---

## Answers to the seven specific questions

### 1. Permission scope of the issued key

**Read-only across the entire registry.** The key can hit `/schema`,
`/snapshot`, `/resource/*`, and `/search`, and nothing else. There is no
POST / PUT / PATCH / DELETE endpoint on the `/api/ai` namespace — the router
in `server/routes/aiRoutes.js:20-24` only registers GET routes.

- Faby **cannot** create bookings, attendance rows, receipts, tasks, etc.
- Faby **cannot** approve or reject anything (overtime, volunteer opportunities,
  visits).
- Faby **cannot** send messages to users.

The mutations Faby can *observe* (e.g. that a booking exists) happen through
the admin/manager web UIs on separate JWT-authed namespaces. Faby has no
access to those.

### 2. Timezone and slot-filtering

- **Timestamps returned:** ISO 8601, always UTC (`.toISOString()` at
  `aiController.js:327`, and Sequelize's default UTC-serialised `DATE` /
  `DATETIME` columns).
- **The server's business timezone is `Asia/Riyadh`** for anything schedule-
  related (e.g. `todayStr` in `volunteerController.js` and
  `trainerAssistantController.js`). This is not applied to API responses —
  Faby receives raw UTC and must convert.
- **Slot filtering to opening hours (08:00–16:00 / 11:00–20:00 alternating):**
  **does not exist** in this API. There is no slot / availability endpoint. The
  `settings` resource exposes raw `working_hours_start`, `working_hours_end`,
  `working_days` values via `/resource/settings` or in
  `snapshot.current_settings`, but the API does not generate a pre-filtered
  list of bookable slots. If Faby needs slot logic it must implement it on
  its side against those settings values.

### 3. Idempotency key for booking creation

**Does not exist.** There is no booking-creation endpoint on this API, so
idempotency is not applicable. If a booking API is added later, this section
will need updating.

### 4. User account, confirmation messages

- **User account required to book:** **does not exist** — no booking flow on
  this API.
- **SMS / WhatsApp / email confirmation triggered by Faby:** **does not
  exist.** Faby can observe registrations, orders, and other records that
  the main web app has already sent emails for (SendGrid via
  `server/utils/emailService.js`), but Faby cannot trigger any send itself.

### 5. Rate limits on the key

**None.** No `express-rate-limit`, `slowdown`, or throttling middleware is
installed on `/api/ai` or globally (verified: repo-wide search for
`rate.?limit|express-rate-limit|slowdown|throttle` returns zero matches under
`server/`). Faby can call as fast as the box handles. Be considerate on
`/snapshot` — it fires ~40 queries in parallel.

### 6. Safe testing

- **Separate staging environment:** **does not exist.** There is one
  production deployment at `fablabsahsa.com`, and a local-dev clone if you
  run the repo yourself.
- **Test-booking convention on prod:** **does not exist**, because there are
  no bookings to create through this API. Every call is a read — safe by
  construction. Faby cannot corrupt state.
- **Safe local dev option:** clone the repo, spin up the server against a
  local Postgres, and hit `http://localhost:5000/api/ai/*`. Follow the deploy
  notes in the repo's memory / CLAUDE files for env-var setup.

### 7. Revoking / rotating the key

The key is a single environment variable, `AI_API_KEY`, in
`/var/www/fablab/server/.env` on production.

**Rotation procedure (must be run manually on the server):**

```bash
# 1. Replace the value in server/.env
sed -i 's|^AI_API_KEY=.*|AI_API_KEY=<NEW_KEY>|' /var/www/fablab/server/.env

# 2. Restart pm2 WITH --update-env so the process actually re-reads .env
pm2 restart fablab-api --update-env

# 3. Verify from any browser (does not expose the key)
curl -s https://fablabsahsa.com/api/ai/health
# → {"ok":true,"status":"armed",...}
```

**Immediate revocation without rotation** — same file, empty the value:

```bash
sed -i 's|^AI_API_KEY=.*|AI_API_KEY=|' /var/www/fablab/server/.env
pm2 restart fablab-api --update-env
# Every /api/ai/* call now returns 503 "AI API is not configured"
```

The `--update-env` flag is critical — plain `pm2 restart fablab-api` reuses
the cached env from when the process was first started and will silently
ignore the new value. Verified during initial deploy.

---

## File-level source of truth

| Concern | File(s) |
|---|---|
| Route table | `server/routes/aiRoutes.js` |
| Endpoint handlers | `server/controllers/aiController.js` |
| Auth middleware | `server/middleware/aiAuth.js` |
| Resource registry | `server/controllers/aiController.js:26-133` |
| Route mount | `server/index.js:92` |
| Boot log (armed/disabled) | `server/index.js:206-217` |
| Key storage | `/var/www/fablab/server/.env` line `AI_API_KEY=...` |
