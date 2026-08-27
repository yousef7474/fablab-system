# FabLab Al-Ahsa — AI API

A read-only HTTP API for AI models to fetch any information from the FabLab
system. Every endpoint is protected by a single long-lived API key. No
mutation endpoints exist — the AI can query but never change data.

---

## 1) Set the API key

Add a strong random key to your server `.env` (at least 8 characters,
recommended 32+):

```
AI_API_KEY=REPLACE_WITH_A_LONG_RANDOM_STRING
```

Then restart the API:

```bash
pm2 restart fablab-api
```

If `AI_API_KEY` is missing or empty, every AI endpoint returns HTTP 503 with
a clear message so it's obvious what's misconfigured.

---

## 2) Authentication

Send the key on every request in ANY of these three ways:

```
X-Api-Key: <your-key>
```

```
Authorization: Bearer <your-key>
```

```
?apiKey=<your-key>
```

The header form is preferred. The query-param form is fine for quick tests
in a browser.

---

## 3) Endpoints

All under `https://fablabsahsa.com/api/ai`.

### `GET /schema`
Lists every queryable resource with its field names and primary key. Give
this to your AI first so it knows what it can ask about.

### `GET /snapshot`
One-shot system-wide summary — counts, active seasons, recent activity,
current settings toggles (working hours, store open, registration open,
etc.). Enough for the AI to answer common questions like "how many pending
registrations?" or "what's happening this week?" without extra calls.

### `GET /search?q=<text>&limit=10`
Best-effort text search across the highest-signal resources (users,
registrations, employees, tasks, volunteers, store items/orders,
fablab-visits, print3d requests, institution projects, contracts,
workshops, mawhba/summer students, etc.). Returns per-resource hit lists.

### `GET /resource/{name}?limit=50&offset=0&from=YYYY-MM-DD&to=YYYY-MM-DD&order=createdAt DESC`
Paginated list of one resource. `limit` is capped at 500. `from`/`to`
filter by `createdAt` when the model has one.

### `GET /resource/{name}/{id}`
Single record by primary key.

---

## 4) Available resources

Ordered roughly by how often you'll query them. Every name is the exact
string to pass as `{name}` in the resource URL.

**People / accounts**
- `users` · `registrations` · `admins` · `employees`

**Employee productivity**
- `tasks` · `ratings` · `evaluations` · `employee-activity` · `manager-todos`

**Team members with attendance**
- `volunteers` · `volunteer-opportunities` · `volunteer-ratings` · `volunteer-attendance` · `volunteer-receipts`
- `workers` · `worker-opportunities` · `worker-ratings` · `worker-receipts`
- `interns` · `intern-trainings` · `intern-ratings` · `intern-attendance`
- `trainer-assistants` · `trainer-assignments` · `trainer-attendance`
- `fablab-staff` · `fablab-staff-attendance`
- `overtime-requests`

**Bookings / scheduling**
- `fablab-visits` · `section-availability` · `registration-closures` · `working-hours-overrides`

**Mawhba program**
- `mawhba-students` · `mawhba-attendance` · `mawhba-seasons` · `mawhba-course-colors`

**Summer FabLab program**
- `summer-programs` · `summer-teachers` · `summer-teacher-ratings` · `summer-students` · `summer-student-attendance` · `summer-seasons`

**Workshops + school education**
- `workshops` · `workshop-students`
- `education` · `education-ratings` · `education-students` · `education-attendance`

**Other work streams**
- `borrowings` · `contracts` · `customers` · `workspaces` · `workspace-ratings`

**Store**
- `store-items` · `store-orders` · `store-coupons` · `store-customers`

**3D printing**
- `print3d-requests` (file bytes stripped — use the download endpoint for actual files)

**Institution support**
- `institution-projects` (heavy JSON blobs stripped — reports/images/invoices are metadata only in this API)

**Elite (advanced course platform)**
- `elite-users` · `elite-ratings` · `elite-credits` · `elite-tasks` · `elite-works`
- `elite-schedule` · `elite-courses` · `elite-course-lessons` · `elite-course-enrollments`
- `elite-lesson-progress` · `elite-course-quizzes` · `elite-quiz-questions` · `elite-quiz-attempts`

**Calendar + settings**
- `calendar-events` · `settings`

---

## 5) Example calls

```bash
# System snapshot — good starting call
curl -H "X-Api-Key: $AI_API_KEY" https://fablabsahsa.com/api/ai/snapshot

# List first 20 pending registrations
curl -H "X-Api-Key: $AI_API_KEY" \
  "https://fablabsahsa.com/api/ai/resource/registrations?limit=20"

# Search for anyone named "Ahmed"
curl -H "X-Api-Key: $AI_API_KEY" \
  "https://fablabsahsa.com/api/ai/search?q=Ahmed"

# One store order by ID
curl -H "X-Api-Key: $AI_API_KEY" \
  https://fablabsahsa.com/api/ai/resource/store-orders/<order-uuid>

# Everyone who registered this month
curl -H "X-Api-Key: $AI_API_KEY" \
  "https://fablabsahsa.com/api/ai/resource/users?from=2026-08-01"

# Full resource catalog (give this to the AI so it knows fields)
curl -H "X-Api-Key: $AI_API_KEY" https://fablabsahsa.com/api/ai/schema
```

---

## 6) Suggested system prompt for the AI model

Copy this into your AI's system prompt so it knows how to use the API:

```
You have read-only HTTP access to the FabLab Al-Ahsa management system via
these endpoints (all base URL: https://fablabsahsa.com/api/ai, all require
the header  X-Api-Key: <the key the user gave you>):

  GET /schema                       — list of every resource + its fields
  GET /snapshot                     — one-shot summary of the whole system
  GET /search?q=<text>              — cross-resource text search
  GET /resource/{name}              — paginated list (limit≤500, offset,
                                       from=YYYY-MM-DD, to=YYYY-MM-DD,
                                       order=field DIR)
  GET /resource/{name}/{id}         — single record by primary key

When the user asks a question:
  1. If you don't know the schema yet, call /schema once.
  2. For general "state of the system" questions, call /snapshot first.
  3. For "find X" questions, use /search then drill into specific records.
  4. For counts/totals over a period, use /resource/{name}?from=&to=.
  5. Always respect pagination — start with limit=20 unless the user
     needs a full dump.
  6. You cannot mutate data. If the user asks to add/edit/delete anything,
     tell them to do it in the admin panel.

The API strips password hashes and heavy file blobs (3D print files,
institution-project PDFs/images) automatically. Every response is JSON.
Errors come back as { error, hint? } with an appropriate HTTP status.
```

---

## 7) Security notes

- The key is checked verbatim (no hashing). Store it like any other
  secret — never commit it to git; keep it only in `.env` on the server
  and in your AI configuration.
- Rotate it by editing `.env` and running `pm2 restart fablab-api`.
- All endpoints are read-only, so a leaked key can't corrupt data — but
  it can leak everything readable in the tables (student names, phone
  numbers, invoice amounts, etc.). Treat leakage as a data-privacy
  incident, not just an availability issue.
- Password hashes for admins, employees, elite users, and store
  customers are explicitly excluded from every payload.
- File bytes for 3D-print uploads and institution-project attachments
  are excluded from JSON responses — the AI sees metadata (filenames,
  sizes, types) only. If you need actual file contents, that's what
  the download endpoints in the admin panel are for.
