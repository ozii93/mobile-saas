# Multi-Tenant SaaS - Mobile App

Aplikasi mobile berbasis **React Native** dan **Expo Router** untuk platform Multi-Tenant SaaS (POS & Laundry).

## Fitur Utama

- **Multi-Tenant Authentication & Session Coordination**: Menggunakan secure storage dan JWT context resolution.
- **Audience & Context Isolation**: Pemisahan context bisnis (POS / Laundry) secara aman.
- **Offline / Resilience Handling**: Penanganan state transaksi dan sinkronisasi.

## Prasyarat

- Node.js (v18+)
- Expo CLI
- Android Studio / Android SDK (untuk build Android)

## Menjalankan Project

```bash
# Install dependencies
npm install

# Menjalankan Expo development server
npm run start

# Menjalankan di Android emulator / device
npm run android

# Menjalankan typecheck & unit test
npm run typecheck
npm test
```
