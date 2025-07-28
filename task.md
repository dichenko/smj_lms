## 🧠 Technical Summary
Implement a minimal LMS for SMJ LMS using a Telegram bot for students and a web admin interface, both communicating with a shared REST API backend. Data is stored in Cloudflare D1. The system enables student onboarding, lesson progression, report submission, and admin review, with all file handling done via Telegram (no server-side storage).

## 🧱 Key Technical Decisions
- Use Cloudflare D1 (SQLite-compatible) as the primary database for all structured data (students, courses, lessons, reports, admin).
- Expose a REST API backend (deployed on Cloudflare Workers or compatible serverless environment) for both the Telegram bot and web admin interface.
- Telegram bot authenticates students by pre-registered TGID; all bot actions are mapped to REST API endpoints.
- Web admin interface uses session-based authentication (username/password, cookie session) for a single admin account.
- All report files are forwarded directly from the bot to the admin’s Telegram; no file storage or download endpoints on the server.
- Error logs are stored in the database and optionally forwarded to the admin via Telegram.
- All notifications (lesson updates, report review outcomes) are sent via Telegram bot messages.
- Use existing REST API patterns and error handling middleware from SMJ LMS’s codebase for consistency.

## 📊 Schema Changes

| Table                | Columns                                                                                                 |
|----------------------|---------------------------------------------------------------------------------------------------------|
| `admins`             | `id` (UUID, PK), `username` (TEXT, unique), `password_hash` (TEXT)                                      |
| `students`           | `id` (UUID, PK), `tgid` (TEXT, unique), `name` (TEXT), `city` (TEXT), `course_id` (UUID, FK → courses)  |
| `courses`            | `id` (UUID, PK), `title` (TEXT), `description` (TEXT)                                                   |
| `lessons`            | `id` (UUID, PK), `course_id` (UUID, FK → courses), `title` (TEXT), `order` (INTEGER), `content` (TEXT)  |
| `reports`            | `id` (UUID, PK), `student_id` (UUID, FK → students), `lesson_id` (UUID, FK → lessons), `submitted_at` (TIMESTAMP), `status` (TEXT: 'pending', 'approved', 'rejected'), `admin_comment` (TEXT, nullable) |
| `error_logs`         | `id` (UUID, PK), `source` (TEXT), `message` (TEXT), `created_at` (TIMESTAMP), `meta` (JSON)             |


# Telegram Bot Student Interaction & Report Submission
#### User Story  
As a student, I want to interact with a Telegram bot to view my current lesson, track my progress, and submit reports so that I can easily complete my coursework and receive timely feedback.
#### Acceptance Criteria  
1. Students can authenticate with the bot using their pre-registered TGID and receive a welcome message upon onboarding.
2. The bot displays the current active lesson, lesson details, and progress (e.g., "Lesson N of M").
3. Students can submit a report (document) for the current lesson, which is immediately forwarded to the admin’s Telegram with all relevant identifying info (student, city, course, lesson).
4. Students can view a history of submitted reports and their statuses (pending, approved, rejected, with comments if rejected).
5. Students receive Telegram notifications for new lessons and report review outcomes (approved/rejected, with comment if rejected).
6. All interactions are in Russian, and error messages are clear and actionable.
#### Dependencies  
- REST API endpoints for student, lesson, and report management
- Admin onboarding of students via web interface
#### Edge Cases & Handling  
- If a student tries to submit a report for a lesson that is not active, the bot should prevent submission and provide a clear message.
- If a file upload fails or is an unsupported format, the bot should notify the student and prompt for a retry.
- If the student is not found in the system (TGID mismatch), the bot should deny access and provide support contact info.
- If Telegram API fails to forward the file, the bot should retry once and log the error for admin review.





# Web Admin Interface for Course, Student, and Report Management
#### User Story  
As an admin, I want to manage students, courses, lessons, and review submitted reports through a secure web interface so that I can efficiently oversee student progress and provide feedback.
#### Acceptance Criteria  
1. Admin can log in via username/password (single account, session-based authentication).
2. Admin can add, remove, and assign students to courses (TGID, name, city) and manage courses/lessons (create, edit, delete).
3. Admin can view and filter all reports by course, student, or lesson, and see submission history and statuses.
4. Admin can review each report, approve or reject it (with optional comment), and trigger Telegram notifications to students with the result.
5. Admin can view error logs (with filtering) and optionally forward errors to their Telegram.
6. All actions are reflected in the database (Cloudflare D1) and exposed via REST API endpoints.
#### Dependencies  
- REST API endpoints for admin authentication, student/course/lesson/report management, and error logging
- Telegram bot for sending notifications to students
#### Edge Cases & Handling  
- If the admin session expires, redirect to login and preserve unsaved changes where possible.
- If a report is reviewed after a student has already progressed, the system should still notify the student and update the report status/history.
- If a database or API error occurs, display a clear error message and log the incident for admin review.
- If an invalid file/report is referenced, the system should gracefully handle missing data and inform the admin.