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

### 5) Live JSON Docs

- Method: `GET`
- URL: `/api/docs`
- Description: Returns endpoint docs in JSON.
