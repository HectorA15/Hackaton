# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer {your_jwt_token}
```

## Endpoints

### Auth Endpoints

#### POST /auth/login

Login to get JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### POST /auth/register

Create new user (Admin only).

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Request:**
```json
{
  "username": "newuser",
  "password": "securepass",
  "role": "worker"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "userId": 2
}
```

## Error Responses

All endpoints may return error responses:

**400 Bad Request:**
```json
{
  "error": "Missing required fields"
}
```

**401 Unauthorized:**
```json
{
  "error": "Invalid token"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```
