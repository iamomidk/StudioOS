variable "aws_region" {
  type        = string
  description = "AWS region for staging resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "staging"
}

variable "project_name" {
  type        = string
  description = "Project slug used for naming"
  default     = "studioos"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for staging VPC"
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs"
  default     = ["10.42.0.0/24", "10.42.1.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs"
  default     = ["10.42.10.0/24", "10.42.11.0/24"]
}

variable "db_instance_class" {
  type        = string
  description = "PostgreSQL instance class"
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type        = number
  description = "PostgreSQL storage in GB"
  default     = 20
}

variable "db_name" {
  type        = string
  description = "Application database name"
  default     = "studioos"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL admin username"
  default     = "studioos"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL admin password"
  sensitive   = true
}

variable "redis_node_type" {
  type        = string
  description = "Redis node type"
  default     = "cache.t4g.micro"
}

variable "api_image" {
  type        = string
  description = "ECR image for API service"
  default     = "public.ecr.aws/docker/library/nginx:latest"
}

variable "media_worker_image" {
  type        = string
  description = "ECR image for media worker service"
  default     = "public.ecr.aws/docker/library/nginx:latest"
}

variable "pricing_worker_image" {
  type        = string
  description = "ECR image for pricing worker service"
  default     = "public.ecr.aws/docker/library/nginx:latest"
}
