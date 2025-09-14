// Configurações da API
const API_BASE_URL = "http://127.0.0.1:8000"; // Ajustar para sua API
const WAKE_WORD = "inocencio";

// Estados do sistema
const STATES = {
  HIBERNATING: "hibernating",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
};

class InocencioVoiceAssistant {
  constructor() {
    this.currentState = STATES.HIBERNATING;
    this.recognition = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioChunks = [];
    this.isSupported = false;
    this.phraseIndex = 0;

    // Elementos do DOM
    this.statusIcon = document.getElementById("statusIcon");
    this.statusText = document.getElementById("statusText");
    this.speechText = document.getElementById("speechText");
    this.robotFace = document.getElementById("robotFace");
    this.robotMouth = document.getElementById("robotMouth");
    this.volumeIndicator = document.getElementById("volumeIndicator");
    this.debugPanel = document.getElementById("debugPanel");
    this.debugStatus = document.getElementById("debugStatus");
    this.lastTranscription = document.getElementById("lastTranscription");

    // Frases de apresentação
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
      await this.checkBrowserSupport();
      await this.requestMicrophonePermission();
      this.setupEventListeners();
      this.startWakeWordDetection();
      this.startPhraseRotation();
      this.setupPupilTracking();
      this.updateDebug("Sistema inicializado com sucesso");
    } catch (error) {
      console.error("Erro na inicialização:", error);
      this.updateDebug(`Erro: ${error.message}`);
      this.showError("Erro ao inicializar o sistema");
    }
  }

  async checkBrowserSupport() {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      throw new Error("Navegador não suporta reconhecimento de voz");
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Navegador não suporta captura de áudio");
    }

    this.isSupported = true;
  }

  async requestMicrophonePermission() {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      console.log("Permissão de microfone concedida");
    } catch (error) {
      throw new Error("Permissão de microfone negada");
    }
  }

  setupEventListeners() {
    // Debug controls
    document.getElementById("debugToggle").addEventListener("click", () => {
      this.debugPanel.classList.toggle("visible");
    });

    document.getElementById("toggleListening").addEventListener("click", () => {
      if (this.currentState === STATES.HIBERNATING) {
        this.startWakeWordDetection();
      } else {
        this.stopAllRecognition();
        this.setState(STATES.HIBERNATING);
      }
    });

    document.getElementById("testTTS").addEventListener("click", () => {
      this.testTTS();
    });

    // Prevent page refresh on mobile
    document.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );

    // Audio element event listeners
    document.addEventListener("click", (e) => {
      this.createRipple(e.clientX, e.clientY);
    });

    document.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      this.createRipple(touch.clientX, touch.clientY);
    });
  }

  startWakeWordDetection() {
    if (!this.isSupported) return;

    this.recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = "pt-BR";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log("Wake word detection started");
      this.setState(STATES.HIBERNATING);
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript.toLowerCase().trim();
        this.lastTranscription.textContent = transcript;

        console.log("Detected:", transcript);

        if (transcript.includes(WAKE_WORD)) {
          console.log("Wake word detected!");
          this.onWakeWordDetected();
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Wake word recognition error:", event.error);
      if (event.error !== "aborted") {
        setTimeout(() => this.startWakeWordDetection(), 1000);
      }
    };

    this.recognition.onend = () => {
      if (this.currentState === STATES.HIBERNATING) {
        setTimeout(() => this.startWakeWordDetection(), 500);
      }
    };

    this.recognition.start();
  }

  onWakeWordDetected() {
    this.stopAllRecognition();
    this.setState(STATES.LISTENING);
    this.speechText.textContent = "Estou ouvindo... Pode falar!";
    this.startQuestionCapture();
  }

  startQuestionCapture() {
    if (!this.audioStream) {
      this.showError("Stream de áudio não disponível");
      return;
    }

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.audioStream, {
      mimeType: "audio/webm;codecs=opus",
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      if (this.audioChunks.length > 0) {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        await this.sendAudioToAPI(audioBlob);
      }
    };

    this.mediaRecorder.start();

    // Para a gravação após 5 segundos
    setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
        this.mediaRecorder.stop();
      }
    }, 5000);

    // Simula o indicador de volume
    this.startVolumeAnimation();
  }

  async sendAudioToAPI(audioBlob) {
    this.setState(STATES.PROCESSING);
    this.speechText.textContent = "Processando sua pergunta...";

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "question.webm");

      const response = await fetch(`${API_BASE_URL}/voice`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      // A resposta é um stream de áudio
      const audioData = await response.blob();
      await this.playAudioResponse(audioData);
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      this.showError("Erro ao processar sua pergunta");
    }
  }

  async playAudioResponse(audioBlob) {
    this.setState(STATES.SPEAKING);
    this.speechText.textContent = "Falando...";

    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.onSpeechEnded();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        this.showError("Erro ao reproduzir resposta");
      };

      await audio.play();
    } catch (error) {
      console.error("Erro ao reproduzir áudio:", error);
      this.showError("Erro ao reproduzir resposta");
    }
  }

  onSpeechEnded() {
    this.setState(STATES.HIBERNATING);
    this.speechText.textContent = this.phrases[this.phraseIndex];
    setTimeout(() => {
      this.startWakeWordDetection();
    }, 1000);
  }

  setState(newState) {
    this.currentState = newState;
    this.updateVisualState();
    this.updateDebug(`Estado: ${newState}`);
  }

  updateVisualState() {
    // Remove todas as classes de estado
    this.robotFace.classList.remove(
      "hibernating",
      "listening",
      "processing",
      "speaking"
    );
    this.statusIcon.classList.remove(
      "hibernating",
      "listening",
      "processing",
      "speaking"
    );
    this.robotMouth.classList.remove("speaking", "listening");

    // Adiciona a classe do estado atual
    this.robotFace.classList.add(this.currentState);
    this.statusIcon.classList.add(this.currentState);

    // Estados específicos
    switch (this.currentState) {
      case STATES.HIBERNATING:
        this.statusText.textContent = "Hibernando...";
        this.volumeIndicator.classList.remove("active");
        break;
      case STATES.LISTENING:
        this.statusText.textContent = "Ouvindo...";
        this.robotMouth.classList.add("listening");
        this.volumeIndicator.classList.add("active");
        break;
      case STATES.PROCESSING:
        this.statusText.textContent = "Processando...";
        this.volumeIndicator.classList.remove("active");
        break;
      case STATES.SPEAKING:
        this.statusText.textContent = "Falando...";
        this.robotMouth.classList.add("speaking");
        this.volumeIndicator.classList.remove("active");
        break;
    }
  }

  startVolumeAnimation() {
    const bars = this.volumeIndicator.querySelectorAll(".volume-bar");
    let animationId;

    const animate = () => {
      if (this.currentState === STATES.LISTENING) {
        bars.forEach((bar, index) => {
          const height = Math.random() * 20 + 5;
          bar.style.height = `${height}px`;
        });
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();
  }

  startPhraseRotation() {
    setInterval(() => {
      if (this.currentState === STATES.HIBERNATING) {
        this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
        this.speechText.textContent = this.phrases[this.phraseIndex];

        // Efeito de escala na troca de frase
        this.speechText.style.transform = "scale(1.1)";
        setTimeout(() => {
          this.speechText.style.transform = "scale(1)";
        }, 200);
      }
    }, 4000);
  }

  setupPupilTracking() {
    const movePupils = (clientX, clientY) => {
      const pupils = document.querySelectorAll(".pupil");
      pupils.forEach((pupil) => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;

        const deltaX = clientX - eyeCenterX;
        const deltaY = clientY - eyeCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        const maxDistance = rect.width * 0.15;
        const limitedDistance = Math.min(distance, maxDistance);
        const angle = Math.atan2(deltaY, deltaX);

        const moveX = Math.cos(angle) * limitedDistance;
        const moveY = Math.sin(angle) * limitedDistance;

        pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    // Mouse tracking
    document.addEventListener("mousemove", (e) => {
      movePupils(e.clientX, e.clientY);
    });

    // Touch tracking
    document.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        movePupils(touch.clientX, touch.clientY);
      }
    });

    // Random movement when idle
    setInterval(() => {
      if (
        !document.querySelector(":hover") &&
        this.currentState === STATES.HIBERNATING
      ) {
        const randomX = Math.random() * window.innerWidth;
        const randomY = Math.random() * window.innerHeight;
        movePupils(randomX, randomY);
      }
    }, 8000);
  }

  createRipple(x, y) {
    const ripple = document.createElement("div");
    ripple.style.position = "fixed";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.style.width = "20px";
    ripple.style.height = "20px";
    ripple.style.background = "rgba(0, 229, 255, 0.6)";
    ripple.style.borderRadius = "50%";
    ripple.style.transform = "translate(-50%, -50%)";
    ripple.style.pointerEvents = "none";
    ripple.style.zIndex = "1000";
    ripple.style.animation = "rippleEffect 0.8s ease-out forwards";

    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 800);
  }

  stopAllRecognition() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    this.isRecording = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
  }

  showError(message) {
    this.speechText.textContent = message;
    this.setState(STATES.HIBERNATING);
    setTimeout(() => {
      this.speechText.textContent = this.phrases[this.phraseIndex];
      this.startWakeWordDetection();
    }, 3000);
  }

  updateDebug(message) {
    this.debugStatus.textContent = message;
    console.log("[Inocêncio]", message);
  }

  async testTTS() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/tts?text=Olá! Este é um teste do sistema de voz do Inocêncio!`
      );
      if (response.ok) {
        const audioBlob = await response.blob();
        await this.playAudioResponse(audioBlob);
      } else {
        this.showError("Erro no teste TTS");
      }
    } catch (error) {
      console.error("Erro no teste TTS:", error);
      this.showError("Erro de conexão com a API");
    }
  }
}

// Adiciona estilos dinâmicos
const style = document.createElement("style");
style.textContent = `
  @keyframes rippleEffect {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0.8;
    }
    100% {
      transform: translate(-50%, -50%) scale(20);
      opacity: 0;
    }
  }
  
  .speech {
    transition: transform 0.2s ease-in-out;
  }
`;
document.head.appendChild(style);

// Inicializa o assistente quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  window.inocencio = new InocencioVoiceAssistant();
});

// Tratamento de erros globais
window.addEventListener("error", (event) => {
  console.error("Erro global:", event.error);
});

// Previne o zoom em dispositivos móveis
document.addEventListener("gesturestart", (e) => {
  e.preventDefault();
});

document.addEventListener("gesturechange", (e) => {
  e.preventDefault();
});

document.addEventListener("gestureend", (e) => {
  e.preventDefault();
});
