# 06 Recruitment Database Models

`SCHEMA VERIFIED`

## 1. `RecJobOpening`
- `id`: CUID (Primary Key)
- `entityId`: String (Default "BILLION")
- `postingTitle`: String
- `department`: String?
- `city`: String?
- `hiringManagerId`: String? (User ID)
- `assignedRecruiterId`: String? (User ID)
- `targetDate`: DateTime?
- `status`: `RecJobStatus` (Default `IN_PROGRESS`)
- `numberOfPositions`: Int (Default 1)
- `description`: Text?
- `filledAt`: DateTime?
- `createdById`: String?
- `createdAt`, `updatedAt`: Timestamps

## 2. `RecCandidate`
- `id`: CUID (Primary Key)
- `entityId`: String (Default "BILLION")
- `firstName`, `lastName`: String
- `email`: String?
- `phone`: String?
- `city`: String?
- `source`: String? (Direct, Referral, Career site, LinkedIn)
- `rating`: Int (Default 0, 0-5)
- `stage`: `RecCandidateStage` (Default `NEW`)
- `ownerId`: String? (User ID)
- `resumeUrl`: Text?
- `notes`: Text?
- `createdById`: String?
- `createdAt`, `updatedAt`: Timestamps

## 3. `RecApplication`
- `id`: CUID (Primary Key)
- `candidateId`: String (FK -> `RecCandidate.id` ON DELETE Cascade)
- `jobOpeningId`: String (FK -> `RecJobOpening.id` ON DELETE Cascade)
- `stage`: `RecAppStage` (Default `SCREENING`)
- `rating`: Int (Default 0)
- `createdById`: String?
- `createdAt`, `updatedAt`: Timestamps
- `@@unique([candidateId, jobOpeningId])`

## 4. `RecInterview`
- `id`: CUID (Primary Key)
- `candidateId`: String
- `applicationId`: String?
- `round`: String (Phone, Technical, HR, Final)
- `mode`: String (Default "VIDEO" - IN_PERSON, VIDEO, PHONE)
- `scheduledAt`: DateTime
- `interviewerId`: String? (User ID)
- `status`: `RecInterviewStatus` (Default `SCHEDULED`)
- `rating`: Int (Default 0, 0-5)
- `feedback`: Text?
- `createdById`: String?
- `createdAt`: DateTime

## 5. `RecOffer`
- `id`: CUID (Primary Key)
- `candidateId`: String
- `jobOpeningId`: String?
- `ctc`: Decimal(18, 2)
- `joiningDate`: DateTime?
- `status`: `RecOfferStatus` (Default `DRAFT`)
- `notes`: Text?
- `createdById`: String?
- `createdAt`: DateTime

## 6. `RecBgvCheck`
- `id`: CUID (Primary Key)
- `candidateId`: String
- `type`: String (IDENTITY, EDUCATION, EMPLOYMENT, CRIMINAL, ADDRESS, REFERENCE)
- `status`: String (Default "PENDING" - PENDING, IN_PROGRESS, CLEARED, FLAGGED, FAILED)
- `vendor`: String?
- `requestedAt`: DateTime (Default now)
- `completedAt`: DateTime?
- `remarks`: String?
- `attachmentUrl`: Text?
- `createdById`: String?
- `updatedAt`: DateTime
