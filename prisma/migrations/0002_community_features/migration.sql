-- Community stories, likes and role-targeted announcement delivery.

ALTER TABLE "Announcement"
ADD COLUMN "targetRole" "Role";

CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "showAuthorName" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TestimonialLike" (
    "testimonialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestimonialLike_pkey" PRIMARY KEY ("testimonialId", "userId")
);

CREATE INDEX "Announcement_targetRole_status_publishedAt_idx"
ON "Announcement"("targetRole", "status", "publishedAt");
CREATE INDEX "Testimonial_authorId_createdAt_idx"
ON "Testimonial"("authorId", "createdAt");
CREATE INDEX "TestimonialLike_userId_createdAt_idx"
ON "TestimonialLike"("userId", "createdAt");

ALTER TABLE "Testimonial"
ADD CONSTRAINT "Testimonial_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestimonialLike"
ADD CONSTRAINT "TestimonialLike_testimonialId_fkey"
FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestimonialLike"
ADD CONSTRAINT "TestimonialLike_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
