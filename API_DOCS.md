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

## Global Error Format

Most error responses follow:

```json
{
  "message": "<error message>"
}
```
