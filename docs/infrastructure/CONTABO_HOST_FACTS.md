# Contabo host facts

Read-only record from the VPS at `31.220.96.134` after SSH as `root` with the bootstrap public key. No passwords, private keys, or application secrets. Collected before SSH hardening, Fail2ban, firewall changes, and any Docker or Coolify install.

The static hostname was already `takatak-core-01`. It was not changed. `hostnamectl set-hostname` was not run.

## hostnamectl

```text
Static hostname: takatak-core-01
Icon name: computer-vm
Chassis: vm
Machine ID: d1ec8094173f4a699c52ab264cc5aee7
Boot ID: 4cb7e5138aa94f0fb00c66f0097cf3bd
Virtualization: kvm
Operating System: Ubuntu 24.04.5 LTS
Kernel: Linux 6.8.0-146-generic
Architecture: x86-64
Hardware Vendor: QEMU
Hardware Model: Standard PC (i440FX + PIIX, 1996)
Firmware Version: rel-1.16.3-0-ga6ed6b701f0a-prebuilt.qemu.org
Firmware Date: Tue 2014-04-01
```

## uname -a

```text
Linux takatak-core-01 6.8.0-146-generic #146-Ubuntu SMP PREEMPT_DYNAMIC Thu Sep  3 16:12:30 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux
```

## /etc/os-release

Ubuntu 24.04.5 LTS (Noble Numbat). `VERSION_ID=24.04`. `VERSION_CODENAME=noble`.

## CPU and memory

- `nproc`: 6
- Memory: 11 GiB total, 1.2 GiB used, 9.6 GiB free, 10 GiB available
- Swap: 4.0 GiB total, 0 B used

## lsblk

| Name | Size | Type | Mount |
| --- | --- | --- | --- |
| sda | 100G | disk | |
| sda1 | 99G | part | `/` |
| sda14 | 4M | part | |
| sda15 | 106M | part | `/boot/efi` |
| sda16 | 913M | part | `/boot` |
| sr0 | 4M | rom | |

## df -hT

| Filesystem | Type | Size | Used | Avail | Use% | Mounted on |
| --- | --- | --- | --- | --- | --- | --- |
| tmpfs | tmpfs | 1.2G | 1.9M | 1.2G | 1% | `/run` |
| /dev/sda1 | ext4 | 96G | 16G | 81G | 17% | `/` |
| tmpfs | tmpfs | 5.9G | 0 | 5.9G | 0% | `/dev/shm` |
| tmpfs | tmpfs | 5.0M | 0 | 5.0M | 0% | `/run/lock` |
| /dev/sda16 | ext4 | 881M | 117M | 703M | 15% | `/boot` |
| /dev/sda15 | vfat | 105M | 6.2M | 99M | 6% | `/boot/efi` |
| tmpfs | tmpfs | 1.2G | 12K | 1.2G | 1% | `/run/user/0` |

Nine overlay mounts under `/var/lib/docker/rootfs/overlayfs/` use the same 96G ext4 filesystem. They were left untouched.

## swapon --show

`/swapfile` is a 4G file, 0B used, priority `-2`. Swap already exists, so none was added.

## ip -br addr

| Device | State | Addresses |
| --- | --- | --- |
| lo | UNKNOWN | `127.0.0.1/8`, `::1/128` |
| eth0 | UP | `31.220.96.134/21`, `2605:a144:2362:1936::1/64`, `fe80::250:56ff:fe67:d679/64` |
| br-b31c559ccc20 | UP | `10.0.1.1/24`, `fda0:97e2:d3ec::1/64`, `fe80::387d:e6ff:fea8:e84f/64` |
| docker0 | UP | `10.0.0.1/24`, `fe80::25:d9ff:fed7:d27e/64` |

`veth` interfaces are up with link-local IPv6 only. Docker bridges were already present. Docker and Coolify were not installed or reconfigured in this step.

## /etc/hosts

Cloud-init manages this file (`manage_etc_hosts` is true). `127.0.1.1` is `vmi3621936.contaboserver.net vmi3621936`. `127.0.0.1` is `localhost`. The file was not edited, because a hostname change was unnecessary and a hosts edit would not persist without changing the cloud-init template.

## Admin user

`takatak` was created with `--disabled-password` (uid 1002) and added to the `sudo` group. A new ed25519 key, comment `takatak-admin`, fingerprint `SHA256:QxndNBuGg26ZY1GGPT8UcWgeKfafmVUc8f6PRj4+djo`, stays on the operator machine. The public key is in `/home/takatak/.ssh/authorized_keys` (mode `600`, directory mode `700`, owner `takatak`).

A second SSH session as `takatak` succeeded. `sudo -n whoami` returns `root` through `/etc/sudoers.d/takatak` (`NOPASSWD`), because the account has no password.

## SSH hardening

Applied after a fresh `takatak` login and `sudo -n whoami` returned `root`. `sshd -t` passed before each reload.

`/etc/ssh/sshd_config.d/00-takatak-auth.conf` is read before cloud-init, so its values win:

- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`
- `PubkeyAuthentication yes`
- `PermitRootLogin no` was added only after a post-reload `takatak` login and sudo check succeeded

`sshd -T` now reports those four values. A new root key login is refused with `Permission denied (publickey)`. The `takatak` key login and `sudo -n whoami` still return `root`.

## Fail2ban and unattended upgrades

`fail2ban` 1.0.2 and `unattended-upgrades` 2.9.1 were already installed. `apt-get install` changed nothing. `dpkg-reconfigure -f noninteractive unattended-upgrades` left `/etc/apt/apt.conf.d/20auto-upgrades` with package-list updates and unattended upgrades enabled. Both services are active.

The stock `sshd` jail was already enabled (`maxretry` 5, `bantime` 600, `findtime` 600). `/etc/fail2ban/jail.d/takatak-admin.conf` adds `ignoreip` for `127.0.0.1/8`, `::1`, and the admin session address `98.83.252.178`. No shorter ban time was set. After reload, the sshd jail has zero banned addresses. UFW, iptables, nftables, and the Contabo panel firewall were not edited. The jail's existing `nftables` ban action was left as Ubuntu shipped it.

A fresh `takatak` key login after that reload still works, and `sudo -n whoami` returns `root`.

## Firewall

UFW was inactive. Allow rules for TCP 22, 80, and 443 from anywhere were written for IPv4 and IPv6 before `ufw --force enable`. The default incoming policy is deny. Outgoing stays allow. UFW is enabled and will start on boot.

No allow rule was added for 3000, 3001, 5432, 6379, 3306, 27017, 8000, 6001, 6002, or 8080. sshd and Fail2ban were not changed.

A fresh `takatak` key login after UFW became active still works, and `sudo -n whoami` returns `root`.

Coolify's containers were already running and were not installed in this step. Docker publishes 80 and 443 on the host. After `coolify.takatak.ca` answered over HTTPS, the temporary publishes for 8000, 6001, 6002, and 8080 were bound to `127.0.0.1` only. `coolify-db` and `coolify-redis` are not published on the host. A fresh `takatak` login after that change still works.

## Coolify already present

Coolify 4.3.23, Docker 29.8.2, and Compose v5.6.0 were already installed. They were not installed again. `server_settings.concurrent_builds` is 1. Versions and the running set are in `COOLIFY_HOST.md`.

## Not done

DNS for `dashboard.takatak.ca` and `api.takatak.ca`, and MX, SPF, DKIM, and DMARC, were not changed. MochaHost was not changed. Production workers were not started.
