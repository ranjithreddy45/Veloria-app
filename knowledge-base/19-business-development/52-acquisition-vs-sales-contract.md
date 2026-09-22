# 52 Acquisition Contract vs Sales Contract

`CODE VERIFIED`

| Feature | Acquisition Contract (`AcqContract`) | Sales Contract (`Contract`) |
|---|---|---|
| Counterparty | Hall Owner / Property Lessor | Event Client / Host |
| Commercial Model | Management Fee % / Revenue Share % | Package Price, Venue Hire Fee |
| Target Asset | `AcqProperty` / `Venue` | `Booking` / `Quote` |
| Versioning Model | `AcqContractVersion` | Single Document Signature |
| Status Enum | `AcqContractStatus` | `ContractStatus` |
