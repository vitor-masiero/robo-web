// Frases amigáveis do Inocêncio
    const phrases = [
      "Olá! Eu sou o Inocêncio, seu porteiro virtual!",
      "Bem-vindos ao nosso evento especial! 🎉",
      "É um prazer recebê-los aqui hoje!",
      "Que alegria ter vocês conosco!",
      "Preparem-se para uma experiência incrível!",
      "Sejam muito bem-vindos! Vamos começar?"
    ];

    let phraseIndex = 0;
    const speechElement = document.getElementById('speechText');

    // Troca de frases a cada 4 segundos
    setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      speechElement.textContent = phrases[phraseIndex];
      
      // Efeito de escala na troca de frase
      speechElement.style.transform = 'scale(1.1)';
      setTimeout(() => {
        speechElement.style.transform = 'scale(1)';
      }, 200);
    }, 4000);

    // Função para mover pupilas
    function movePupils(clientX, clientY) {
      const pupils = document.querySelectorAll(".pupil");
      pupils.forEach(pupil => {
        const eye = pupil.parentElement;
        const rect = eye.getBoundingClientRect();
        const eyeCenterX = rect.left + rect.width / 2;
        const eyeCenterY = rect.top + rect.height / 2;
        
        // Calcula a distância e direção do olhar
        const deltaX = clientX - eyeCenterX;
        const deltaY = clientY - eyeCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Limita o movimento da pupila dentro do olho
        const maxDistance = rect.width * 0.15;
        const limitedDistance = Math.min(distance, maxDistance);
        const angle = Math.atan2(deltaY, deltaX);
        
        const moveX = Math.cos(angle) * limitedDistance;
        const moveY = Math.sin(angle) * limitedDistance;
        
        pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    }

    // Pupilas seguem o mouse
    document.addEventListener("mousemove", (e) => {
      movePupils(e.clientX, e.clientY);
    });

    // Adaptação para tablet: olhar segue o toque
    document.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      movePupils(touch.clientX, touch.clientY);
    });

    // Efeito de clique/toque para interação
    document.addEventListener("click", (e) => {
      createRipple(e.clientX, e.clientY);
    });

    document.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      createRipple(touch.clientX, touch.clientY);
    });

    // Cria efeito de ondas ao tocar
    function createRipple(x, y) {
      const ripple = document.createElement('div');
      ripple.style.position = 'fixed';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.style.width = '20px';
      ripple.style.height = '20px';
      ripple.style.background = 'rgba(0, 229, 255, 0.6)';
      ripple.style.borderRadius = '50%';
      ripple.style.transform = 'translate(-50%, -50%)';
      ripple.style.pointerEvents = 'none';
      ripple.style.zIndex = '1000';
      ripple.style.animation = 'rippleEffect 0.8s ease-out forwards';
      
      document.body.appendChild(ripple);
      
      // Remove o elemento após a animação
      setTimeout(() => {
        ripple.remove();
      }, 800);
    }

    // Adiciona keyframes para o efeito ripple via JavaScript
    const style = document.createElement('style');
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

    // Movimento automático ocasional das pupilas
    setInterval(() => {
      if (!document.querySelector(':hover')) {
        const randomX = Math.random() * window.innerWidth;
        const randomY = Math.random() * window.innerHeight;
        movePupils(randomX, randomY);
      }
    }, 8000);

    // Prevenção de scroll em dispositivos móveis
    document.addEventListener('touchmove', function(e) {
      e.preventDefault();
    }, { passive: false });