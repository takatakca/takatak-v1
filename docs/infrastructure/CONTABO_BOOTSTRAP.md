# Contabo bootstrap

Auditable runbook for the TAKATAK control-plane VPS. Do not run these commands from a workstation that cannot open an SSH session to the server. This repository does not contain server addresses, passwords, or keys.

Email stays on MochaHost. Do not change MX, SPF, DKIM, or DMARC. Do not point `takatak.ca` at this host in this phase.

Stop if a second login has not been proven before any SSH hardening step.

## 1. Reach the server

1. Open `https://my.contabo.com/`.
2. Sign in with the Contabo account that owns the VPS.
3. Open the VPS that will be named `takatak-core-01`.
4. Confirm the panel shows SSH access for that VPS. Do not paste the password or private key into chat or into git.

## 2. Base OS

Target image: Ubuntu 24.04 LTS. The live host already matches this image and the static hostname is already `takatak-core-01`. See `CONTABO_HOST_FACTS.md`. Do not run `hostnamectl set-hostname` again unless the static hostname has changed.

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo hostnamectl set-hostname takatak-core-01
```

`hostnamectl` should print `takatak-core-01`. Add that name to `/etc/hosts` on the loopback line. Do not edit public DNS here.

## 3. Swap check

```bash
swapon --show
free -h
awk '/MemTotal/ { print $2 }' /proc/meminfo
```

If `swapon --show` is empty and `MemTotal` is under 8000000 kB, add a 4G swapfile before the first Next.js image build. If swap already exists, leave it.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Admin user

Create `takatak` with sudo. Install that user's SSH public key before disabling passwords.

```bash
sudo adduser --disabled-password --gecos "" takatak
sudo usermod -aG sudo takatak
sudo install -d -m 700 -o takatak -g takatak /home/takatak/.ssh
```

Put the operator public key in `/home/takatak/.ssh/authorized_keys` with mode `600`.

Open a second terminal and log in as `takatak` with the key. Keep the first session open. Do not continue until that second login works.

On `takatak-core-01` this login is already proven. The account has no password; `/etc/sudoers.d/takatak` allows `NOPASSWD`.

Section 5 is applied. Password and keyboard-interactive authentication are off, public-key authentication stays on, and `PermitRootLogin` is `no`. Use the `takatak` key for later steps.

## 5. SSH hardening

Only after the second `takatak` login works:

- `PermitRootLogin no`
- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`
- `PubkeyAuthentication yes`

Reload `ssh` with `sudo systemctl reload ssh`. Confirm the second session still works before closing the first one.

## 6. Fail2ban and unattended upgrades

```bash
sudo apt-get install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

Enable the stock `sshd` jail. Do not add a jail that bans the operator's current address during setup. `systemctl status fail2ban` should be active.

On `takatak-core-01` this is done. The sshd jail uses the stock 5 failures / 10 minute ban, and the admin address is in `ignoreip`. The firewall was not changed.

## 7. Firewall

Public: 22, 80, 443.

Temporary, until Coolify is behind HTTPS: 8000, 6001, 6002.

Never public: 3000, 3001, 5432, 6379, 3306, 27017.

Apply the allow rules before any deny policy. Do not enable a firewall that drops the current SSH session.

On `takatak-core-01`, UFW is active. TCP 22, 80, and 443 are allowed from anywhere. The Coolify temporary ports are not in the UFW allow list. Docker already published some of them before this step; that publish was not changed.

## 8. Docker and Coolify

Install Docker from Ubuntu's Docker packages, then install Coolify using the current official installer documented at `https://coolify.io/docs/get-started/installation`. Run that installer only on this VPS.

In Coolify, set the server build concurrency to 1 so two Next.js builds cannot run together.

On `takatak-core-01` this was already installed (`coollabsio/coolify:4.3.23`, Docker 29.8.2). A second copy was not installed. `server_settings.concurrent_builds` is 1. See `COOLIFY_HOST.md`.

Coolify UI hostname, later: `coolify.takatak.ca`. Do not create that DNS record until the operator is ready. HTTPS for Coolify and the app hostnames is Coolify's proxy with its certificate issuer. Do not terminate those names on MochaHost.

## 9. APP_KEY off the box

After Coolify's first boot, read the Coolify `APP_KEY` on the server and store it in the team password manager. Do not commit it, do not put it in this repository, and do not leave the only copy on the VPS disk. Contabo backups are not a substitute for that off-box copy. `BACKUP_RECOVERY.md` is the recovery note.

## 10. First application deploy

Follow `DEPLOYMENT.md`. Order: private Redis, `takatak-web`, health `GET /api/health/ready`, workers configured and stopped, queue flags false. Production workers stay stopped while MochaHost still runs the social cron.
