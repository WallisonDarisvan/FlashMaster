# 🎬 Flash Master Studio v1.0.2

> **Transcodificador Broadcast MXF OP-1a (XDCAM HD422) & Nivelador Automático de Áudio (+7dB / -12dBFS)**  
> Desenvolvido por **Flash Engine — Wallison Darisvan** • Contato: `(83) 99901-0832`

---

## 📌 Visão Geral

O **Flash Master Studio** é uma estação desktop profissional desenvolvida em **Electron + React + TypeScript + FFmpeg**, projetada para atender ao padrão rigoroso de exibição e ingest de emissoras de televisão (Padrão TVB / Broadcast Brasileiro e Internacional).

O software converte múltiplos formatos de vídeo (MP4, MOV, MKV, ProRes, DNxHD, AVI, MXF) para o formato **MXF OP-1a XDCAM HD422 50Mbps** com normalização de áudio em tempo real, mapeamento de canais discretos (Estéreo + Audiodescrição), extração de formas de onda e renderização em lote.

---

## ✨ Principais Funcionalidades

### 1. 🎞️ Transcodificação Master Broadcast MXF OP-1a
* **Codec de Vídeo:** MPEG-2 Broadcast Master (`mpeg2video`) @ **50 Mbps CBR**, amostragem **4:2:2** (`yuv422p`), GOP 12, flags entrelaçadas (`+ildct+ilme`), Top Field First (`-top 1`).
* **Formatos Opcionais:** Avid DNxHD (`120M`), Stream Copy (Passthrough) ou ProRes.
* **Encapsulamento:** SMPTE 377M OP-1a com timecode e conformidade técnica para servidores de exibição de TV (Harris, Omneon, Grass Valley, PlayBox, etc.).

### 2. 🎚️ Nivelamento e Filtro de Áudio Broadcast
* **Fórmula Padrão TVB:** Ganho Linear de **`+7.0 dB`** com Hard Limiter em **`-12.0 dBFS`** (Attack: `5ms`, Release: `50ms`, Level: `false`).
* **Codec de Áudio Master:** **Linear PCM 24-bit** (`pcm_s24le`) @ **48.000 Hz** com canais discretos independentes.
* **Configurações Personalizáveis:** Ajuste fino de ganho e teto limitador via modal de configurações (`Ctrl + ,` ou Menu `Window -> Configurações de Áudio`) com persistência local.

### 3. 🎙️ Mapeamento de Canais Discretos & Audiodescrição
* **Detecção Automática:** Reconhece contêineres com múltiplas trilhas (ex: Trilha 1 Estéreo L/R + Trilha 2 Audiodescrição L/R = 4 canais discretos).
* **Roteamento e Clonagem:** Permite duplicar ou clonar qualquer canal (ex: duplicar o áudio do Canal 1 para os Canais 3 e 4).
* **Seleção Individual:** Marque ou desmarque canais específicos para inclusão no arquivo MXF final.

### 4. 📦 Fila de Arquivos & Renderização em Lote (Batch Render)
* **Importação Múltipla:** Arraste vários vídeos ou selecione múltiplos arquivos na janela nativa do Windows.
* **Seleção por Checkbox:** Marque quais vídeos da fila deseja renderizar ou use o botão **"Marcar Todos / Desmarcar Todos"**.
* **Tags de Status em Tempo Real:**
  * 🔵 `[RENDERIZANDO...]` — Indica o arquivo que está em processamento no momento.
  * 🟢 `[RENDERIZADO]` — Confirma a conclusão com sucesso do arquivo.
  * 🟠 `[EDITADO]` — Sinaliza que as trilhas/canais de áudio daquele vídeo foram personalizadas.
* **Pasta de Saída Unificada:** Em renderizações de múltiplos arquivos, selecione a pasta de destino uma única vez e o sistema processará todo o lote sequencialmente.

### 5. 📊 Monitor de Áudio/Vídeo & Formas de Onda Reais
* **Waveforms Reais:** Extração de picos de modulação por canal via FFprobe/FFmpeg de alta velocidade.
* **Cache Inteligente em RAM:** Formas de onda processadas ficam salvas em memória para abertura instantânea (0ms), sendo limpas automaticamente ao remover o vídeo da fila.
* **Comparação A/B em Tempo Real:** Ouça o áudio do vídeo no player alternando entre o som **Original** e o som **Corrigido (+7dB / -12dB)** antes de converter.
* **VU Meter Broadcast:** Medidores de modulação com escala em dBFS e indicadores de pico.

### 6. 🔄 Atualizações Automáticas via GitHub
* Integração nativa com `electron-updater` consultando releases no repositório GitHub.
* Nomenclatura padronizada de instaladores (`Flash-Master-Setup-1.0.2.exe`) sem conflitos de compatibilidade com o arquivo `latest.yml`.

---

## 🚀 Como Executar o Projeto em Desenvolvimento

### Pré-requisitos
* **Node.js:** Versão 18, 20 ou superior (testado com Node.js v26).
* **Gerenciador de Pacotes:** `npm` ou `bun`.

### Passo a Passo:

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/WallisonDarisvan/FlashMaster.git
   cd FlashMaster
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Iniciar o Ambiente de Desenvolvimento (Vite + Electron):**
   ```bash
   npm start
   ```
   *(Ou `npm run electron:dev`)*

---

## 🛠️ Como Gerar o Instalador Executável (`.exe`)

Para compilar o frontend com Vite e gerar o instalador do Windows (NSIS x64):

```bash
npm run electron:build
```

O instalador final e os arquivos de release serão criados na pasta **`release/`**:
* 📦 `release/Flash-Master-Setup-1.0.2.exe` (Instalador NSIS com atalho na Área de Trabalho e Menu Iniciar).
* 📄 `release/latest.yml` (Manifesto para auto-update via GitHub Releases).

---

## 🏗️ Estrutura de Tecnologias

| Camada | Tecnologia | Finalidade |
|---|---|---|
| **Runtime Desktop** | Electron 28 | Janela nativa, integração com sistema operacional e diálogos de arquivo |
| **Frontend** | React 19 + TypeScript | Interface gráfica reativa, controle de estado e componentes |
| **Estilização** | TailwindCSS + CSS Vanilla | Design System escuro profissional (Dark Slate/Onyx Broadcast) |
| **Build & Bundle** | Vite 6 | Servidor de desenvolvimento HMR ultrarrápido e empacotamento de produção |
| **Motor de Mídia** | FFmpeg 6.0 & FFprobe estáticos | Decodificação, medição de waveforms, filtros DSP de áudio e encode MXF OP-1a |
| **Áudio Web** | Web Audio API | Splitter/Merger de canais, simulação A/B de limiter e VU Meters |
| **Empacotador** | electron-builder 26 | Geração de instalador NSIS x64 com binários estáticos desempacotados |

---

## 👨‍💻 Autor & Suporte Técnico

* **Desenvolvedor:** Wallison Darisvan
* **Organização:** Flash Engine
* **WhatsApp / Telefone:** `(83) 99901-0832`
* **Repositório Oficial:** [GitHub - WallisonDarisvan/FlashMaster](https://github.com/WallisonDarisvan/FlashMaster)

---
*Flash Master Studio — Qualidade, Conformidade e Potência para Produção Broadcast.*
