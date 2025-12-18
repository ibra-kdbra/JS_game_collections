// Loading and initialization
document.addEventListener("DOMContentLoaded", function () {
  // Hide loading screen after everything is loaded
  setTimeout(function () {
    const loadingScreen = document.getElementById("loadingScreen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
      setTimeout(() => {
        loadingScreen.style.display = "none";
      }, 500);
    }
  }, 1500);

  // Show performance indicator in development
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    const perfIndicator = document.getElementById("perfIndicator");
    if (perfIndicator) {
      perfIndicator.style.display = "block";

      // Update FPS counter
      let fps = 60;
      let lastTime = performance.now();

      function updateFPS() {
        const now = performance.now();
        const delta = now - lastTime;
        fps = Math.round(1000 / delta);
        lastTime = now;

        const perfText = document.getElementById("perfText");
        if (perfText) {
          perfText.textContent = `FPS: ${fps} | Theme: ${
            LiveBackground ? LiveBackground.getTheme() : "Unknown"
          }`;
        }

        requestAnimationFrame(updateFPS);
      }

      updateFPS();
    }
  }

  // Add keyboard shortcuts for theme switching
  document.addEventListener("keydown", function (e) {
    // Press 'T' to cycle themes
    if (e.key === "t" || e.key === "T") {
      if (typeof LiveBackground !== "undefined") {
        LiveBackground.nextTheme();

        // Show theme notification
        const theme = LiveBackground.getTheme();
        const notification = document.createElement("div");
        notification.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0, 0, 0, 0.9);
              color: white;
              padding: 20px 30px;
              border-radius: 8px;
              font-family: 'Source Sans Pro', sans-serif;
              font-size: 1.2rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 2px;
              z-index: 10000;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.2);
              animation: fadeInOut 2s ease;
            `;
        notification.textContent = `Theme: ${theme}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          document.body.removeChild(notification);
        }, 2000);
      }
    }

    // Press 'P' to toggle performance indicator
    if (e.key === "p" || e.key === "P") {
      const perfIndicator = document.getElementById("perfIndicator");
      if (perfIndicator) {
        const isVisible = perfIndicator.style.display !== "none";
        perfIndicator.style.display = isVisible ? "none" : "block";
      }
    }
  });

  // Add fade in/out animation for notifications
  const style = document.createElement("style");
  style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
      `;
  document.head.appendChild(style);

  // Enhanced line clear effects integration
  if (typeof stack !== "undefined" && typeof stack.clearLines === "function") {
    const originalClearLines = stack.clearLines;
    stack.clearLines = function () {
      const result = originalClearLines.apply(this, arguments);

      // Trigger enhanced effects when lines are cleared
      if (result > 0 && typeof LiveBackground !== "undefined") {
        LiveBackground.onLinesCleared(result);

        // Additional visual feedback
        if (Responsive && Responsive.triggerHaptic) {
          if (result === 4) {
            Responsive.triggerHaptic("heavy");
          } else if (result >= 2) {
            Responsive.triggerHaptic("medium");
          } else {
            Responsive.triggerHaptic("light");
          }
        }
      }

      return result;
    };
  }

  // Console welcome message
//   console.log(
//     "%c🎮 Professional Tetris Enhanced ",
//     "font-size: 20px; font-weight: bold; color: #00ffff; text-shadow: 0 0 10px #00ffff;"
//   );
//   console.log("%cFeatures:", "font-weight: bold; color: #ff00ff;");
//   console.log(" Responsive design with touch controls");
//   console.log(" Live particle backgrounds with themes");
//   console.log(" Mobile-optimized controls");
//   console.log(" Enhanced visual effects");
//   console.log("⌨  Press T to cycle themes, P for performance");
//   console.log(
//     "%cEnjoy the enhanced Tetris experience!",
//     "font-style: italic; color: #ffff00;"
//   );
});

_gaq = [["_setAccount", "UA-30472693-1"], ["_trackPageview"]];
(function (d) {
  var g = d.createElement("script"),
    s = d.scripts[0];
  g.src = "//www.google-analytics.com/ga.js";
  s.parentNode.insertBefore(g, s);
})(document);
