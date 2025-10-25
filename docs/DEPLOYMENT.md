# Deployment Guide

## Prerequisites

- Node.js 14.x or higher
- npm 6.x or higher
- SQLite3

## Initial Setup

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
```

4. Edit `.env` file with your configuration:
```bash
PORT=3000
JWT_SECRET=your-secure-random-secret-here
DB_PATH=./data/inventory.db
UPLOAD_PATH=./uploads
NODE_ENV=production
```

5. Run the setup script to create database and admin user:
```bash
npm run setup
```

Follow the prompts to create your admin user.

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the server with nodemon for automatic reloading.

### Production Mode

```bash
npm start
```

The application will be available at `http://localhost:3000` (or your configured port).

## Post-Deployment

### Create Additional Users

Login as admin and use the API to create additional users:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "worker1",
    "password": "securepassword",
    "role": "worker"
  }'
```

Available roles: `admin`, `manager`, `worker`

### Database Backups

Regularly backup your SQLite database:

```bash
cp data/inventory.db data/inventory.db.backup.$(date +%Y%m%d)
```

### Uploaded Files

Backup the uploads directory:

```bash
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

## Maintenance

### Update Expired Batches

The system can automatically mark expired batches:

```bash
curl -X POST http://localhost:3000/api/batches/update-expired \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Consider setting up a cron job to run this daily.

### Monitoring

- Check application logs for errors
- Monitor database size
- Review audit logs regularly for suspicious activity
- Monitor upload directory size

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, change the PORT in `.env` file.

### Database Locked

If you get database locked errors, ensure only one instance of the application is running.

### Permission Issues

Ensure the application has write permissions for:
- `data/` directory (database)
- `uploads/` directory (photos)

```bash
chmod 755 data uploads
```

## Security Recommendations

1. **Change JWT Secret**: Use a strong, random secret in production
2. **Enable HTTPS**: Use a reverse proxy like nginx with SSL/TLS
3. **Rate Limiting**: Adjust rate limits based on your needs
4. **Backup**: Regular automated backups of database and uploads
5. **Updates**: Keep dependencies updated with `npm audit` and `npm update`
6. **Monitoring**: Set up monitoring for the application and server

## Scaling Considerations

For larger deployments:

1. **Database**: Consider migrating from SQLite to PostgreSQL or MySQL
2. **File Storage**: Use cloud storage (S3, Azure Blob) instead of local filesystem
3. **Load Balancing**: Use multiple application instances behind a load balancer
4. **Caching**: Implement Redis for session management and caching
5. **Logging**: Use centralized logging (ELK stack, CloudWatch)

## Support

For issues and questions:
- Check the README.md for common questions
- Review API documentation in docs/API.md
- Open an issue on GitHub
