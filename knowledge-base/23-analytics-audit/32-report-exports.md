# 32 Report Exports & File Format Engine

`CODE VERIFIED`

## File Export Infrastructure

- **PDF Generation**: Server-side PDF rendering via Puppeteer/HTML-to-PDF (`/api/hr/payslips/[id]/pdf`, `/api/quotations/[id]/pdf`, `/api/bd/contracts/[id]/pdf`).
- **Excel / CSV Exports**: Streamed directly using `xlsx` / `json2csv` libraries (`/api/draw/export`, `/people/reports/*`).
- **Tally XML Engine**: Converts GL journal batches into Tally Prime compatibility schema (`/finance/reports/tally`).
