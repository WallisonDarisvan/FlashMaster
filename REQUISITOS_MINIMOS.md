# 📋 Requisitos de Sistema & Conformidade Técnica

Este documento especifica os requisitos mínimos e recomendados de hardware e software para a execução do **Flash Master Studio v1.0.2**, bem como as normas técnicas de conformidade broadcast atendidas pelo software.

---

## 💻 Requisitos de Sistema

| Componente | Requisito Mínimo | Configuração Recomendada (Ideal para Produção) |
|---|---|---|
| **Sistema Operacional** | Windows 10 (64-bit) — Build 19041 ou superior | Windows 10 / Windows 11 (64-bit) |
| **Processador (CPU)** | Intel Core i3 / AMD Ryzen 3 (Quad-Core 2.5 GHz) | Intel Core i5 / i7 / i9 (8ª Geração ou superior) ou AMD Ryzen 5 / 7 / 9 |
| **Memória RAM** | 4 GB de memória RAM | 8 GB ou 16 GB de memória RAM (Recomendado para filas com muitos vídeos) |
| **Armazenamento (Disco)** | 500 MB livres para instalação do software | SSD (NVMe ou SATA III) com espaço livre proporcional aos arquivos master gerados (aprox. 400 MB por minuto de vídeo em 50Mbps) |
| **Placa de Vídeo (GPU)** | Gráficos integrados com suporte a DirectX 11 / OpenGL | GPU dedicada (NVIDIA GeForce / Quadro ou AMD Radeon) para aceleração de render da interface |
| **Resolução de Tela** | 1280 x 720 pixels | 1920 x 1080 (Full HD) ou superior |
| **Arquitetura** | Apenas 64-bit (x64) | 64-bit (x64) |

---

## 📥 Formatos de Entrada Homologados

O Flash Master Studio utiliza o motor **FFmpeg 6.0 x64** para decodificação nativa dos seguintes contêineres e codecs de vídeo/áudio:

### Contêineres:
* `.mov` (QuickTime Movie)
* `.mp4` / `.m4v` (MPEG-4 Part 14)
* `.mxf` (Material Exchange Format — OP-1a, OP-Atom, D10)
* `.mkv` (Matroska Video)
* `.avi` (Audio Video Interleave)
* `.ts` / `.m2ts` (MPEG Transport Stream)
* `.webm` (WebM Video)

### Codecs de Vídeo Homologados para Transcodificação:
* **H.264 / AVC** (High Profile / Main Profile)
* **H.265 / HEVC**
* **Apple ProRes** (422, 422 HQ, 422 LT, 422 Proxy, 4444)
* **Avid DNxHD / DNxHR**
* **GoPro CineForm (CFHD)**
* **MPEG-2 Video / XDCAM**
* **DVCPRO HD**
* **DV / DVCAM**

### Formatos de Áudio Homologados:
* **Linear PCM** (16-bit, 24-bit, 32-bit float / 48kHz, 44.1kHz, 96kHz)
* **AAC** (Advanced Audio Coding)
* **AC-3 / E-AC-3** (Dolby Digital)
* **MP3 / MP2**
* **Broadcast WAV (BWF)**

---

## 📤 Especificação Técnica do Master de Saída (Padrão TVB)

O arquivo gerado pelo Flash Master cumpre integralmente os parâmetros das normas técnicas de exibição de TV aberta e fechada:

```
FORMATO GERAL:
├── Formato: MXF (Material Exchange Format)
├── Padrão SMPTE: SMPTE 377M (OP-1a)
└── Timecode: SMPTE 12M Timecode Track

VÍDEO BROADCAST MASTER:
├── Codec: MPEG-2 Video (XDCAM HD422)
├── Bitrate: 50.0 Mbps (Constante / CBR)
├── Perfil / Nível: 4:2:2 Profile @ High Level (422P@HL)
├── Resolução: 1920x1080 (Full HD)
├── Taxa de Quadros: 29.97 fps (ou 25 fps para padrão PAL)
├── Modo de Varredura: Interlaced (Top Field First - TFF)
├── GOP Structure: Long-GOP (GOP 12, M=3, N=12)
└── Aspect Ratio: 16:9 Widescreen

ÁUDIO BROADCAST MASTER:
├── Codec: Linear PCM (Sem compressão com perdas)
├── Profundidade de Bits: 24-bit (pcm_s24le)
├── Taxa de Amostragem: 48.000 Hz (48 kHz)
├── Estrutura de Canais: Mapeamento Discreto (Discrete Tracks)
│   ├── Canal 1: Áudio Principal Esquerdo (L)
│   ├── Canal 2: Áudio Principal Direito (R)
│   ├── Canal 3: Audiodescrição / Efeitos / Mono
│   └── Canal 4: Audiodescrição / SAP / Silêncio
└── Nivelamento Dinâmico (Padrão TVB):
    ├── Ganho Linear Aplicado: +7.0 dB
    ├── Teto do Limitador (Hard Limiter): -12.0 dBFS
    ├── Tempo de Ataque (Attack): 5 ms
    └── Tempo de Recuperação (Release): 50 ms
```

---

## 🔒 Conformidade de Segurança e Ambiente de Execução

* **Execução Local Segura:** O processamento de vídeo e áudio é realizado **100% localmente no computador do usuário**. Nenhum frame de vídeo ou áudio é enviado para a nuvem.
* **Isolamento de Processos (Sandbox):** O aplicativo utiliza isolamento de contexto (`contextIsolation: true`) e desativação do Node.js direto na interface gráfica para impedir ataques de injeção de scripts (XSS).
* **Auto-Update Verificado:** As atualizações automáticas utilizam hashes criptográficos SHA-512 validados através do arquivo `latest.yml` hospedado no repositório oficial do GitHub.
