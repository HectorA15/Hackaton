# Inventory Expiry Tracker

A comprehensive web application for tracking product inventory with barcode/QR code scanning, expiry date management, and offline sync capabilities.

## Features

- **Barcode/QR Code Scanning**: Scan product barcodes and QR codes to quickly add items to inventory
- **External API Integration**: Auto-complete product data from external APIs (Open Food Facts)
- **Batch Management**: Group products by batch and lot numbers
- **Expiry Tracking**: Automatically track and prioritize products by expiry date
- **Offline Support**: Sync operations work offline with conflict resolution
- **RBAC Authentication**: Role-based access control (Admin, Manager, Worker)
- **Audit Logs**: Complete audit trail of all operations
- **Photo Uploads**: Attach label photos to inventory items
- **CSV Export**: Export inventory data to CSV format
- **Simple UI**: Worker-friendly interface for efficient operations

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: SQLite (portable and easy to setup)
- **Frontend**: Vanilla JavaScript with HTML/CSS
- **Authentication**: JWT-based with bcrypt password hashing
- **Security**: Helmet.js, rate limiting, CORS

## Installation

1. Clone the repository:
```bash
git clone https://github.com/HectorA15/Hackaton.git
cd Hackaton
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize database:
```bash
npm run migrate
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### First Time Setup

1. The database migration will create all necessary tables
2. Create an admin user by directly inserting into the database or through the API
3. Login with admin credentials to create additional users

### Creating Users

Admin users can create new users through the `/api/auth/register` endpoint:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "worker1",
    "password": "password123",
    "role": "worker"
  }'
```

### User Roles

- **Admin**: Full access to all features including user management
- **Manager**: Access to inventory management and reports
- **Worker**: Basic access to scan items and view inventory

### Scanning Items

1. Navigate to the Scan tab
2. Enter barcode or QR code (or use camera for scanning)
3. Select the batch ID
4. Add location and notes if needed
5. Submit to add to inventory

### Product Lookup

Products can be looked up by GTIN/barcode. The system will:
1. Check local database first
2. If not found, query external API (Open Food Facts)
3. Save the product to local database for future use

### Batch Management

Batches are automatically sorted by expiry date. Priority levels are calculated based on:
- Priority 3: Less than 7 days to expiry
- Priority 2: 7-30 days to expiry
- Priority 1: 30-90 days to expiry
- Priority 0: More than 90 days to expiry

### CSV Export

Export inventory data from the Inventory tab. Filter by status before exporting:
- In Stock
- Shipped
- Expired
- Damaged

### Audit Logs

Admins and Managers can view complete audit logs of all operations including:
- User actions
- Entity changes
- Timestamps
- IP addresses

## API Documentation

### Authentication

#### Login
```
POST /api/auth/login
Body: { "username": "user", "password": "pass" }
Response: { "token": "jwt_token", "user": {...} }
```

#### Get Current User
```
GET /api/auth/me
Header: Authorization: Bearer {token}
Response: { "id": 1, "username": "user", "role": "worker" }
```

### Products

#### List Products
```
GET /api/products?limit=100&offset=0
Header: Authorization: Bearer {token}
```

#### Lookup Product by GTIN
```
GET /api/products/lookup/:gtin
Header: Authorization: Bearer {token}
```

#### Create Product
```
POST /api/products
Header: Authorization: Bearer {token}
Body: { "gtin": "1234567890", "name": "Product Name", ... }
```

### Batches

#### List Batches
```
GET /api/batches?expired=false&limit=100
Header: Authorization: Bearer {token}
```

#### Create Batch
```
POST /api/batches
Header: Authorization: Bearer {token}
Body: {
  "product_id": 1,
  "batch_number": "BATCH001",
  "expiry_date": "2024-12-31",
  "quantity": 100
}
```

#### Update Expired Status
```
POST /api/batches/update-expired
Header: Authorization: Bearer {token}
```

### Inventory

#### List Inventory Items
```
GET /api/inventory?status=in_stock&batch_id=1
Header: Authorization: Bearer {token}
```

#### Scan Item
```
POST /api/inventory/scan
Header: Authorization: Bearer {token}
Body: {
  "barcode": "1234567890",
  "batch_id": 1,
  "location": "Warehouse A",
  "notes": "Optional notes"
}
```

#### Update Item Status
```
PATCH /api/inventory/:id/status
Header: Authorization: Bearer {token}
Body: { "status": "shipped" }
```

#### Upload Label Photo
```
POST /api/inventory/:id/photo
Header: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: photo file
```

### Export

#### Export to CSV
```
GET /api/export/inventory?status=in_stock
Header: Authorization: Bearer {token}
Response: CSV file download
```

### Audit Logs

#### Get Audit Logs
```
GET /api/audit?user_id=1&entity_type=product&limit=100
Header: Authorization: Bearer {token}
```

### Sync (Offline Support)

#### Sync Operations
```
POST /api/sync/sync
Header: Authorization: Bearer {token}
Body: {
  "operations": [
    {
      "operation": "create",
      "entity_type": "inventory",
      "data": {...}
    }
  ]
}
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Linting

Run ESLint:
```bash
npm run lint
```

## Database Schema

### Users
- Authentication and authorization
- Roles: admin, manager, worker

### Products
- Product master data
- GTIN/barcode information

### Batches
- Product batches with lot numbers
- Expiry date tracking
- Priority levels

### Inventory Items
- Individual scanned items
- Status tracking
- Location information

### Label Photos
- Photo attachments for items

### Audit Logs
- Complete operation history

### Sync Queue
- Offline operation queue
- Conflict resolution data

## Security Considerations

1. **Authentication**: JWT-based with secure token generation
2. **Password Hashing**: Bcrypt with salt rounds
3. **Rate Limiting**: Prevents brute force attacks
4. **CORS**: Configured for specific origins
5. **Helmet**: Security headers
6. **Input Validation**: All inputs are validated
7. **SQL Injection**: Parameterized queries prevent SQL injection

## Offline Support

The application includes a sync queue mechanism for offline operation:

1. Operations performed offline are queued locally
2. When connection is restored, sync endpoint processes queued operations
3. Conflict resolution is handled server-side
4. Users are notified of conflicts for manual resolution

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new features
5. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.