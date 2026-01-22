# Construction Progress Visualization Platform

A Next.js web application that processes Hebrew PDF construction progress reports and presents visualizations for developers/investors tracking the TAMA 38/2 urban renewal project at Mosinzon 5, Tel Aviv.

## Features

- **Dashboard**: Overall progress %, apartment grid, category stats, recent defects
- **Timeline**: Gantt-style view of progress across reports over time
- **Apartments**: Grid view of all apartments with progress indicators
- **Reports**: List of all processed reports with date filtering

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **PDF Processing**: Claude API (Vision)

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key (for PDF processing)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Anthropic API key:
   ```
   DATABASE_URL="file:./dev.db"
   ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. Initialize the database:
   ```bash
   npx prisma db push
   ```

### Processing PDFs

1. Place PDF reports in `data/pdfs/` directory
2. Run the processing script:
   ```bash
   npm run process-pdfs
   ```

   Or test the Claude API connection first:
   ```bash
   npm run process-pdfs:test
   ```

### Running the Application

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── data/pdfs/              # PDF reports (place files here)
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── dev.db              # SQLite database
├── scripts/
│   └── process-pdfs.ts     # Batch PDF processing script
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   ├── apartments/     # Apartment pages
│   │   ├── reports/        # Reports page
│   │   └── timeline/       # Timeline page
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui components
│   │   └── charts/         # Chart components
│   └── lib/                # Utilities
│       ├── db.ts           # Prisma client
│       ├── claude.ts       # Claude API client
│       ├── pdf-processor.ts # PDF processing logic
│       └── status-mapper.ts # Hebrew status/category mapping
```

## Tracked Apartments

The system tracks 8 apartments: 1, 3, 5, 6, 7, 10, 11, 14

## Work Categories

- Electrical (חשמל)
- Plumbing (אינסטלציה)
- Air Conditioning (מיזוג אויר)
- Entry Door (דלת כניסה)
- Sanitary (סניטריה)
- Flooring (ריצוף)
- Tiling (חיפוי)
- Sprinklers (ספרינקלרים)
- Waterproofing (איטום)
- Painting (צביעה)
- Windows (חלונות)
- Kitchen (מטבח)
- Development (פיתוח)

## Status Types

- Completed (בוצע)
- Completed OK (בוצע - תקין)
- Not OK (לא תקין)
- Defect (ליקוי)
- In Progress (בטיפול)
- Handled (טופל)
- Pending (ממתין)

## License

Private - for authorized use only.
