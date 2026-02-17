# Terraform Staging Baseline

This directory contains the Task 38 staging baseline for AWS:

- VPC + public/private subnets + internet routing
- PostgreSQL (RDS)
- Redis (ElastiCache)
- S3 media bucket
- ECS/Fargate cluster + API/worker services
- Secrets Manager bindings for API/worker env sets

## Files

- `versions.tf`: Terraform and provider version constraints
- `variables.tf`: Inputs for region, networking, images, and DB credentials
- `main.tf`: Resource graph for staging baseline
- `outputs.tf`: Resource outputs used by deployment workflows
- `staging.tfvars.example`: Example variable values for staging

## Usage

```bash
cd infra/terraform
terraform init
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

## Important

- Copy `staging.tfvars.example` to `staging.tfvars` and set real values.
- Keep `db_password` out of source control.
- Replace placeholder image URIs with real ECR image tags.
