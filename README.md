# Algonaid API

Algonaid is a robust Learning Management System (LMS) backend built with NestJS. It provides a comprehensive platform for managing users (Students, Teachers, and Owners), courses, modules, lessons, and student enrollments.

## 🚀 Features

- **Authentication & Authorization**:
  - Secure registration and login using JWT.
  - **Google OAuth 2.0 Integration**: Single-click login for students.
  - Role-Based Access Control (RBAC) with three roles: `STUDENT`, `ADMIN` (Teacher), and `OWNER`.
  - Automatic profile creation for Students and Teachers upon registration.
- **Course Management**:
  - CRUD operations for Courses.
  - Organized structure: Courses contain Modules, and Modules contain Lessons.
  - Teachers can manage their own content.
- **Enrollment System**:
  - Students can enroll in courses.
  - Enrollment status tracking (`ACTIVE`, `COMPLETED`, `CANCELLED`).
- **Exam Flow**:
  - Automatic grading logic for multiple-choice and true/false questions.
  - Attempt management (limits per student per exam).
  - Detailed results review showing correct vs. selected answers.
- **Progress Tracking**:
  - Track lesson completion status for each student.
  - Real-time calculation of course progress percentage.
- **Secure Session Management**:
  - Logout functionality with JWT blacklisting for immediate token invalidation.
- **Content Delivery**:
  - Support for video URLs, PDF links, and exam descriptions within lessons.
  - **PDF Upload**: Teachers can upload educational PDF materials directly to lessons.
  - **Static file serving** for uploads.

  ## 📝 Exams Module

  The Exams module allows for automated student assessment.

  ### 🏫 For Teachers (ADMIN/OWNER)
  Teachers can manage exams linked to lessons.
  - **Create**: `POST /exams` - Define title, passing score, and all questions with multiple options.
  - **Update**: `PATCH /exams/:id` - Update metadata or replace all questions.
  - **Delete**: `DELETE /exams/:id` - Completely remove an exam.

  *Note: A teacher can only manage exams for courses they instruct.*

  ### 🎓 For Students (STUDENT)
  Students can take exams to validate their learning.
  - **Start**: `POST /exams/:id/start` - Creates an attempt (if within limits).
  - **Submit**: `POST /exams/attempts/:id/submit` - Grades the attempt instantly.
  - **Result**: `GET /exams/attempts/:id/result` - Review score and correct answers.

  ## 📁 Testing PDF Uploads


The API supports PDF uploads for lessons. You can test this using **Swagger** or **Postman**:

### 1. Using Swagger (Recommended)
1.  Navigate to `http://localhost:3000/swagger`.
2.  Go to the **`lessons`** section and open `POST /api/v1/lessons`.
3.  Click **"Try it out"**.
4.  Fill in the required fields (`title`, `moduleId`, etc.).
5.  In the **`pdf`** field, click **"Choose File"** and select a `.pdf` file from your computer.
6.  Click **"Execute"**.
7.  The response will include a `pdfUrl` (e.g., `uploads/lesson-pdf-12345.pdf`).

### 2. Accessing Uploaded Files
Once a file is uploaded, it is served statically and can be accessed via:
`http://localhost:3000/uploads/your-file-name.pdf`

*Note: Ensure you are logged in as a user with `ADMIN` (Teacher) or `OWNER` roles and provide the Bearer token in Swagger's **Authorize** section.*

## 🔐 Google OAuth Setup

To enable Google Login, follow these steps:

1.  **Google Cloud Console**:
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).
    - Create a new project or select an existing one.
    - Go to **APIs & Services > Credentials**.
    - Click **Create Credentials > OAuth client ID**.
    - Set the Application type to **Web application**.
    - Add **Authorized redirect URIs**:
      `http://localhost:3000/api/v1/auth/google/callback`
    - Copy your **Client ID** and **Client Secret**.

2.  **Environment Variables**:
    Add the following keys to your `.env` file:
    ```env
    GOOGLE_CLIENT_ID=your_client_id_here
    GOOGLE_CLIENT_SECRET=your_client_secret_here
    GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
    ```

3.  **How to Use**:
    - Visit `http://localhost:3000/api/v1/auth/google` in your browser.
    - Login with your Google account.
    - You will be redirected back with a JSON response containing your user info and a **JWT Access Token**.

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
- **Authentication**:
  - `POST /api/v1/auth/signup`: Register a new user.
  - `POST /api/v1/auth/signin`: Login and receive a JWT.
  - `POST /api/v1/auth/logout`: Securely logout and invalidate token.
- **Learning & Progress**:
  - `GET /api/v1/courses`: List all courses.
  - `POST /api/v1/enrollment`: Enroll in a course.
  - `POST /api/v1/progress/lesson/:id/complete`: Mark a lesson as finished.
  - `GET /api/v1/progress/course/:id`: Get course progress percentage.
- **Exams**:
  - `POST /api/v1/exams/:id/start`: Start a new exam attempt.
  - `POST /api/v1/exams/attempts/:id/submit`: Submit answers for grading.
  - `GET /api/v1/exams/attempts/:id/result`: View detailed exam results.

### 🏗 Project Structure


```text
src/
├── auth/           # Authentication, JWT, and RBAC guards
├── courses/        # Course management logic
├── modules/        # Course modules (units)
├── lessons/        # Individual lessons with video/PDF content
├── enrollment/     # Student enrollment logic
├── exams/          # Exam lifecycle, grading, and results
├── progress/       # Lesson and course progress tracking
├── prisma/         # Prisma client and service
├── config/         # Global configurations (Swagger, etc.)
└── utils/          # Constants, types, and helper messages
```

*Note: The `uploads/` folder is located at the root level for storing static assets.*

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
