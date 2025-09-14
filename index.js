// Configurações da API
const API_BASE_URL = "http://127.0.0.1:8000";
const WAKE_WORDS = ["inocêncio", "inocencio", "hey inocêncio", "oi inocêncio"];
const CONFIDENCE_THRESHOLD = 0.7;

// Estados do sistema
const STATES = {
  HIBERNATING: "hibernating",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
  ERROR: "error",
};

class InocencioVoiceAssistant {
  constructor() {
    this.currentState = STATES.HIBERNATING;
    this.isInitialized = false;
    this.audioStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.phraseIndex = 0;
    this.isListeningForWakeWord = false;

    // Controles de timeout
    this.wakeWordTimeout = null;
    this.questionTimeout = null;
    this.fallbackTimeout = null;

    // Elementos DOM
    this.statusIndicator = document.getElementById("statusIndicator");
    this.listeningIndicator = document.getElementById("listeningIndicator");
    this.processingIndicator = document.getElementById("processingIndicator");
    this.responseAudio = document.getElementById("responseAudio");

    // Frases motivacionais
    this.phrases = [
      "Diga 'Inocêncio' para me acordar!",
      "Estou aqui para ajudar! Me chame pelo nome.",
      "Pronto para conversar quando você quiser!",
      "Aguardando seu comando... Diga meu nome!",
      "Inocêncio dormindo... Me acorde quando precisar!",
    ];

    this.init();
  }

  async init() {
    try {
      console.log("🚀 Inicializando Inocêncio...");

      await this.loadAnnyangLibrary();
      await this.checkPermissions();
      await this.setupAudioStream();

      this.setupAnnyangCommands();
      this.setupVisualEffects();
      this.startSystem();

      this.isInitialized = true;
      this.updateStatus("SISTEMA PRONTO - Diga 'Inocêncio'");
      console.log("✅ Sistema inicializado com sucesso!");
    } catch (error) {
      console.error("❌ Erro na inicialização:", error);
      this.handleError("Falha na inicialização: " + error.message);
    }
  }

  async loadAnnyangLibrary() {
    return new Promise((resolve, reject) => {
      if (window.annyang) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/annyang/2.6.1/annyang.min.js";
      script.onload = () => {
        if (window.annyang) {
          console.log("✅ Annyang carregado");
          resolve();
        } else {
          reject(new Error("Falha ao carregar Annyang"));
        }
      };
      script.onerror = () =>
        reject(new Error("Erro ao carregar biblioteca Annyang"));
      document.head.appendChild(script);
    });
  }

  async checkPermissions() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Navegador não suporta captura de áudio");
    }

    if (!window.annyang) {
      throw new Error("Biblioteca de reconhecimento de voz não carregada");
    }

    // Testa se a API está acessível
    try {
      const response = await fetch(`${API_BASE_URL}/check`, {
        method: "GET",
        timeout: 5000,
      });
      if (!response.ok) throw new Error("API não responsiva");
      console.log("✅ API conectada");
    } catch (error) {
      throw new Error("API não acessível em " + API_BASE_URL);
    }
  }

  async setupAudioStream() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });
      console.log("✅ Microfone autorizado");
    } catch (error) {
      throw new Error("Permissão de microfone necessária");
    }
  }

  setupAnnyangCommands() {
    // Configurações do Annyang
    annyang.setLanguage("pt-BR");

    // Comandos para detecção da palavra-chave
    const commands = {};

    WAKE_WORDS.forEach((wakeWord) => {
      commands[wakeWord] = () => this.onWakeWordDetected();
      commands[`*prefix ${wakeWord}`] = () => this.onWakeWordDetected();
      commands[`${wakeWord} *suffix`] = () => this.onWakeWordDetected();
      commands[`*prefix ${wakeWord} *suffix`] = () => this.onWakeWordDetected();
    });

    // Comandos de emergência para apresentação
    commands["ativar sistema"] = () => this.onWakeWordDetected();
    commands["acordar"] = () => this.onWakeWordDetected();
    commands["começar"] = () => this.onWakeWordDetected();

    annyang.addCommands(commands);

    // Callbacks do Annyang
    annyang.addCallback("start", () => {
      console.log("🎤 Reconhecimento iniciado");
      this.isListeningForWakeWord = true;
    });

    annyang.addCallback("error", (error) => {
      console.warn("⚠️ Erro no reconhecimento:", error);
      this.handleRecognitionError(error);
    });

    annyang.addCallback("end", () => {
      console.log("🔇 Reconhecimento encerrado");
      this.isListeningForWakeWord = false;
      if (this.currentState === STATES.HIBERNATING) {
        this.restartWakeWordDetection();
      }
    });

    annyang.addCallback("result", (phrases) => {
      console.log("🔊 Detectado:", phrases);
      this.processRecognitionResult(phrases);
    });

    // Configurações de confiabilidade
    if (annyang.getSpeechRecognizer) {
      const recognizer = annyang.getSpeechRecognizer();
      recognizer.continuous = true;
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 5;
    }
  }

  processRecognitionResult(phrases) {
    if (!phrases || phrases.length === 0) return;

    const bestMatch = phrases[0].toLowerCase();
    console.log("🎯 Processando:", bestMatch);

    // Verifica se contém alguma palavra-chave
    const hasWakeWord = WAKE_WORDS.some((word) =>
      this.normalizeText(bestMatch).includes(this.normalizeText(word))
    );

    if (hasWakeWord && this.currentState === STATES.HIBERNATING) {
      console.log("🚀 Palavra-chave reconhecida:", bestMatch);
      this.onWakeWordDetected();
    }
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  startSystem() {
    this.setState(STATES.HIBERNATING);
    this.startWakeWordDetection();
    this.startPhraseRotation();
  }

  startWakeWordDetection() {
    if (this.isListeningForWakeWord) return;

    try {
      annyang.start({ autoRestart: true, continuous: true });
      this.updateStatus("ESCUTANDO - Diga 'Inocêncio'");

      // Fallback: reinicia se não detectar nada em 30 segundos
      this.fallbackTimeout = setTimeout(() => {
        this.restartWakeWordDetection();
      }, 30000);
    } catch (error) {
      console.error("❌ Erro ao iniciar detecção:", error);
      setTimeout(() => this.startWakeWordDetection(), 2000);
    }
  }

  restartWakeWordDetection() {
    console.log("🔄 Reiniciando detecção de palavra-chave");

    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    annyang.abort();
    setTimeout(() => {
      if (this.currentState === STATES.HIBERNATING) {
        this.startWakeWordDetection();
      }
    }, 1000);
  }

  onWakeWordDetected() {
    console.log("🎯 PALAVRA-CHAVE DETECTADA!");

    // Para toda detecção de palavra-chave
    annyang.abort();
    this.isListeningForWakeWord = false;

    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    // Transição para escuta de pergunta
    this.setState(STATES.LISTENING);
    this.updateStatus("OUVINDO SUA PERGUNTA...");

    // Efeito visual
    this.triggerWakeUpEffect();

    // Inicia captura da pergunta após pequeno delay
    setTimeout(() => {
      this.startQuestionCapture();
    }, 800);
  }

  startQuestionCapture() {
    if (!this.audioStream) {
      this.handleError("Stream de áudio não disponível");
      return;
    }

    console.log("📹 Capturando pergunta...");
    this.audioChunks = [];

    try {
      // Configura MediaRecorder com melhor compatibilidade
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: mimeType,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecordedAudio();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("❌ Erro no MediaRecorder:", event);
        this.handleError("Erro na captura de áudio");
      };

      // Inicia gravação
      this.mediaRecorder.start(250);

      // Para gravação após 5 segundos
      this.questionTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
          this.mediaRecorder.stop();
        }
      }, 5000);

      // Animação visual
      this.startListeningAnimation();
    } catch (error) {
      console.error("❌ Erro ao configurar gravação:", error);
      this.handleError("Erro na configuração de áudio");
    }
  }

  async processRecordedAudio() {
    if (this.audioChunks.length === 0) {
      this.handleError("Nenhum áudio capturado");
      return;
    }

    this.setState(STATES.PROCESSING);
    this.updateStatus("PROCESSANDO...");

    try {
      // Cria blob do áudio
      const audioBlob = new Blob(this.audioChunks, {
        type: this.mediaRecorder.mimeType,
      });

      console.log("📤 Enviando áudio:", {
        size: `${(audioBlob.size / 1024).toFixed(2)}KB`,
        type: audioBlob.type,
      });

      // Envia para API
      const formData = new FormData();
      formData.append("file", audioBlob, "pergunta.webm");

      const response = await fetch(`${API_BASE_URL}/voice`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      // Recebe resposta em áudio
      const audioResponse = await response.blob();
      console.log(
        "📥 Resposta recebida:",
        `${(audioResponse.size / 1024).toFixed(2)}KB`
      );

      await this.playResponse(audioResponse);
    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      this.handleError("Erro: " + error.message);
    }
  }

  async playResponse(audioBlob) {
    this.setState(STATES.SPEAKING);
    this.updateStatus("RESPONDENDO...");

    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      this.responseAudio.src = audioUrl;

      this.responseAudio.onended = () => {
        console.log("✅ Resposta finalizada");
        URL.revokeObjectURL(audioUrl);
        this.onResponseEnded();
      };

      this.responseAudio.onerror = (error) => {
        console.error("❌ Erro na reprodução:", error);
        URL.revokeObjectURL(audioUrl);
        this.handleError("Erro na reprodução da resposta");
      };

      await this.responseAudio.play();
      this.startSpeakingAnimation();
    } catch (error) {
      console.error("❌ Erro ao reproduzir:", error);
      this.handleError("Erro na reprodução: " + error.message);
    }
  }

  onResponseEnded() {
    console.log("🔄 Voltando ao modo hibernação");
    this.setState(STATES.HIBERNATING);
    this.updateStatus("PRONTO - Diga 'Inocêncio'");

    // Volta a detectar palavra-chave após 2 segundos
    setTimeout(() => {
      this.startWakeWordDetection();
    }, 2000);
  }

  setState(newState) {
    if (this.currentState === newState) return;

    console.log(`🔄 Estado: ${this.currentState} → ${newState}`);
    this.currentState = newState;
    this.updateVisualState();
  }

  updateStatus(message) {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = `● ${message}`;
    }
    console.log("📊 Status:", message);
  }

  updateVisualState() {
    // Limpa todos os indicadores
    this.hideAllIndicators();

    // Remove classes anteriores
    document.body.className = "";
    document.body.classList.add(this.currentState);

    // Mostra indicador apropriado
    switch (this.currentState) {
      case STATES.LISTENING:
        this.listeningIndicator.style.display = "flex";
        break;
      case STATES.PROCESSING:
        this.processingIndicator.style.display = "flex";
        break;
      case STATES.SPEAKING:
        this.triggerSpeakingEffect();
        break;
    }
  }

  hideAllIndicators() {
    this.listeningIndicator.style.display = "none";
    this.processingIndicator.style.display = "none";
  }

  handleRecognitionError(error) {
    console.warn("⚠️ Erro de reconhecimento:", error);

    // Erros que podem ser ignorados
    const ignorableErrors = ["no-speech", "aborted"];
    if (ignorableErrors.includes(error.error)) {
      return;
    }

    // Para erros críticos, reinicia o sistema
    if (["not-allowed", "service-not-allowed"].includes(error.error)) {
      this.handleError("Permissão de microfone necessária");
      return;
    }

    // Outros erros: restart automático
    setTimeout(() => {
      if (this.currentState === STATES.HIBERNATING) {
        this.restartWakeWordDetection();
      }
    }, 2000);
  }

  handleError(message) {
    console.error("❌ ERRO:", message);
    this.setState(STATES.ERROR);
    this.updateStatus("ERRO - " + message);

    // Tenta recuperar após 5 segundos
    setTimeout(() => {
      this.setState(STATES.HIBERNATING);
      this.updateStatus("RECUPERANDO...");
      this.startWakeWordDetection();
    }, 5000);
  }

  // Efeitos visuais
  setupVisualEffects() {
    this.setupPupilTracking();
  }

  triggerWakeUpEffect() {
    // Pisca os olhos
    const eyes = document.querySelectorAll(".eye");
    eyes.forEach((eye) => {
      eye.style.transform = "scale(1.1)";
      setTimeout(() => {
        eye.style.transform = "scale(1)";
      }, 300);
    });
  }

  startListeningAnimation() {
    const waves = this.listeningIndicator.querySelectorAll(".wave");
    if (waves.length === 0) return;

    let frame = 0;
    const animate = () => {
      if (this.currentState === STATES.LISTENING) {
        waves.forEach((wave, index) => {
          const offset = index * 120;
          const scale = 0.5 + 0.5 * Math.sin((frame + offset) * 0.1);
          wave.style.transform = `scaleY(${scale})`;
        });
        frame++;
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  startSpeakingAnimation() {
    // Animação durante a fala
    const pupils = document.querySelectorAll(".pupil");
    let frame = 0;

    const animate = () => {
      if (this.currentState === STATES.SPEAKING) {
        const moveX = 3 * Math.sin(frame * 0.1);
        const moveY = 2 * Math.cos(frame * 0.15);

        pupils.forEach((pupil) => {
          pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });

        frame++;
        requestAnimationFrame(animate);
      } else {
        pupils.forEach((pupil) => {
          pupil.style.transform = "translate(0, 0)";
        });
      }
    };
    animate();
  }

  triggerSpeakingEffect() {
    // Efeito visual durante a fala
    this.startSpeakingAnimation();
  }

  startPhraseRotation() {
    setInterval(() => {
      if (
        this.currentState === STATES.HIBERNATING &&
        !this.isListeningForWakeWord
      ) {
        this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
        console.log("💭", this.phrases[this.phraseIndex]);
      }
    }, 6000);
  }

  setupPupilTracking() {
    const pupils = document.querySelectorAll(".pupil");
    if (pupils.length === 0) return;

    const movePupils = (x, y) => {
      pupils.forEach((pupil) => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = x - centerX;
        const deltaY = y - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = rect.width * 0.2;
        const limitedDistance = Math.min(distance, maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const moveX = Math.cos(angle) * limitedDistance;
        const moveY = Math.sin(angle) * limitedDistance;

        if (this.currentState !== STATES.SPEAKING) {
          pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        }
      });
    };

    document.addEventListener("mousemove", (e) => {
      movePupils(e.clientX, e.clientY);
    });

    document.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        movePupils(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
  }

  // Métodos de teste para apresentação
  testSystem() {
    console.log("🧪 TESTE DO SISTEMA");
    this.onWakeWordDetected();
  }

  forceActivation() {
    console.log("🚨 ATIVAÇÃO FORÇADA");
    annyang.abort();
    this.onWakeWordDetected();
  }

  getSystemStatus() {
    return {
      state: this.currentState,
      initialized: this.isInitialized,
      listening: this.isListeningForWakeWord,
      annyang: !!window.annyang,
      stream: !!this.audioStream,
    };
  }
}

// Inicialização global
let inocencio = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎬 Iniciando sistema Inocêncio...");

  try {
    inocencio = new InocencioVoiceAssistant();

    // Métodos globais para apresentação/debug
    window.inocencio = inocencio;
    window.testInocencio = () => inocencio.testSystem();
    window.forceActivation = () => inocencio.forceActivation();
    window.systemStatus = () => {
      const status = inocencio.getSystemStatus();
      console.table(status);
      return status;
    };

    console.log("✅ Sistema pronto!");
    console.log("🔧 Comandos de teste:");
    console.log("  - testInocencio() - Testa o sistema");
    console.log("  - forceActivation() - Ativa forçadamente");
    console.log("  - systemStatus() - Mostra status");
  } catch (error) {
    console.error("❌ Falha crítica:", error);
  }
});

// Cleanup ao sair
window.addEventListener("beforeunload", () => {
  if (inocencio && window.annyang) {
    annyang.abort();
  }
});
