# AlgoArena Backend API Docs

## Base URL

- Local: `http://localhost:3000`

## Authentication

- Auth type: JWT (Bearer token)
- Header format:

```http
Authorization: Bearer <token>
```

## Endpoints

### 1) Health Check

- Method: `GET`
- URL: `/health`
- Response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Possible Errors:

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 2) Sign Up

- Method: `POST`
- URL: `/api/auth/signup`
- Description: Create a user and return JWT.
- Rules:
- `email` must be unique.
- `registrationNumber` must be exactly 8 digits and unique.
- `password` must be at least 6 characters.

Request:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "registrationNumber": "12345678",
  "password": "secret123"
}
```

Success Response (`201`):

```json
{
  "message": "User created successfully",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "registrationNumber": "12345678",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Possible Errors:

- `400 Bad Request` (missing required fields)

```json
{
  "message": "name, email, registrationNumber and password are required"
}
```

- `400 Bad Request` (invalid registration number)

```json
{
  "message": "registrationNumber must be exactly 8 digits"
}
```

- `400 Bad Request` (weak password)

```json
{
  "message": "password must be at least 6 characters long"
}
```

- `409 Conflict` (email already exists)

```json
{
  "message": "Email already exists"
}
```

- `409 Conflict` (registration number already exists)

```json
{
  "message": "Registration number already exists"
}
```

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 3) Sign In

- Method: `POST`
- URL: `/api/auth/signin`
- Description: Sign in using either email or registration number.

Request option A (email):

```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

Request option B (registration number):

```json
{
  "registrationNumber": "12345678",
  "password": "secret123"
}
```

Success Response (`200`):

```json
{
  "message": "Sign in successful",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "registrationNumber": "12345678",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Possible Errors:

- `400 Bad Request` (missing credential field or password)

```json
{
  "message": "email or registrationNumber, and password are required"
}
```

- `400 Bad Request` (invalid registration number format)

```json
{
  "message": "registrationNumber must be exactly 8 digits"
}
```

- `401 Unauthorized` (invalid credentials)

```json
{
  "message": "Invalid credentials"
}
```

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 4) Current User Profile

- Method: `GET`
- URL: `/api/auth/me`
- Auth: Required (`Bearer token`)

Success Response (`200`):

```json
{
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "registrationNumber": "12345678",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Possible Errors:

- `401 Unauthorized` (missing/invalid token)

```json
{
  "message": "Unauthorized"
}
```

- `401 Unauthorized` (expired or malformed token)

```json
{
  "message": "Invalid or expired token"
}
```

- `404 Not Found` (user deleted or unavailable)

```json
{
  "message": "User not found"
}
```

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 5) Get Questions (Paginated)

- Method: `GET`
- URL: `/api/questions`
- Description: Fetch questions with pagination.
- Query Params:
- `page` (optional, default `1`)
- `limit` (optional, default `10`, max allowed `20`)

Example:

`GET /api/questions?page=1&limit=20`

Success Response (`200`):

```json
{
  "page": 1,
  "limit": 20,
  "total": 118,
  "totalPages": 6,
  "data": [
    {
      "id": "1",
      "title": "Reverse Linked List",
      "slug": "reverse-linked-list",
      "description": "...",
      "topic": "Linked List",
      "difficulty": "easy",
      "constraints": [],
      "examples": [],
      "hints": [],
      "time_complexity": "O(n)",
      "space_complexity": "O(1)",
      "extra": {},
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Possible Errors:

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 6) Get All Questions (No Pagination)

- Method: `GET`
- URL: `/api/questions/all`
- Description: Fetch all questions in one response.

Success Response (`200`):

```json
{
  "total": 118,
  "data": [
    {
      "id": "1",
      "title": "Reverse Linked List",
      "slug": "reverse-linked-list"
    }
  ]
}
```

Possible Errors:

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 7) Submit Code to Judge0

- Method: `POST`
- URL: `/api/judge0/submit`
- Description: Submits code to Judge0 (configured via `JUDGE_ZERO_GCP`) and returns execution result.

Request:

```json
{
  "source_code": "print(input())",
  "language_id": 71,
  "stdin": "hello judge0",
  "expected_output": "hello judge0",
  "cpu_time_limit": 2,
  "memory_limit": 128000
}
```

Success Response (`200`):

```json
{
  "message": "Execution completed",
  "result": {
    "token": "<judge0-token>",
    "status": {
      "id": 3,
      "description": "Accepted"
    },
    "stdout": "hello judge0\n",
    "stderr": null,
    "compile_output": null,
    "message": null,
    "time": "0.023",
    "memory": 7864,
    "exit_code": 0
  }
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "source_code is required and must be a non-empty string"
}
```

- `400 Bad Request`

```json
{
  "message": "language_id is required and must be an integer"
}
```

- `500 Internal Server Error`

```json
{
  "message": "Internal server error"
}
```

### 8) Heartbeat (Frontend Ping)

- Method: `POST`
- URL: `/api/activity/heartbeat`
- Auth: Required (`Bearer token`)
- Description: Frontend calls this periodically to mark a user as active in the database.
- Query Params:
- `windowSeconds` (optional, default `60`, max `3600`) used to calculate active user count.

Request:

```json
{
  "metadata": {
    "page": "/contest/1",
    "tabVisible": true
  }
}
```

Success Response (`200`):

```json
{
  "message": "Heartbeat recorded",
  "userId": 1,
  "lastSeenAt": "2026-01-01T00:00:00.000Z",
  "activeUsers": 42,
  "windowSeconds": 60
}
```

Possible Errors:

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 9) Get Live Active Users

- Method: `GET`
- URL: `/api/activity/live`
- Description: Returns number of active users seen within the provided window.
- Query Params:
- `windowSeconds` (optional, default `60`, max `3600`)

Success Response (`200`):

```json
{
  "activeUsers": 42,
  "windowSeconds": 60
}
```

### 10) Log Participant Event (Common Event API)

- Method: `POST`
- URL: `/api/leaderboard/events`
- Auth: Required (`Bearer token`)
- Description: Logs frontend monitoring events and deducts points.
- Supported event types:
- `out_of_focus`
- `copy_paste`

Request:

```json
{
  "eventType": "copy_paste",
  "metadata": {
    "tabSwitchCount": 1
  }
}
```

Deduction rules:

- `out_of_focus`: `1` point deduction each time.
- `copy_paste`: incremental deduction per user (`1`, then `2`, then `3`, ...).

Success Response (`201`):

```json
{
  "message": "Event logged",
  "eventType": "copy_paste",
  "penaltyPoints": 3
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "eventType must be one of: 'out_of_focus', 'copy_paste'"
}
```

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 11) Log Submission

- Method: `POST`
- URL: `/api/leaderboard/submissions`
- Auth: Required (`Bearer token`)
- Description: Stores a user submission and applies penalties.

Point rules:

- First correct solve for a user + question adds that question's `points` to leaderboard score.
- Repeated correct submissions for the same user + question are **not logged again** and do **not** add points.

Request:

```json
{
  "questionId": 1,
  "languageId": 54,
  "sourceCode": "int main(){ return 0; }",
  "verdict": "Wrong Answer",
  "isCorrect": false
}
```

Deduction rules:

- Wrong submission (`isCorrect = false`): `1` point deduction.
- Illegal code injection detected in `sourceCode`: `5` additional point deduction.

Success Response (`201`):

```json
{
  "message": "Submission logged",
  "submissionId": "123",
  "logged": true,
  "penaltyPoints": 6,
  "pointsAwarded": 0,
  "alreadySolved": false,
  "illegalInjectionDetected": true
}
```

Repeated-correct response (`201`):

```json
{
  "message": "Already solved, submission not logged",
  "submissionId": "123",
  "logged": false,
  "penaltyPoints": 0,
  "pointsAwarded": 0,
  "alreadySolved": true,
  "illegalInjectionDetected": false
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "questionId is required and must be an integer"
}
```

- `400 Bad Request`

```json
{
  "message": "languageId must be an integer"
}
```

- `400 Bad Request`

```json
{
  "message": "sourceCode is required and must be a non-empty string"
}
```

- `400 Bad Request`

```json
{
  "message": "isCorrect must be a boolean"
}
```

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 12) Get Leaderboard

- Method: `GET`
- URL: `/api/leaderboard`
- Auth: Required (`Bearer token`)
- Query Params:
- `limit` (optional, default `50`, max `100`)

Success Response (`200`):

```json
{
  "total": 2,
  "data": [
    {
      "userId": 1,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "score": -4,
      "totalDeductions": 4,
      "copyPasteAttempts": 2,
      "outOfFocusCount": 1,
      "illegalInjectionCount": 0,
      "wrongSubmissionCount": 1
    }
  ]
}
```

### 13) Get My Point Deductions

- Method: `GET`
- URL: `/api/leaderboard/deductions`
- Auth: Required (`Bearer token`)
- Description: Returns deduction history for the logged-in user, including what event/reason caused each deduction.
- Query Params:
- `limit` (optional, default `50`, max `200`)

Success Response (`200`):

```json
{
  "total": 3,
  "data": [
    {
      "source": "event",
      "pointsDeducted": 2,
      "reason": "copy_paste",
      "occurredAt": "2026-01-01T00:00:00.000Z",
      "eventType": "copy_paste",
      "metadata": {
        "tabSwitchCount": 1
      }
    },
    {
      "source": "submission",
      "pointsDeducted": 1,
      "reason": "wrong_submission",
      "occurredAt": "2026-01-01T00:00:00.000Z",
      "submissionId": "55",
      "questionId": 1,
      "verdict": "Wrong Answer"
    }
  ]
}
```

Possible Errors:

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 14) Get My Current Points

- Method: `GET`
- URL: `/api/leaderboard/points`
- Auth: Required (`Bearer token`)
- Description: Returns the current score and key deduction counters for the logged-in user.

Success Response (`200`):

```json
{
  "data": {
    "userId": 1,
    "score": 42,
    "totalDeductions": 8,
    "wrongSubmissionCount": 5,
    "illegalInjectionCount": 0
  }
}
```

Possible Errors:

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 15) Get My Solved Problems By Difficulty

- Method: `GET`
- URL: `/api/leaderboard/solved-by-difficulty`
- Auth: Required (`Bearer token`)
- Description: Returns solved question breakdown by difficulty for the logged-in user.

Success Response (`200`):

```json
{
  "data": {
    "totalSolved": 3,
    "byDifficulty": {
      "easy": {
        "solvedCount": 2,
        "problems": [
          {
            "questionId": 1,
            "title": "Two Sum",
            "slug": "two-sum"
          }
        ]
      },
      "medium": {
        "solvedCount": 1,
        "problems": [
          {
            "questionId": 12,
            "title": "Longest Substring Without Repeating Characters",
            "slug": "longest-substring-without-repeating-characters"
          }
        ]
      },
      "hard": {
        "solvedCount": 0,
        "problems": []
      }
    }
  }
}
```

Possible Errors:

- `401 Unauthorized`

```json
{
  "message": "Unauthorized"
}
```

### 16) Admin Final Leaderboard (Password Protected)

- Method: `POST`
- URL: `/api/leaderboard/admin/final`
- Description: Returns full leaderboard data with detailed user stats.
- Auth: Password in request body.

Request:

```json
{
  "password": "sdhkljf23173089",
  "limit": 200
}
```

- `limit` is optional (default `200`, max `1000`).

Success Response (`200`):

```json
{
  "total": 2,
  "data": [
    {
      "userId": 1,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "registrationNumber": "12345678",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "score": 42,
      "totalDeductions": 8,
      "copyPasteAttempts": 3,
      "outOfFocusCount": 2,
      "fullscreenExitCount": 1,
      "illegalInjectionCount": 0,
      "wrongSubmissionCount": 5,
      "totalSubmissions": 27,
      "totalSolved": 12,
      "lastSubmissionAt": "2026-01-01T10:00:00.000Z",
      "lastCheatAt": "2026-01-01T09:00:00.000Z"
    }
  ]
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "password is required in request body"
}
```

- `403 Forbidden`

```json
{
  "message": "Invalid password"
}
```

### 17) Admin Cheaters Leaderboard (Password Protected)

- Method: `POST`
- URL: `/api/leaderboard/admin/cheaters`
- Description: Returns leaderboard ranked by users with the most cheating attempts.
- Auth: Password in request body.

Request:

```json
{
  "password": "sdhkljf23173089",
  "limit": 100
}
```

- `limit` is optional (default `100`, max `1000`).

Success Response (`200`):

```json
{
  "total": 2,
  "data": [
    {
      "userId": 1,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "copyPasteCount": 4,
      "outOfFocusCount": 3,
      "fullscreenExitCount": 1,
      "illegalInjectionCount": 0,
      "totalCheatAttempts": 8,
      "totalPenaltyPoints": 11,
      "lastCheatAt": "2026-01-01T09:00:00.000Z"
    }
  ]
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "password is required in request body"
}
```

- `403 Forbidden`

```json
{
  "message": "Invalid password"
}
```

### 18) Admin Most Recent Cheater (Password Protected)

- Method: `POST`
- URL: `/api/leaderboard/admin/cheaters/recent`
- Description: Returns the most recent cheating event with user details.
- Auth: Password in request body.

Request:

```json
{
  "password": "sdhkljf23173089"
}
```

Success Response (`200`):

```json
{
  "data": {
    "userId": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "eventType": "copy_paste",
    "penaltyPoints": 3,
    "metadata": {
      "tabSwitchCount": 1
    },
    "occurredAt": "2026-01-01T10:00:00.000Z"
  }
}
```

If no cheating event exists yet:

```json
{
  "data": null
}
```

Possible Errors:

- `400 Bad Request`

```json
{
  "message": "password is required in request body"
}
```

- `403 Forbidden`

```json
{
  "message": "Invalid password"
}
```

### Standalone Table Definitions

Leaderboard table creation SQL is maintained in standalone TypeScript at:

- `src/db/leaderboard.tables.ts`

These queries are definitions only and are not executed automatically by this change.

## Global Error Format

Most error responses follow:

```json
{
  "message": "<error message>"
}
```
