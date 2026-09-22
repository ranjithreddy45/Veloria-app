# 04 Employee Master Data Model

## Prisma Schema: `Employee`

```prisma
model Employee {
  id                 String            @id @default(cuid())
  empCode            String            @unique
  firstName          String
  lastName           String
  personalEmail      String?
  workEmail          String?
  phone              String?
  dob                DateTime?
  gender             String?
  photoUrl           String?
  userId             String?           @unique
  user               User?             @relation("EmployeeUser", fields: [userId], references: [id])
  departmentId       String?
  department         Department?       @relation(fields: [departmentId], references: [id])
  designationId      String?
  designation        HrDesignation?    @relation(fields: [designationId], references: [id])
  employmentType     EmploymentType    @default(FULL_TIME)
  dateOfJoining      DateTime?
  dateOfExit         DateTime?
  workLocation       String?
  status             EmployeeStatus    @default(ONBOARDING)
  reportingManagerId String?
  reportingManager   Employee?         @relation("EmployeeReports", fields: [reportingManagerId], references: [id])
  reports            Employee[]        @relation("EmployeeReports")
  deletedAt          DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @default(now()) @updatedAt
}
```
