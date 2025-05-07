// hyper-cat/index.js

// const electron = require('electron'); // No longer needed for config access; remove if not used elsewhere.
const Color = require('color');
const path = require('path');

// It's good practice to ensure __dirname is available.
// If this file is the main module file (e.g., index.js), __dirname will be correctly set by Node.js.
const starsCssPath = path.join(__dirname, 'stars.jpg').replace(/\\/g, "/");

const RAINBOW_ALPHA_DECAY = 0.95;
const RAINBOW_COLORS = [
  '#fe0000',
  '#ffa500',
  '#ffff00',
  '#00fb00',
  '#009eff',
  '#6531ff'
].map(color => Color(color).rgb());

const BLACK = '#000000';
const BEIGE = '#f9d28f';
const PINK = '#fe91fe';
const DEEPPINK = '#f90297';
const GRAY = '#9d9d9d';
const SALMON = '#ff9593';

const WHILE_TYPING = 'whileTyping';
const ACTIVE_DURATION = 250;

var pluginConfig = {
  staggerHeight: 2,
  rainbowMaxAlpha: 1,
  audioEnabled: WHILE_TYPING,
  videoEnabled: WHILE_TYPING
};

let audio; // Shared audio instance

const playAudio = () => {
  if (audio) audio.play();
};

const pauseAudio = () => {
  if (audio) audio.pause();
};

// This is the Hyper API method. It should be directly assigned to `exports`.
exports.decorateTerm = (Term, { React, notify, config: hyperConfig }) => {
  const userHyperCatConfig = hyperConfig.hyperCat || {};
  // Update the module-level pluginConfig with user settings
  pluginConfig = Object.assign({}, pluginConfig, userHyperCatConfig);

  return class extends React.Component {
    constructor (props, context) {
      super(props, context);
      this.state = {
        videoActive: false
      };
      this._rainbows = [];
      this.drawFrame = this.drawFrame.bind(this);
      this.resizeCanvas = this.resizeCanvas.bind(this);
      this.onDecorated = this.onDecorated.bind(this);
      this.onCursorMove = this.onCursorMove.bind(this);
    }

    onDecorated (term) {
      if (this.props.onDecorated) {
        this.props.onDecorated(term);
      }
      this._termDiv = term ? term.termRef : null;
      if (this._termDiv) {
        this.initAudio();
        this.initOverlay();
      }
    }

    onCursorMove(cursorFrame) {
      if (this.props.onCursorMove) {
        this.props.onCursorMove(cursorFrame);
      }
      if (!this._termDiv || !this._overlay || !this._catCursor) { // Added check for _catCursor
          return;
      }
      const overlayRect = this.getOverlayBoundingClientRect();
      const termRect = this._termDiv.getBoundingClientRect();
      if (overlayRect.width === 0 && overlayRect.height === 0) {
          return;
      }
      const left = termRect.left + cursorFrame.x - overlayRect.left;
      const top = termRect.top + cursorFrame.y - overlayRect.top;
      const width = cursorFrame.width;
      const height = cursorFrame.height;

      if (this._prevCursorRect &&
        this._prevCursorRect.left === left && this._prevCursorRect.top === top &&
        this._prevCursorRect.width === width && this._prevCursorRect.height === height) {
        return;
      }
      this.updateAudioVideo(true);
      this._isStaggeredUp = !this._isStaggeredUp;
      const staggerTop = top + (this._isStaggeredUp ? -pluginConfig.staggerHeight : pluginConfig.staggerHeight);

      Object.assign(this._catCursor.style, {
        left: left + 'px',
        top: staggerTop + 'px',
        width: width + 'px',
        height: height + 'px'
      });

      if (this._catHead && this._catHead.complete &&
          this._catLegs && this._catLegs.complete &&
          this._catTail && this._catTail.complete) {
        const scale = width / this._catHead.naturalWidth;
        Object.assign(this._catHead.style, {
          display: 'block',
          width: this._catHead.naturalWidth * scale + 'px',
          height: this._catHead.naturalHeight * scale + 'px',
          left: left + width - (this._catHead.naturalWidth * scale) * .75 + 'px',
          top: staggerTop + height - (this._catHead.naturalHeight * scale) * (13 / 15) + 'px'
        });
        Object.assign(this._catLegs.style, {
          display: 'block',
          width: this._catLegs.naturalWidth * scale + 'px',
          height: this._catLegs.naturalHeight * scale + 'px',
          left: left - (this._catLegs.naturalWidth * scale) * (2 / 10) + 'px',
          top: staggerTop + height - (this._catLegs.naturalHeight * scale) * (2 / 4) + 'px'
        });
        Object.assign(this._catTail.style, {
          display: 'block',
          width: this._catTail.naturalWidth * scale + 'px',
          height: this._catTail.naturalHeight * scale + 'px',
          left: left - (this._catTail.naturalWidth * scale) + 'px',
          top: staggerTop + height - (this._catTail.naturalHeight * scale) * (11 / 7) + 'px'
        });
      }
      if (this._prevCursorRect) {
        this.spawnRainbow(this._prevCursorRect);
      }
      this._prevCursorRect = { left, top, width, height };
    }

    initAudio() {
      if (audio || typeof document === 'undefined') return;
      audio = document.createElement('audio');
      audio.id = 'audio-player';
      audio.src = path.join(__dirname, 'nyan.mp3');
      audio.type = 'audio/mpeg';
      audio.loop = true;
      document.body.appendChild(audio);
    }

    initOverlay() {
      if (typeof document === 'undefined' || !this._termDiv) return;
      this._overlay = document.createElement('div');
      this._overlay.classList.add('hypercat-overlay');
      if (this._termDiv.firstChild) {
        this._termDiv.insertBefore(this._overlay, this._termDiv.firstChild);
      } else {
        this._termDiv.appendChild(this._overlay);
      }
      this._canvas = document.createElement('canvas');
      this._canvasContext = this._canvas.getContext('2d');
      this._overlay.appendChild(this._canvas); // Add canvas to overlay before resizing
      this.resizeCanvas(); // Call after canvas is created and _overlay is in DOM

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(this.drawFrame);
        window.addEventListener('resize', this.resizeCanvas);
      }
      this.initCatCursor();
      this.initCatAssets();
    }

    createCatAsset(filename) {
      if (typeof Image === 'undefined' || !this._overlay) return null;
      const img = new Image();
      img.src = path.join(__dirname, filename);
      img.classList.add('hypercat-asset');
      this._overlay.appendChild(img);
      return img;
    }

    initCatAssets() {
      this._catLegs = this.createCatAsset('legs.svg');
      this._catHead = this.createCatAsset('head.svg');
      this._catTail = this.createCatAsset('tail.svg');
    }

    initCatCursor() {
      if (typeof document === 'undefined' || !this._overlay) return;
      const catCursor = document.createElement('div');
      catCursor.classList.add('hypercat-cursor');
      this._overlay.appendChild(catCursor);
      this._catCursor = catCursor;
    }

    resizeCanvas() {
      if (!this._canvas || !this._overlay) return;
      const overlayRect = this.getOverlayBoundingClientRect();
      this._canvas.width = overlayRect.width;
      this._canvas.height = overlayRect.height;
    }

    drawRainbow(ctx, rainbow, staggerUp) {
      const stripeHeight = Math.max(1, rainbow.height / RAINBOW_COLORS.length); // Ensure stripeHeight is at least 1
      RAINBOW_COLORS.forEach((color, i) => {
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${rainbow.alpha})`;
        ctx.fillRect(
          rainbow.left,
          rainbow.top + stripeHeight * i + (staggerUp ? -pluginConfig.staggerHeight : pluginConfig.staggerHeight),
          rainbow.width,
          stripeHeight
        );
      });
    }

    drawFrame() {
      if (!this._canvasContext || !this._canvas || typeof window === 'undefined') return;
      this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
      let staggerUp = !this._isStaggeredUp;
      for (var i = this._rainbows.length - 1; i >= 0; i--) {
        const rainbow = this._rainbows[i];
        this.drawRainbow(this._canvasContext, rainbow, staggerUp);
        rainbow.alpha *= RAINBOW_ALPHA_DECAY;
        if (rainbow.alpha < 0.1) {
          this._rainbows.splice(i, 1);
        }
        staggerUp = !staggerUp;
      }
      window.requestAnimationFrame(this.drawFrame);
    }

    spawnRainbow(rect) {
      this._rainbows.push(Object.assign({ alpha: pluginConfig.rainbowMaxAlpha }, {
        left: rect.left,
        top: rect.top + rect.height * .1,
        width: rect.width,
        height: Math.max(1, rect.height * .80) // Ensure height is at least 1
      }));
    }

    getOverlayBoundingClientRect() {
      if (!this._overlay) return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
      const overlayIsVisible = this._overlay.classList.contains('hypercat-active');
      if (!overlayIsVisible) {
        // Temporarily add class to measure, ensure it's styled to be measurable if needed
        // For getBoundingClientRect, visibility doesn't always matter if it's in the DOM tree
        // but if display:none is involved, it will have zero dimensions.
        // The class 'hypercat-active' should set display:block
        this._overlay.classList.add('hypercat-active');
      }
      const rect = this._overlay.getBoundingClientRect();
      if (!overlayIsVisible) {
        this._overlay.classList.remove('hypercat-active');
      }
      return rect;
    }

    updateAudio(typing) {
      let active = pluginConfig.audioEnabled === true || (typing && pluginConfig.audioEnabled === WHILE_TYPING);
      active ? playAudio() : pauseAudio();
    }

    updateVisual(typing) {
      if (!this._overlay) return;
      let active = pluginConfig.videoEnabled === true || (typing && pluginConfig.videoEnabled === WHILE_TYPING);
      this._overlay.classList.toggle('hypercat-active', active);
      this.setState({ videoActive: active });
    }

    updateAudioVideo(typing) {
      this.updateAudio(typing);
      this.updateVisual(typing);
      if (typing) {
        clearTimeout(this._activeTimeout);
        this._activeTimeout = setTimeout(() => { this.updateAudioVideo(false); }, ACTIVE_DURATION);
      }
    }

    render() {
      return [
        React.createElement(Term, Object.assign({}, this.props, {
          onDecorated: this.onDecorated,
          onCursorMove: this.onCursorMove,
          backgroundColor: this.state.videoActive ? 'rgba(0, 0, 0, 0)' : this.props.backgroundColor,
          cursorColor: this.state.videoActive ? 'rgba(0, 0, 0, 0)' : this.props.cursorColor,
          foregroundColor: this.state.videoActive ? 'rgba(255, 255, 255, 1)' : this.props.foregroundColor
        })),
        React.createElement('style', {}, `
          @keyframes starscroll {
            from {background-position:0 0;}
            to {background-position:-1600px 0;}
          }
          .hypercat-overlay {
            display: none;
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            pointer-events: none;
          }
          .hypercat-overlay.hypercat-active {
            display: block;
            background-image: url(file://${starsCssPath});
            background-repeat: repeat;
            -webkit-animation: starscroll 4s infinite linear;
          }
          .hypercat-cursor {
            position: absolute;
            pointer-events: none;
            background: radial-gradient(circle, ${DEEPPINK} 10%, transparent 10%),
              radial-gradient(circle, ${DEEPPINK} 10%, ${PINK} 10%) 3px 3px;
            background-size: 6px 6px;
            border-width: 1px;
            border-color: black;
            border-style: solid;
          }
          .hypercat-asset {
            position: absolute;
            pointer-events: none;
            display: none; /* Initially hidden, shown by onCursorMove logic */
          }
        `)
      ];
    }

    // Ensure to clean up event listeners and timeouts when the component unmounts
    componentWillUnmount() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.resizeCanvas);
            window.cancelAnimationFrame(this.drawFrame); // Assuming drawFrame is requested with requestAnimationFrame
        }
        clearTimeout(this._activeTimeout);
        // If audio element is specific to this term instance and not global, pause and remove it.
        // However, the current `audio` variable is module-global.
    }
  };
};

// If you have other Hyper API methods, export them similarly:
// exports.middleware = (store) => (next) => (action) => { /* ... */ };
// exports.onApp = (app) => { /* ... */ };
