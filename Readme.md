# File Upload Service - API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [Environment Variables](#environment-variables)
4. [API Endpoints](#api-endpoints)
   - [Register User](#register-user)
   - [Login User](#login-user)
   - [Upload File](#upload-file)
   - [Download File](#download-file)
   - [Delete File](#delete-file)
   - [List Files](#list-files)
   - [Update File Metadata](#update-file-metadata)
5. [Development Configuration](#development-configuration)
6. [Error Handling](#error-handling)

## Overview
This is a Node.js-based file upload service that supports file uploads, metadata storage, user authentication, and file search. The service can store files locally or in AWS S3, depending on configuration.

## Setup Instructions
1. Clone the repository.
   ```bash
   git clone <repository_url>
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up your `.env` file with the necessary environment variables.
5. Start the server:
   ```bash
   node app.js
   ```
    or

   ```bash
   nodemon app.js
   ```

## Environment Variables
Create a `.env` file in the root directory with the following keys:

| Key                     | Description                                  |
|-------------------------|----------------------------------------------|
| `PORT`                 | Port for the application (default: 3000)    |
| `JWT_SECRET`           | Secret key for JWT token generation         |
| `STORAGE_TYPE`         | `local` or `s3` for file storage            |
| `AWS_ACCESS_KEY_ID`    | AWS access key ID                           |
| `AWS_SECRET_ACCESS_KEY`| AWS secret access key                       |
| `AWS_REGION`           | AWS region for S3 bucket                   |
| `AWS_S3_BUCKET`        | Name of the S3 bucket                      |

## API Endpoints
### 1. Register User
**Endpoint:** `POST /register`

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string"
}
```

**Response:**
- **201:**
  ```json
  {
    "message": "User registered successfully"
  }
  ```
- **400:**
  ```json
  {
    "error": "Error registering user : <details>"
  }
  ```

### 2. Login User
**Endpoint:** `POST /login`

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
- **200:**
  ```json
  {
    "token": "string"
  }
  ```
- **401:**
  ```json
  {
    "error": "Invalid credentials"
  }
  ```

### 3. Upload File
**Endpoint:** `POST /upload`

**Headers:**
```json
{
  "Authorization": "Bearer <JWT Token>"
}
```

**Form Data:**
- `file` (file): The file to upload
- `description` (string): Description of the file
- `tags` (string): Comma-separated tags
- `isPublic` (boolean): Whether the file is public or not

**Response:**
- **201:**
  ```json
  {
    "message": "File uploaded successfully",
    "file": { <file metadata> }
  }
  ```
- **400:**
  ```json
  {
    "error": "No file uploaded"
  }
  ```

### 4. Download File
**Endpoint:** `GET /download/:id`

**Response:**
- File download starts.
- **404:**
  ```json
  {
    "error": "File not found"
  }
  ```
- **403:**
  ```json
  {
    "error": "Access denied"
  }
  ```

### 5. Delete File
**Endpoint:** `DELETE /delete/:id`

**Headers:**
```json
{
  "Authorization": "Bearer <JWT Token>"
}
```

**Response:**
- **200:**
  ```json
  {
    "message": "File deleted successfully"
  }
  ```
- **404:**
  ```json
  {
    "error": "File not found"
  }
  ```
- **403:**
  ```json
  {
    "error": "Access denied"
  }
  ```

### 6. List Files
**Endpoint:** `GET /files`

**Headers:**
```json
{
  "Authorization": "Bearer <JWT Token>"
}
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Number of files per page (default: 10)
- `search` (string): Search text
- `tag` (string): Filter by tag
- `type` (string): Filter by file type
- `sortBy` (string): Sort field (default: `uploadDate`)
- `sortOrder` (string): Sort order (`asc` or `desc`, default: `desc`)

**Response:**
- **200:**
  ```json
  {
    "files": [<list of file objects>],
    "currentPage": 1,
    "totalPages": 2,
    "totalFiles": 20
  }
  ```

### 7. Update File Metadata
**Endpoint:** `PATCH /files/:id`

**Headers:**
```json
{
  "Authorization": "Bearer <JWT Token>"
}
```

**Request Body:**
```json
{
  "description": "string",
  "tags": ["string"],
  "isPublic": true
}
```

**Response:**
- **200:**
  ```json
  {
    "message": "File updated successfully",
    "file": { <updated file metadata> }
  }
  ```
- **404:**
  ```json
  {
    "error": "File not found"
  }
  ```
- **403:**
  ```json
  {
    "error": "Access denied"
  }
  ```

## Development Configuration
- Node.js version: `>=14.x`
- MongoDB: `>=4.x`
- AWS S3 Bucket for file storage (optional).

## Error Handling
Common error responses include:
- **400:** Bad request (e.g., invalid file type, missing data).
- **401:** Unauthorized access (e.g., missing/invalid JWT token).
- **403:** Forbidden access (e.g., trying to delete another user's file).
- **404:** Resource not found (e.g., file or user not found).
- **500:** Internal server error.

## Deployment
- **Primary URL:** [Deployed Service Without S3 bucket](https://primary-url.com)
- **Backup URL:** [Deployed Service With S3 Bucket](https://backup-url.com)

