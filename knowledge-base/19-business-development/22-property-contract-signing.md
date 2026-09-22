# 22 Property Contract Signing

`CODE VERIFIED`

- `signAcqContract()` in `src/actions/acq-contract.actions.ts`:
  1. Sets `AcqContract.status = SIGNED`.
  2. Stamps `signedAt` and `signedBy`.
  3. Invokes `ensureDealProperty()` to convert deal to `AcqProperty` and `AcqOnboardingProject`.
