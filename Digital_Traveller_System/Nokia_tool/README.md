# VijayTools - Enterprise PWA

A high-performance, Enterprise-grade React Progressive Web App (PWA) for product management with RFID scanning capabilities.

## Features

- **6 Station Workflow**: Registration → Diagnosis → Repair → QC → Dashboard → Detach
- **RFID Integration**: Global RFID listener that detects scans automatically
- **Real-time Dashboard**: Live Firestore sync with instant updates
- **Excel Export**: Export individual products or full collection
- **Optimistic UI**: Instant visual feedback for all operations
- **Futuristic Design**: Glassmorphism effects with deep blue palette

## Tech Stack

- **React** (Vite)
- **Tailwind CSS**
- **Firebase Firestore**
- **React Router DOM**
- **Recharts** (Dashboard graphs)
- **XLSX** (Excel export)
- **Lucide React** (Icons)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Open `src/firebase.js`
2. Replace the placeholder values with your Firebase project credentials:
   - `apiKey`: Your Firebase API key
   - `authDomain`: Your Firebase auth domain
   - `projectId`: Your Firebase project ID
   - `storageBucket`: Your Firebase storage bucket
   - `messagingSenderId`: Your Firebase messaging sender ID
   - `appId`: Your Firebase app ID

### 3. Firestore Schema

The app uses a `products` collection with the following document structure:

```javascript
{
  uid: string,              // Unique identifier (RFID UID)
  status: string,            // 'Registered', 'Diagnosed', 'Repaired', 'QC_Passed', 'QC_Failed'
  customerName: string,
  productSN: string,
  warranty: boolean,
  entryDate: Timestamp,
  productName: string,
  diagnosis: {
    faultType: string,
    description: string
  },
  repairParts: string[],    // Array of component names
  repairActions: string,
  qcStatus: string,          // 'QC_Passed' or 'QC_Failed'
  logs: array               // Array of action logs with timestamps
}
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

## RFID Scanner Setup

The app includes a global RFID listener that works by detecting rapid keyboard input:
- If >3 characters are typed in <50ms and end with 'Enter', it's treated as an RFID scan
- The scanner status is shown in the header (green when active)

## Station Workflow

1. **Station 1 (Registration)**: Register new products with customer details
2. **Station 2 (Diagnosis)**: Diagnose faults and update product status
3. **Station 3 (Repair)**: Record repair actions and replaced components
4. **Station 4 (QC)**: Quality check with pass/fail and Excel export
5. **Station 5 (Dashboard)**: Real-time overview with charts and full export
6. **Station 6 (Detach)**: Remove/reset products that passed QC

## Performance Features

- **Optimistic UI Updates**: UI updates immediately before Firestore operations complete
- **Real-time Sync**: Dashboard uses Firestore `onSnapshot` for instant updates
- **Efficient Rendering**: React best practices for minimal re-renders

## License

Private - Enterprise Use
