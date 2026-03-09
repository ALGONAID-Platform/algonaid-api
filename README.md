# Algonaid API

Algonaid is a robust Learning Management System (LMS) backend built with NestJS. It provides a comprehensive platform for managing users (Students, Teachers, and Owners), courses, modules, lessons, and student enrollments.

## 🚀 Features

- **Authentication & Authorization**:
  - Secure registration and login using JWT.
  - Role-Based Access Control (RBAC) with three roles: `STUDENT`, `ADMIN` (Teacher), and `OWNER`.
  - Automatic profile creation for Students and Teachers upon registration.
- **Course Management**:
  - CRUD operations for Courses.
  - Organized structure: Courses contain Modules, and Modules contain Lessons.
  - Teachers can manage their own content.
- **Enrollment System**:
  - Students can enroll in courses.
  - Enrollment status tracking (`ACTIVE`, `COMPLETED`, `CANCELLED`).
- **Content Delivery**:
  - Support for video URLs, PDF links, and exam descriptions within lessons.
  - Static file serving for uploads.
- **API Documentation**:
  - Fully documented with Swagger.

## 🛠 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Security**: [Passport JWT](https://docs.nestjs.com/security/authentication), [bcrypt](https://github.com/kelektiv/node.bcrypt.js)
- **Documentation**: [Swagger UI](https://swagger.io/)
- **Validation**: [class-validator](https://github.com/typestack/class-validator)

## 📋 Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose (recommended)
- PostgreSQL (if not using Docker)

## ⚙️ Project Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd algonaid-api
    ```

2.  **Environment Variables**:
    Copy `.env.example` to `.env` and fill in the required values:
    ```bash
    cp .env.example .env
    ```
    Ensure `DATABASE_URL` and `JWT_SECRET` are correctly set.

3.  **Install Dependencies**:
    ```bash
    npm install
    ```

## 🐳 Running with Docker (Recommended)

The easiest way to get started is using Docker Compose, which sets up the API and a PostgreSQL database.

1.  **Environment Variables**:
    Create a `.env` file from the example:
    ```bash
    cp .env.example .env
    ```
    For Docker, use these values in your `.env`:
    ```env
    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres
    POSTGRES_DB=algonaid
    # Note: 'db' is the service name in docker-compose.yml
    DATABASE_URL="postgresql://postgres:postgres@db:5432/algonaid?schema=public"
    JWT_SECRET=your_jwt_secret
    ```

2.  **Start Services**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Database Setup (Inside Container)**:
    Run migrations to create the schema:
    ```bash
    docker-compose exec api npx prisma migrate dev --name init
    ```
    (Optional) Seed the database:
    ```bash
    docker-compose exec api npx prisma db seed
    ```

### 📡 Connection Details
- **API**: `http://localhost:3000/api/v1`
- **Swagger**: `http://localhost:3000/swagger`
- **Database (External access)**: `localhost:5433` (mapped from 5432 inside container)

## 🏃 Running Locally

If you have a local PostgreSQL instance:

1.  **Run Migrations**:
    ```bash
    npx prisma migrate dev
    ```

2.  **Start the Server**:
    ```bash
    # development
    npm run start

    # watch mode (development)
    npm run start:dev

    # production mode
    npm run start:prod
    ```

## 📖 API Documentation

Once the server is running, you can access the interactive Swagger documentation at:
`http://localhost:3000/swagger`

### Key Endpoints
- `POST /api/v1/auth/register`: Register a new user.
- `POST /api/v1/auth/login`: Login and receive a JWT.
- `GET /api/v1/courses`: List all courses.
- `POST /api/v1/enrollment`: Enroll in a course.

## 🏗 Project Structure

```text
src/
├── auth/           # Authentication, JWT, and RBAC guards
├── courses/        # Course management logic
├── modules/        # Course modules (units)
├── lessons/        # Individual lessons with video/PDF content
├── enrollment/     # Student enrollment logic
├── prisma/         # Prisma client and service
├── config/         # Global configurations (Swagger, etc.)
└── uploads/        # Static assets (PDFs, Thumbnails)
```

## 🧪 Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## 📜 License

This project is UNLICENSED.
