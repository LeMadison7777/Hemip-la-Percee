-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'mobile_money', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "AcademicDecisionType" AS ENUM ('PASSAGE', 'PASSAGE_AVEC_DETTES', 'REDOUBLEMENT', 'EXCLUSION', 'DIPLOME', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'PUBLISHED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ThreadKind" AS ENUM ('PRIVATE', 'GROUP', 'CLASS');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'RESTRICTED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'reversed';

-- AlterTable
ALTER TABLE "AcademicDecision" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "changeReason" TEXT,
ADD COLUMN     "decisionType" "AcademicDecisionType",
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "WorkflowStatus",
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- Preserve legacy decision rows and seed their lifecycle timestamp.
UPDATE "AcademicDecision" SET "updatedAt" = "createdAt";

-- AlterTable
ALTER TABLE "AcademicResult" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "enteredById" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "semesterId" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "note" DROP NOT NULL;

-- Keep legacy result fields and translate their existing state into the new workflow.
UPDATE "AcademicResult"
SET "status" = CASE
    WHEN "isPublished" OR "workflow" = 'published' THEN 'PUBLISHED'::"WorkflowStatus"
    WHEN "workflow" = 'validated' THEN 'VERIFIED'::"WorkflowStatus"
    ELSE 'DRAFT'::"WorkflowStatus"
END;

-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Album" SET "updatedAt" = "createdAt";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "semesterId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Attendance" SET "updatedAt" = "createdAt";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "entity" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "fileRef" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "DebtRecord" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "feePlanId" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialStatus" ADD COLUMN     "lastRecalculatedAt" TIMESTAMP(3),
ADD COLUMN     "overrideActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideReason" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "feePlanId" TEXT,
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "receiptFileRef" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "enrollmentDate" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "programBlock" TEXT;

UPDATE "StudentProfile" SET "isActive" = ("deletedAt" IS NULL);

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "specialty" TEXT;

UPDATE "TeacherProfile" SET "isActive" = ("deletedAt" IS NULL);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "coefficient" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programCode" TEXT,
    "level" INTEGER,
    "academicYear" TEXT,
    "tuition" DECIMAL(12,2) NOT NULL,
    "registration" DECIMAL(12,2) NOT NULL DEFAULT 50000,
    "reEnrollment" DECIMAL(12,2) NOT NULL DEFAULT 45000,
    "examFee" DECIMAL(12,2) NOT NULL DEFAULT 30000,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileRef" TEXT,
    "checksum" TEXT,
    "importedById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "previewJson" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccessOverride" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "financialStatusId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fileRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccessOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "altText" TEXT,
    "usageRights" TEXT NOT NULL DEFAULT 'school_owned',
    "sourceUrl" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HemipAlbumMedia" (
    "albumId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,

    CONSTRAINT "HemipAlbumMedia_pkey" PRIMARY KEY ("albumId","mediaId")
);

-- CreateTable
CREATE TABLE "TeacherAttendance" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionAt" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "reason" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIpHash" TEXT,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "cohort" TEXT,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "targetProgramCode" TEXT,
    "targetLevel" INTEGER,
    "targetCohort" TEXT,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "kind" "ThreadKind" NOT NULL,
    "title" TEXT,
    "programCode" TEXT,
    "cohort" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadParticipant" (
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreEnrolledAccount" (
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreEnrolledAccount_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "OtpRateLimit" (
    "keyHash" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpRateLimit_pkey" PRIMARY KEY ("keyHash")
);

-- CreateTable
CREATE TABLE "StoredDocument" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_programCode_level_idx" ON "Course"("programCode", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_programCode_level_key" ON "Course"("code", "programCode", "level");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");

-- CreateIndex
CREATE INDEX "Semester_isPublished_publishedAt_idx" ON "Semester"("isPublished", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicYearId_label_key" ON "Semester"("academicYearId", "label");

-- CreateIndex
CREATE INDEX "FeePlan_programCode_level_isActive_idx" ON "FeePlan"("programCode", "level", "isActive");

-- CreateIndex
CREATE INDEX "PaymentImportBatch_importedById_createdAt_idx" ON "PaymentImportBatch"("importedById", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentImportBatch_status_createdAt_idx" ON "PaymentImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccessOverride_studentId_active_expiresAt_idx" ON "FinancialAccessOverride"("studentId", "active", "expiresAt");

-- CreateIndex
CREATE INDEX "Media_type_visibility_uploadedAt_idx" ON "Media"("type", "visibility", "uploadedAt");

-- CreateIndex
CREATE INDEX "HemipAlbumMedia_mediaId_idx" ON "HemipAlbumMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "HemipAlbumMedia_albumId_sortOrder_key" ON "HemipAlbumMedia"("albumId", "sortOrder");

-- CreateIndex
CREATE INDEX "TeacherAttendance_teacherId_sessionAt_status_idx" ON "TeacherAttendance"("teacherId", "sessionAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAttendance_teacherId_sessionAt_key" ON "TeacherAttendance"("teacherId", "sessionAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_identifierHash_expiresAt_consumedAt_idx" ON "OtpChallenge"("identifierHash", "expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "ScheduleSlot_programCode_level_cohort_weekday_startsAt_idx" ON "ScheduleSlot"("programCode", "level", "cohort", "weekday", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleSlot_teacherId_weekday_startsAt_idx" ON "ScheduleSlot"("teacherId", "weekday", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleSlot_room_weekday_startsAt_idx" ON "ScheduleSlot"("room", "weekday", "startsAt");

-- CreateIndex
CREATE INDEX "Announcement_status_publishedAt_expiresAt_idx" ON "Announcement"("status", "publishedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_targetProgramCode_targetLevel_targetCohort_idx" ON "Announcement"("targetProgramCode", "targetLevel", "targetCohort");

-- CreateIndex
CREATE INDEX "MessageThread_kind_programCode_cohort_idx" ON "MessageThread"("kind", "programCode", "cohort");

-- CreateIndex
CREATE INDEX "MessageThread_updatedAt_idx" ON "MessageThread"("updatedAt");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_leftAt_idx" ON "ThreadParticipant"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "PreEnrolledAccount_role_isActive_idx" ON "PreEnrolledAccount"("role", "isActive");

-- CreateIndex
CREATE INDEX "OtpRateLimit_windowStartedAt_idx" ON "OtpRateLimit"("windowStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredDocument_objectKey_key" ON "StoredDocument"("objectKey");

-- CreateIndex
CREATE INDEX "StoredDocument_uploadedById_createdAt_idx" ON "StoredDocument"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "AcademicDecision_studentId_academicYearId_status_idx" ON "AcademicDecision"("studentId", "academicYearId", "status");

-- CreateIndex
CREATE INDEX "AcademicDecision_status_publishedAt_idx" ON "AcademicDecision"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "AcademicResult_studentId_academicYearId_status_idx" ON "AcademicResult"("studentId", "academicYearId", "status");

-- CreateIndex
CREATE INDEX "AcademicResult_courseId_semesterId_status_idx" ON "AcademicResult"("courseId", "semesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicResult_studentId_courseId_semesterId_key" ON "AcademicResult"("studentId", "courseId", "semesterId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Album_published_publishedAt_idx" ON "Album"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "Attendance_studentId_sessionDate_status_idx" ON "Attendance"("studentId", "sessionDate", "status");

-- CreateIndex
CREATE INDEX "Attendance_courseId_sessionDate_idx" ON "Attendance"("courseId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_courseId_sessionDate_key" ON "Attendance"("studentId", "courseId", "sessionDate");

-- CreateIndex
CREATE INDEX "AuditLog_entity_targetId_timestamp_idx" ON "AuditLog"("entity", "targetId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "DebtRecord_studentId_settledAt_dueAt_idx" ON "DebtRecord"("studentId", "settledAt", "dueAt");

-- CreateIndex
CREATE INDEX "FinancialStatus_clearedForResults_balanceDue_idx" ON "FinancialStatus"("clearedForResults", "balanceDue");

-- CreateIndex
CREATE INDEX "Payment_studentId_status_paidAt_idx" ON "Payment"("studentId", "status", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_method_reference_key" ON "Payment"("method", "reference");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_filiere_yearLevel_idx" ON "StudentProfile"("filiere", "yearLevel");

-- CreateIndex
CREATE INDEX "StudentProfile_cohort_idx" ON "StudentProfile"("cohort");

-- CreateIndex
CREATE INDEX "TeacherProfile_isActive_idx" ON "TeacherProfile"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "PaymentImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessOverride" ADD CONSTRAINT "FinancialAccessOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessOverride" ADD CONSTRAINT "FinancialAccessOverride_financialStatusId_fkey" FOREIGN KEY ("financialStatusId") REFERENCES "FinancialStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessOverride" ADD CONSTRAINT "FinancialAccessOverride_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRecord" ADD CONSTRAINT "DebtRecord_feePlanId_fkey" FOREIGN KEY ("feePlanId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResult" ADD CONSTRAINT "AcademicResult_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDecision" ADD CONSTRAINT "AcademicDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDecision" ADD CONSTRAINT "AcademicDecision_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicDecision" ADD CONSTRAINT "AcademicDecision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemipAlbumMedia" ADD CONSTRAINT "HemipAlbumMedia_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HemipAlbumMedia" ADD CONSTRAINT "HemipAlbumMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAttendance" ADD CONSTRAINT "TeacherAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredDocument" ADD CONSTRAINT "StoredDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
