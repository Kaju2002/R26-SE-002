# Deployment env (copy to DEPLOYMENT.local.md)

| Service | Env | Value |
|---------|-----|-------|
| user-management | SERVICE_URL | https://your-user-service.up.railway.app |
| user-management | MONGODB_URI | mongodb+srv://user:pass@cluster/db |
| user-management | RABBITMQ_URL | amqps://user:pass@host/vhost |
| user-management | JWT_SECRET | your-jwt-secret |
| job-management | USER_MANAGEMENT_BASE_URL | https://your-user-service.up.railway.app |
| job-management | RABBITMQ_URL | amqps://user:pass@host/vhost |
