#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CargoNotify — Script de sécurisation et configuration VPS
# À exécuter EN ROOT lors de la première connexion sur VPS2
#
# Usage :
#   chmod +x scripts/setup-vps.sh
#   sudo bash scripts/setup-vps.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Couleurs pour les logs ──────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Variables ───────────────────────────────────────────────────
DEPLOY_USER="deploy"
APP_DIR="/opt/cargonotify"
GITHUB_REPO="https://github.com/VOTRE_USERNAME/CargoNotify.git"  # ← à modifier

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 1/7 : Mise à jour du système ═══"
# ═══════════════════════════════════════════════════════════════
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git ufw fail2ban \
    ca-certificates gnupg lsb-release
log_success "Système mis à jour."

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 2/7 : Création de l'utilisateur '$DEPLOY_USER' ═══"
# ═══════════════════════════════════════════════════════════════
if id "$DEPLOY_USER" &>/dev/null; then
    log_warning "Utilisateur '$DEPLOY_USER' existe déjà."
else
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    log_success "Utilisateur '$DEPLOY_USER' créé."
fi

# Créer le dossier SSH pour le user deploy
mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh

log_warning "══════════════════════════════════════════════════"
log_warning "ACTION REQUISE : Ajoutez la clé SSH publique pour"
log_warning "GitHub Actions dans authorized_keys :"
log_warning ""
log_warning "Générez une paire de clés sur votre machine locale :"
log_warning "  ssh-keygen -t ed25519 -C 'github-actions-cargonotify'"
log_warning ""
log_warning "Puis collez la clé PUBLIQUE (.pub) ci-dessous :"
log_warning "══════════════════════════════════════════════════"
read -p "Clé publique SSH (ou Entrée pour passer) : " SSH_PUB_KEY

if [ -n "$SSH_PUB_KEY" ]; then
    echo "$SSH_PUB_KEY" >> /home/$DEPLOY_USER/.ssh/authorized_keys
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    log_success "Clé SSH ajoutée à authorized_keys."
fi

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 3/7 : Sécurisation SSH ═══"
# ═══════════════════════════════════════════════════════════════
SSH_CONFIG="/etc/ssh/sshd_config"
cp $SSH_CONFIG ${SSH_CONFIG}.bak

# Désactiver la connexion root
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' $SSH_CONFIG
# Désactiver l'auth par mot de passe (uniquement clés SSH)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' $SSH_CONFIG
# Désactiver l'auth par clé host
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' $SSH_CONFIG

systemctl restart sshd
log_success "SSH sécurisé (root désactivé, password auth désactivé)."

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 4/7 : Configuration du Firewall UFW ═══"
# ═══════════════════════════════════════════════════════════════
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH (essentiel — ne pas bloquer !)
ufw allow 22/tcp comment 'SSH'

# Frontend CargoNotify (accessible depuis NPM sur VPS1)
ufw allow 3000/tcp comment 'CargoNotify Frontend'

# HTTP/HTTPS optionnel si Let's Encrypt vérifie depuis ce VPS
# ufw allow 80/tcp
# ufw allow 443/tcp

ufw --force enable
ufw status verbose
log_success "Firewall UFW configuré."

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 5/7 : Configuration Fail2ban ═══"
# ═══════════════════════════════════════════════════════════════
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log_success "Fail2ban configuré (3 tentatives max, ban 1h)."

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 6/7 : Installation de Docker ═══"
# ═══════════════════════════════════════════════════════════════
if command -v docker &>/dev/null; then
    log_warning "Docker déjà installé : $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker $DEPLOY_USER
    systemctl enable docker
    systemctl start docker
    log_success "Docker installé : $(docker --version)"
fi

# ═══════════════════════════════════════════════════════════════
log_info "═══ Étape 7/7 : Clonage du projet ═══"
# ═══════════════════════════════════════════════════════════════
mkdir -p $APP_DIR
chown $DEPLOY_USER:$DEPLOY_USER $APP_DIR

if [ -d "$APP_DIR/.git" ]; then
    log_warning "Projet déjà cloné dans $APP_DIR."
else
    sudo -u $DEPLOY_USER git clone "$GITHUB_REPO" "$APP_DIR"
    log_success "Projet cloné dans $APP_DIR."
fi

# Créer le .env depuis le template
if [ ! -f "$APP_DIR/.env" ]; then
    sudo -u $DEPLOY_USER cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    log_warning "Fichier .env créé depuis .env.example"
    log_warning "IMPORTANT : Éditez $APP_DIR/.env avec vos vraies valeurs !"
    log_warning "  nano $APP_DIR/.env"
fi

# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ VPS sécurisé et prêt pour CargoNotify !     ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo "Prochaines étapes :"
echo "  1. Configurer les secrets :  nano $APP_DIR/.env"
echo "  2. Lancer l'application  :  cd $APP_DIR && docker compose up -d --build"
echo "  3. Créer le super admin  :  docker compose exec backend node src/db/init-db.js"
echo "  4. Vérifier la santé    :  curl http://localhost:3000/health"
echo ""
echo "Ajouter la clé privée SSH dans GitHub Secrets :"
echo "  Settings → Secrets → Actions → VPS_SSH_KEY"
echo ""
