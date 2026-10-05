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

## Not done

SSH hardening, Fail2ban, firewall changes, package upgrades, Docker changes, Coolify, DNS, MX, SPF, DKIM, and DMARC were not started.
