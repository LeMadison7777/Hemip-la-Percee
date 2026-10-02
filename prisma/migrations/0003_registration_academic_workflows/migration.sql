-- Account onboarding, staff approval, schedule publication and result summaries.
ALTER TYPE "Role" ADD VALUE 'evaluation_manager';

CREATE TYPE "AccountStatus" AS ENUM ('PENDING_EMAIL', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED');
CREATE TYPE "RegistrationProfile" AS ENUM ('STUDENT', 'TEACHER', 'ADMINISTRATIVE');
CREATE TYPE "StudentDocumentType" AS ENUM ('IDENTITY', 'PREVIOUS_DIPLOMA', 'OTHER');
CREATE TYPE "DocumentReviewStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "EvaluationOutcome" AS ENUM ('ADMITTED', 'FAILED', 'RESIT');

ALTER TABLE "User"
  ADD COLUMN "registrationStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "registrationProfile" "RegistrationProfile",
  ADD COLUMN "requestedProgramCode" TEXT,
  ADD COLUMN "requestedLevel" INTEGER;

ALTER TABLE "StudentProfile"
  ALTER COLUMN "matricule" DROP NOT NULL,
  ALTER COLUMN "academicYear" DROP NOT NULL;

ALTER TABLE "Course"
  ADD COLUMN "credits" DECIMAL(4,1) NOT NULL DEFAULT 0;

ALTER TABLE "AcademicResult"
  ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "ScheduleSlot"
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "publishedById" TEXT;

CREATE INDEX "ScheduleSlot_isPublished_programCode_level_weekday_startsAt_idx"
  ON "ScheduleSlot"("isPublished", "programCode", "level", "weekday", "startsAt");

ALTER TABLE "ScheduleSlot"
  ADD CONSTRAINT "ScheduleSlot_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoredDocument"
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "documentType" "StudentDocumentType",
  ADD COLUMN "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "StoredDocument_studentId_documentType_reviewStatus_idx"
  ON "StoredDocument"("studentId", "documentType", "reviewStatus");

ALTER TABLE "StoredDocument"
  ADD CONSTRAINT "StoredDocument_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StoredDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ResultSummary" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "semesterId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "academicYearLabel" TEXT NOT NULL,
  "semesterLabel" TEXT NOT NULL,
  "weightedAverage" DECIMAL(5,2) NOT NULL,
  "creditsEarned" DECIMAL(6,1) NOT NULL,
  "creditsTotal" DECIMAL(6,1) NOT NULL,
  "outcome" "EvaluationOutcome" NOT NULL,
  "policyNote" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedById" TEXT NOT NULL,
  CONSTRAINT "ResultSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResultSummary_studentId_semesterId_key"
  ON "ResultSummary"("studentId", "semesterId");
CREATE INDEX "ResultSummary_studentId_publishedAt_idx"
  ON "ResultSummary"("studentId", "publishedAt");
CREATE INDEX "ResultSummary_outcome_publishedAt_idx"
  ON "ResultSummary"("outcome", "publishedAt");

ALTER TABLE "ResultSummary"
  ADD CONSTRAINT "ResultSummary_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ResultSummary_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ResultSummary_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ResultSummary_publishedById_fkey"
  FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
