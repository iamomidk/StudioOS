output "vpc_id" {
  value       = aws_vpc.main.id
  description = "Staging VPC ID"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "Private subnet IDs"
}

output "postgres_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "PostgreSQL endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "Redis endpoint"
}

output "media_bucket_name" {
  value       = aws_s3_bucket.media.id
  description = "S3 bucket for media storage"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "api_service_name" {
  value       = aws_ecs_service.api.name
  description = "API ECS service name"
}

output "media_worker_service_name" {
  value       = aws_ecs_service.media_worker.name
  description = "Media worker ECS service name"
}

output "pricing_worker_service_name" {
  value       = aws_ecs_service.pricing_worker.name
  description = "Pricing worker ECS service name"
}

output "api_secret_arn" {
  value       = aws_secretsmanager_secret.api_env.arn
  description = "Secrets Manager ARN for API env bindings"
}

output "worker_secret_arn" {
  value       = aws_secretsmanager_secret.worker_env.arn
  description = "Secrets Manager ARN for worker env bindings"
}
