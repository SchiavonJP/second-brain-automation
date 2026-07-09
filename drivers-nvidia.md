
Claro! Aqui está o guia completo, organizado e pronto pra usar no futuro:

---

# 🖥️ Guia: Instalar Driver NVIDIA RTX 3060 no Proxmox VE 9.x (Debian 13 Trixie / Kernel 7.x PVE)

> **Data:** Julho 2026
> **Driver:** NVIDIA 610.43.02
> **Kernel:** 7.0.14-3-pve
> **GPU:** RTX 3060 12GB

---

## Pré-requisitos

- [ ] Desativar **Secure Boot** na BIOS/UEFI (sem isso o módulo NVIDIA é rejeitado pelo kernel: `Key was rejected by service`)
- [ ] Acesso root ao Proxmox

---

## 1. Limpar repositórios duplicados

O Proxmox 9 já vem com `/etc/apt/sources.list.d/debian.sources` (formato deb822). Se você adicionou repos manualmente em `/etc/apt/sources.list`, vai gerar duplicatas.

```bash
# Backup
cp /etc/apt/sources.list /etc/apt/sources.list.bak

# Adicionar contrib e non-free ao debian.sources (necessário pro driver NVIDIA)
sed -i 's/Components: main non-free-firmware/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources

# Comentar tudo no sources.list (já está coberto pelo debian.sources)
sed -i 's/^deb/#deb/' /etc/apt/sources.list

apt update
```

---

## 2. Instalar headers do kernel Proxmox

> ⚠️ No Proxmox o pacote é `proxmox-headers`, NÃO `linux-headers`.

```bash
apt install proxmox-headers-$(uname -r) build-essential dkms
```

---

## 3. Adicionar repositório CUDA da NVIDIA

```bash
wget https://developer.download.nvidia.com/compute/cuda/repos/debian13/x86_64/cuda-keyring_1.1-1_all.deb
dpkg -i cuda-keyring_1.1-1_all.deb
apt update
```

---

## 4. Instalar o driver NVIDIA

```bash
apt install nvidia-driver
```

> ⚠️ **NÃO** misture `nvidia-open-kernel-dkms` (550 do Debian) com `nvidia-driver` (610 do CUDA). Causa conflito de versões. Use só `apt install nvidia-driver` sem nada mais.

---

## 5. Blacklistar o nouveau

```bash
echo "blacklist nouveau" > /etc/modprobe.d/blacklist-nouveau.conf
update-initramfs -u
```

---

## 6. Reboot

```bash
reboot
```

---

## 7. Corrigir nvidia-smi (pacote veio vazio — bug do repositório CUDA)

O pacote `nvidia-smi` do repositório CUDA da NVIDIA vem **sem o binário** (`/usr/bin/nvidia-smi` não existe). Solução: extrair do instalador `.run`.

```bash
# Baixar o .run da mesma versão do driver instalado
wget https://download.nvidia.com/XFree86/Linux-x86_64/610.43.02/NVIDIA-Linux-x86_64-610.43.02.run

# Extrair SEM instalar
chmod +x NVIDIA-Linux-x86_64-610.43.02.run
./NVIDIA-Linux-x86_64-610.43.02.run --extract-only

# Copiar só o binário nvidia-smi
cp NVIDIA-Linux-x86_64-610.43.02/nvidia-smi /usr/bin/
chmod +x /usr/bin/nvidia-smi

# Limpar
rm -rf NVIDIA-Linux-x86_64-610.43.02
rm NVIDIA-Linux-x86_64-610.43.02.run
```

---

## 8. Garantir carregamento automático no boot

O módulo NVIDIA pode não carregar sozinho. Forçar:

```bash
echo -e "nvidia\nnvidia_uvm\nnvidia_modeset\nnvidia_drm" > /etc/modules-load.d/nvidia.conf
```

---

## 9. Verificação final

```bash
# Módulos carregados?
lsmod | grep nvidia

# GPU reconhecida?
nvidia-smi

# DKMS ok?
dkms status | grep nvidia

# Nouveau desativado?
lsmod | grep nouveau   # deve retornar vazio
```

---

## Saída esperada do `nvidia-smi`

```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 610.43.02              KMD Version: 610.43.02     CUDA UMD Version: N/A      |
+-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
|   0  NVIDIA GeForce RTX 3060        Off |   00000000:10:00.0 Off |                  N/A |
|  0%   40C    P8              8W /  170W |       1MiB /  12288MiB |      0%      Default |
+-----------------------------------------+------------------------+----------------------+
```

---

## Troubleshooting rápido

| Problema | Causa | Solução |
|----------|-------|---------|
| `Key was rejected by service` | Secure Boot ativo | Desativar na BIOS |
| `linux-headers-*-pve` not found | Nome errado | Usar `proxmox-headers-$(uname -r)` |
| Conflito nvidia-driver vs nvidia-open-kernel-dkms | Versões diferentes (610 vs 550) | Usar só `apt install nvidia-driver` |
| `nvidia-smi: command not found` | Pacote nvidia-smi vazio | Extrair do `.run` (passo 7) |
| `lsmod \| grep nvidia` vazio | Módulo não carregou no boot | Criar `/etc/modules-load.d/nvidia.conf` (passo 8) |

---

## Opcional: Instalar CUDA toolkit (pra ML/LLMs)

```bash
apt install cuda-toolkit
nvcc --version
```

---
