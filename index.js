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
    this.silenceTimeout = null;

    // Detecção de silêncio
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.silenceThreshold = 30; // Limite para considerar silêncio
    this.silenceDuration = 2000; // 2 segundos de silêncio para parar
    this.maxRecordingTime = 10000; // 10 segundos máximo
    this.minRecordingTime = 1000; // 1 segundo mínimo
    this.recordingStartTime = null;

    // Elementos DOM
    this.statusIndicator = document.getElementById("statusIndicator");
    this.listeningIndicator = document.getElementById("listeningIndicator");
    this.processingIndicator = document.getElementById("processingIndicator");
    this.responseAudio = document.getElementById("responseAudio");

    // Frases motivacionais mais intuitivas e amigáveis
    this.phrases = [
      "👋 Olá! Diga 'Inocêncio' para começar nossa conversa!",
      "😊 Estou dormindo... Me acorde falando 'Inocêncio'!",
      "🎤 Pronto para te ajudar! Apenas diga meu nome: 'Inocêncio'",
      "💤 Aguardando... Fale 'Inocêncio' quando quiser conversar!",
      "🤖 Sou o Inocêncio! Me chame pelo nome para começarmos!",
      "✨ Dormindo tranquilo... Diga 'Inocêncio' para me despertar!",
    ];

    this.init();
  }

  // Função melhorada para limpeza de recursos
  cleanupRecording() {
    console.log("🧹 Limpando recursos de gravação...");

    // Limpar timeouts
    if (this.questionTimeout) {
      clearTimeout(this.questionTimeout);
      this.questionTimeout = null;
    }

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    // Parar MediaRecorder se ainda estiver ativo
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    // Limpar análise de áudio
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    // Reset do tempo de gravação
    this.recordingStartTime = null;
  }

  async init() {
    try {
      console.log("🚀 Inicializando Inocêncio...");

      await this.loadAnnyangLibrary();
      await this.checkPermissions();
      await this.setupAudioStream();
      await this.setupAudioContext();

      this.setupAnnyangCommands();
      this.setupVisualEffects();
      this.startSystem();

      this.isInitialized = true;
      this.updateStatus("🟢 PRONTO - Diga 'Inocêncio' para começar!");
      console.log("✅ Sistema inicializado com sucesso!");
    } catch (error) {
      console.error("❌ Erro na inicialização:", error);
      this.handleError("Falha na inicialização: " + error.message);
    }
  }

  async setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      console.log("✅ Contexto de áudio criado");
    } catch (error) {
      console.warn("⚠️ Erro ao criar contexto de áudio:", error);
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
      const response = await fetch(`${API_BASE_URL}/tts?text=teste`, {
        method: "GET",
      });
      if (!response.ok) throw new Error("API não responsiva");
      console.log("✅ API conectada");
    } catch (error) {
      console.warn("⚠️ API pode não estar acessível:", error.message);
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

      // Aguarda um pouco antes de resetar o flag
      setTimeout(() => {
        this.isListeningForWakeWord = false;

        // Só reinicia se ainda estiver em hibernação e não foi interrompido intencionalmente
        if (this.currentState === STATES.HIBERNATING) {
          console.log("🔄 Reconhecimento encerrou, reiniciando...");
          this.restartWakeWordDetection();
        }
      }, 1000);
    });

    annyang.addCallback("result", (phrases) => {
      console.log("🔊 Detectado:", phrases);
      this.processRecognitionResult(phrases);

      // Se detectou fala mas não era palavra-chave, dá uma dica
      if (
        phrases &&
        phrases.length > 0 &&
        this.currentState === STATES.HIBERNATING
      ) {
        const bestMatch = phrases[0].toLowerCase();
        const hasWakeWord = WAKE_WORDS.some((word) =>
          this.normalizeText(bestMatch).includes(this.normalizeText(word))
        );

        if (!hasWakeWord && bestMatch.length > 3) {
          console.log("💡 Pessoa tentou falar sem palavra-chave:", bestMatch);
          this.updateStatus("👋 Oi! Diga 'Inocêncio' primeiro para me ativar!");

          // Volta à mensagem normal depois de 3 segundos
          setTimeout(() => {
            if (this.currentState === STATES.HIBERNATING) {
              this.updateStatus(
                "😊 Fale 'Inocêncio' para começar nossa conversa!"
              );
            }
          }, 3000);
        }
      }
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
    } else if (hasWakeWord && this.currentState !== STATES.HIBERNATING) {
      // Pessoa tentando chamar o robô quando ele não está disponível
      console.log(
        "⚠️ Tentativa de ativação durante estado:",
        this.currentState
      );

      if (this.currentState === STATES.PROCESSING) {
        this.updateStatus("⏳ Ainda estou pensando! Aguarde...");
      } else if (this.currentState === STATES.SPEAKING) {
        this.updateStatus("🗣️ Deixe-me terminar de falar primeiro!");
      } else if (this.currentState === STATES.LISTENING) {
        this.updateStatus("👂 Já estou ouvindo! Continue falando...");
      }
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
    if (this.isListeningForWakeWord) {
      console.log("⚠️ Já está escutando, ignorando nova tentativa");
      return;
    }

    try {
      console.log("🎤 Iniciando detecção de palavra-chave...");

      // Marca que está tentando iniciar
      this.isListeningForWakeWord = true;

      annyang.start({ autoRestart: false, continuous: false });
      this.updateStatus("👂 ESCUTANDO - Fale 'Inocêncio' agora!");

      // Fallback: reinicia se não detectar nada em 25 segundos
      this.fallbackTimeout = setTimeout(() => {
        console.log("⏰ Timeout de detecção, reiniciando...");
        this.isListeningForWakeWord = false;
        this.restartWakeWordDetection();
      }, 25000);
    } catch (error) {
      console.error("❌ Erro ao iniciar detecção:", error);
      this.isListeningForWakeWord = false;

      // Tenta novamente após delay maior
      setTimeout(() => {
        if (this.currentState === STATES.HIBERNATING) {
          this.updateStatus("🔄 Tentando novamente...");
          this.startWakeWordDetection();
        }
      }, 4000);
    }
  }

  restartWakeWordDetection() {
    console.log("🔄 Reiniciando detecção de palavra-chave");

    // Limpa timeouts existentes
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    // Para completamente o annyang atual
    try {
      annyang.abort();
    } catch (e) {
      console.warn("Erro ao abortar annyang:", e);
    }

    // Aguarda um tempo maior para evitar conflitos
    setTimeout(() => {
      if (
        this.currentState === STATES.HIBERNATING &&
        !this.isListeningForWakeWord
      ) {
        this.updateStatus("🔄 Reiniciando... Aguarde...");
        setTimeout(() => {
          this.startWakeWordDetection();
        }, 1000);
      }
    }, 2000);
  }

  onWakeWordDetected() {
    console.log("🎯 PALAVRA-CHAVE DETECTADA!");

    // Limpa flag imediatamente
    this.isListeningForWakeWord = false;

    // Para toda detecção de palavra-chave
    try {
      annyang.abort();
    } catch (e) {
      console.warn("Erro ao abortar annyang:", e);
    }

    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }

    // Só processa se estiver realmente em hibernação
    if (this.currentState !== STATES.HIBERNATING) {
      console.log("⚠️ Não está em hibernação, ignorando palavra-chave");
      this.updateStatus("⚠️ Estou escutando! Faça sua pergunta!");
      return;
    }

    // Transição para escuta de pergunta
    this.setState(STATES.LISTENING);
    this.updateStatus("🎤 PODE FALAR! Faça sua pergunta agora...");

    // Efeito visual
    this.triggerWakeUpEffect();

    // Inicia captura da pergunta após pequeno delay
    setTimeout(() => {
      this.startQuestionCapture();
    }, 800);
  }

  startQuestionCapture() {
    if (!this.audioStream || !this.audioContext) {
      this.handleError("Stream de áudio não disponível");
      return;
    }

    this.cleanupRecording();

    console.log("📹 Capturando pergunta com detecção de silêncio...");
    this.audioChunks = [];
    this.recordingStartTime = Date.now();

    try {
      // Configura análise de áudio para detecção de silêncio
      this.setupSilenceDetection();

      // Configura MediaRecorder
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
          console.log(`📝 Chunk capturado: ${event.data.size} bytes`);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log("⏹️ Gravação finalizada");
        this.processRecordedAudio();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("❌ Erro no MediaRecorder:", event);
        this.cleanupRecording();
        this.handleError("Erro na captura de áudio");
      };

      // Inicia gravação
      this.mediaRecorder.start(100); // Chunks menores para melhor controle

      // Timeout máximo de segurança
      this.questionTimeout = setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
          console.log("⏰ Gravação parada por timeout máximo");
          this.mediaRecorder.stop();
        }
      }, this.maxRecordingTime);

      // Animação visual
      this.startListeningAnimation();
    } catch (error) {
      console.error("❌ Erro ao configurar gravação:", error);
      this.cleanupRecording();
      this.handleError("Erro na configuração de áudio");
    }
  }

  setupSilenceDetection() {
    try {
      // Cria analisador de áudio
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Conecta microfone ao analisador
      this.microphone = this.audioContext.createMediaStreamSource(
        this.audioStream
      );
      this.microphone.connect(this.analyser);

      // Inicia monitoramento
      this.monitorAudioLevel();
    } catch (error) {
      console.warn("⚠️ Erro ao configurar detecção de silêncio:", error);
      // Continua sem detecção de silêncio
    }
  }

  monitorAudioLevel() {
    if (!this.analyser || this.currentState !== STATES.LISTENING) {
      return;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calcula nível médio de áudio
    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

    // Verifica se está em silêncio
    const isSilent = average < this.silenceThreshold;
    const recordingTime = Date.now() - this.recordingStartTime;

    if (isSilent && recordingTime > this.minRecordingTime) {
      // Inicia contador de silêncio se não existir
      if (!this.silenceTimeout) {
        console.log("🤫 Detectando silêncio...");
        this.silenceTimeout = setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            console.log("🔇 Parando gravação por silêncio prolongado");
            this.mediaRecorder.stop();
          }
        }, this.silenceDuration);
      }
    } else {
      // Cancela contador de silêncio se houver som
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    }

    // Continua monitorando
    if (this.currentState === STATES.LISTENING) {
      requestAnimationFrame(() => this.monitorAudioLevel());
    }
  }

  async processRecordedAudio() {
    // Verifica se temos áudio suficiente
    if (this.audioChunks.length === 0) {
      console.log(
        "⚠️ Nenhum chunk de áudio capturado, retornando ao modo hibernação"
      );
      this.updateStatus("🤔 Não consegui ouvir... Tente novamente!");
      setTimeout(() => this.onResponseEnded(), 2000);
      return;
    }

    // Verifica se a gravação foi muito curta
    const recordingTime = Date.now() - this.recordingStartTime;
    if (recordingTime < this.minRecordingTime) {
      console.log("⚠️ Gravação muito curta, retornando ao modo hibernação");
      this.updateStatus("🤔 Muito rápido! Fale mais devagar...");
      setTimeout(() => this.onResponseEnded(), 2000);
      return;
    }

    this.setState(STATES.PROCESSING);
    this.updateStatus("🧠 PENSANDO... Aguarde um momento!");

    try {
      // Cria blob do áudio
      const mimeType = this.mediaRecorder
        ? this.mediaRecorder.mimeType
        : "audio/webm";
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });

      console.log("📤 Enviando áudio:", {
        size: `${(audioBlob.size / 1024).toFixed(2)}KB`,
        type: audioBlob.type,
        duration: `${(recordingTime / 1000).toFixed(1)}s`,
        chunks: this.audioChunks.length,
      });

      // Envia para API
      const formData = new FormData();
      formData.append("file", audioBlob, "pergunta.webm");

      const response = await fetch(`${API_BASE_URL}/voice`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30000),
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
    } finally {
      this.cleanupRecording();
    }
  }

  async playResponse(audioBlob) {
    this.setState(STATES.SPEAKING);
    this.updateStatus("🗣️ RESPONDENDO... Escute com atenção!");

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

    this.cleanupRecording();
    this.setState(STATES.HIBERNATING);
    this.updateStatus("✅ PRONTO - Diga 'Inocêncio' para nova pergunta!");

    // Aguarda um tempo antes de voltar a escutar
    setTimeout(() => {
      this.startWakeWordDetection();
    }, 3000);
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

    // Erros que podem ser completamente ignorados
    const ignorableErrors = ["no-speech", "aborted", "network"];
    if (ignorableErrors.includes(error.error)) {
      // Para erro "aborted", aguarda um pouco mais antes de reiniciar
      if (
        error.error === "aborted" &&
        this.currentState === STATES.HIBERNATING
      ) {
        setTimeout(() => {
          this.restartWakeWordDetection();
        }, 3000);
      }
      return;
    }

    // Para erros críticos, reinicia o sistema
    if (["not-allowed", "service-not-allowed"].includes(error.error)) {
      this.handleError("Permissão de microfone necessária");
      return;
    }

    // Outros erros: restart automático com delay maior
    setTimeout(() => {
      if (this.currentState === STATES.HIBERNATING) {
        this.restartWakeWordDetection();
      }
    }, 5000);
  }

  handleError(message) {
    console.error("❌ ERRO:", message);
    this.setState(STATES.ERROR);

    // Mensagens de erro mais amigáveis
    let friendlyMessage = "❌ ERRO";

    if (message.includes("microfone")) {
      friendlyMessage = "🎤 Preciso do seu microfone para funcionar!";
    } else if (message.includes("API")) {
      friendlyMessage = "🌐 Problema de conexão! Tentando novamente...";
    } else if (message.includes("áudio")) {
      friendlyMessage = "🔊 Problema com o áudio! Reiniciando...";
    } else {
      friendlyMessage = "⚠️ Algo deu errado! Reiniciando sistema...";
    }

    this.updateStatus(friendlyMessage);

    // Tenta recuperar após 4 segundos
    setTimeout(() => {
      this.setState(STATES.HIBERNATING);
      this.updateStatus("🔄 RECUPERANDO... Aguarde um momento...");

      // Aguarda mais um pouco antes de voltar ao normal
      setTimeout(() => {
        this.updateStatus("✅ PRONTO - Diga 'Inocêncio' para começar!");
        this.startWakeWordDetection();
      }, 2000);
    }, 4000);
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
        this.updateStatus(this.phrases[this.phraseIndex]);
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
      audioContext: !!this.audioContext,
      recording: this.mediaRecorder?.state || "inactive",
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
  if (inocencio) {
    inocencio.cleanupRecording();
  }
});
