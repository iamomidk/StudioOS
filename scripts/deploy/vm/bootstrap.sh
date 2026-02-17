#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${1:-${SUDO_USER:-$USER}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "bootstrap.sh must run as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  fail2ban \
  git \
  gnupg \
  lsb-release \
  ufw

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

arch="$(dpkg --print-architecture)"
release="$(. /etc/os-release && echo "$VERSION_CODENAME")"
cat > /etc/apt/sources.list.d/docker.list <<DOCKER_APT
deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${release} stable
DOCKER_APT

apt-get update
apt-get install -y --no-install-recommends \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable docker
systemctl start docker

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi
usermod -aG docker "${DEPLOY_USER}"

install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /opt/studio-platform
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /opt/studio-platform/backups
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /opt/studio-platform/logs
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /opt/studio-platform/deploy-state

echo "Bootstrap complete for deploy user: ${DEPLOY_USER}"
docker --version
docker compose version
