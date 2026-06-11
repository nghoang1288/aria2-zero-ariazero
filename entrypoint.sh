#!/bin/sh

# Set up directories
CONF_DIR="/config"
CONF_FILE="${CONF_DIR}/aria2.conf"
SESSION_FILE="${CONF_DIR}/aria2.session"
DOWNLOAD_DIR="/downloads"

mkdir -p "$CONF_DIR" "$DOWNLOAD_DIR"
mkdir -p /var/run/samba /var/log/samba /var/run/supervisor

# Create empty session file if it doesn't exist
touch "$SESSION_FILE"

# Create default aria2.conf if it doesn't exist
if [ ! -f "$CONF_FILE" ]; then
    cat <<EOF > "$CONF_FILE"
dir=$DOWNLOAD_DIR
input-file=$SESSION_FILE
save-session=$SESSION_FILE
save-session-interval=60
enable-rpc=true
rpc-allow-origin-all=true
rpc-listen-all=true
rpc-listen-port=6800
max-connection-per-server=16
min-split-size=10M
split=16
max-concurrent-downloads=5
allow-overwrite=true
force-save=true
check-integrity=true
EOF
fi

# Apply RPC Secret dynamically
if [ -n "$ARIA2_RPC_SECRET" ]; then
    # Remove existing rpc-secret configuration line
    sed -i '/rpc-secret=/d' "$CONF_FILE"
    # Append the new secret
    echo "rpc-secret=$ARIA2_RPC_SECRET" >> "$CONF_FILE"
fi

# Ensure force-save=true is set to preserve completed tasks across restarts
if ! grep -q "^force-save=" "$CONF_FILE"; then
    echo "force-save=true" >> "$CONF_FILE"
else
    sed -i 's/^force-save=.*/force-save=true/' "$CONF_FILE"
fi

# Ensure check-integrity=true is set to verify existing files and allow proper resumes
if ! grep -q "^check-integrity=" "$CONF_FILE"; then
    echo "check-integrity=true" >> "$CONF_FILE"
else
    sed -i 's/^check-integrity=.*/check-integrity=true/' "$CONF_FILE"
fi



# Ensure permissions on configuration and downloads folders
chmod -R 777 "$DOWNLOAD_DIR"
chmod 755 "$CONF_DIR"
chmod 644 "$CONF_FILE" "$SESSION_FILE" 2>/dev/null || true

# Generate config.js for AriaZero containing the RPC Secret and SMB credentials
cat <<EOF > /var/www/html/config.js
window.AriaZeroServerConfig = {
  rpcSecret: "${ARIA2_RPC_SECRET}",
  smbUser: "${SMB_USER:-admin}",
  smbPassword: "${SMB_PASSWORD:-123456}"
};
EOF


# Set up Samba configuration
SMB_CONF="/etc/samba/smb.conf"

cat <<EOF > "$SMB_CONF"
[global]
   workgroup = WORKGROUP
   server string = Aria2 Samba Server
   server role = standalone server
   map to guest = bad user
   dns proxy = no
   security = user
   create mask = 0777
   directory mask = 0777
   force create mode = 0777
   force directory mode = 0777
   force user = root
   force group = root
   load printers = no
   printing = bsd
   printcap name = /dev/null
   disable spoolss = yes
   logging = file
   log file = /var/log/samba/log.%m
   max log size = 1000

[downloads]
   comment = Aria2 Downloads Share
   path = $DOWNLOAD_DIR
   browsable = yes
   writable = yes
   read only = no
EOF

SMB_USER="${SMB_USER:-admin}"
SMB_PASSWORD="${SMB_PASSWORD:-123456}"

echo "Configuring Samba with authenticated access (User: ${SMB_USER})..."
# Create system user if it doesn't exist (Debian useradd)
if ! id "$SMB_USER" >/dev/null 2>&1; then
    useradd -M -s /usr/sbin/nologin "$SMB_USER"
fi
# Set Samba password
(echo "$SMB_PASSWORD"; echo "$SMB_PASSWORD") | smbpasswd -a -s "$SMB_USER"

cat <<EOF >> "$SMB_CONF"
   guest ok = no
   valid users = $SMB_USER
EOF

# Execute supervisor
echo "Starting Supervisor process manager..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
