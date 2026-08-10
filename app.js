/* ========================================================================
   Notion Cover Generator — Application Logic
   ======================================================================== */

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────
  const CANVAS_W = 1500;
  const CANVAS_H = 600;

  const GOOGLE_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Montserrat',
    'Lato', 'Poppins', 'Raleway', 'Playfair Display', 'Merriweather',
    'Oswald', 'Nunito', 'Ubuntu', 'Rubik', 'Work Sans',
    'Fira Sans', 'Quicksand', 'Karla', 'Josefin Sans', 'DM Sans',
    'Outfit', 'Sora', 'Manrope', 'Plus Jakarta Sans', 'Archivo',
  ];

  // Pre-load Google Fonts
  const fontsToLoad = GOOGLE_FONTS.filter(f => !['Inter'].includes(f));
  if (fontsToLoad.length) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900`).join('&')}&display=swap`;
    document.head.appendChild(link);
  }

  // ─── State ───────────────────────────────────────────────────────────
  const state = {
    bgMode: 'color',        // 'color' | 'gradient' | 'image'
    bgColor: '#ffffff',
    gradStart: '#e9ecef',
    gradEnd: '#dee2e6',
    gradDirection: 'to right',
    bgImage: null,           // HTMLImageElement
    bgImageFit: 'cover',
    overlayColor: '#ffffff',
    overlayOpacity: 0.4,
    layers: [],              // { id, type, visible, ...props }
    selectedLayerId: null,
  };

  let layerIdCounter = 0;

  // ─── DOM References ──────────────────────────────────────────────────
  const canvas = document.getElementById('cover-canvas');
  const ctx = canvas.getContext('2d');

  // Increase internal resolution by 2x for high-quality export (3000x1200)
  const EXPORT_SCALE = 2;
  canvas.width = CANVAS_W * EXPORT_SCALE;
  canvas.height = CANVAS_H * EXPORT_SCALE;
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  // Background controls
  const bgTabs = document.getElementById('bg-tabs');
  const tabColor = document.getElementById('tab-color');
  const tabGradient = document.getElementById('tab-gradient');
  const tabImage = document.getElementById('tab-image');

  const bgColorInput = document.getElementById('bg-color');
  const bgColorHex = document.getElementById('bg-color-hex');
  const gradStartInput = document.getElementById('grad-start');
  const gradStartHex = document.getElementById('grad-start-hex');
  const gradEndInput = document.getElementById('grad-end');
  const gradEndHex = document.getElementById('grad-end-hex');
  const gradDirectionSelect = document.getElementById('grad-direction');
  const bgImageInput = document.getElementById('bg-image-input');
  const bgImageFitSelect = document.getElementById('bg-image-fit');
  const overlayColorInput = document.getElementById('overlay-color');
  const overlayColorHex = document.getElementById('overlay-color-hex');
  const overlayOpacityInput = document.getElementById('overlay-opacity');
  const overlayOpacityVal = document.getElementById('overlay-opacity-val');
  const imageDropZone = document.getElementById('image-drop-zone');

  // Layers
  const btnAddText = document.getElementById('btn-add-text');
  const btnAddSvg = document.getElementById('btn-add-svg');
  const layersList = document.getElementById('layers-list');

  // Properties
  const panelProperties = document.getElementById('panel-properties');
  const propTitle = document.getElementById('prop-title');
  const propertiesBody = document.getElementById('properties-body');

  // Export
  const btnExport = document.getElementById('btn-export');

  // Zoom label
  const zoomLabel = document.getElementById('zoom-label');

  // ─── Background Tabs ────────────────────────────────────────────────
  bgTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const mode = tab.dataset.tab;
    state.bgMode = mode;

    bgTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    [tabColor, tabGradient, tabImage].forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${mode}`).classList.add('active');

    render();
  });

  // ─── Color sync helper ──────────────────────────────────────────────
  function syncColorInputs(colorInput, hexInput, stateKey) {
    colorInput.addEventListener('input', () => {
      hexInput.value = colorInput.value;
      state[stateKey] = colorInput.value;
      render();
    });
    hexInput.addEventListener('input', () => {
      const v = hexInput.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        colorInput.value = v;
        state[stateKey] = v;
        render();
      }
    });
    hexInput.addEventListener('blur', () => {
      hexInput.value = colorInput.value;
    });
  }

  syncColorInputs(bgColorInput, bgColorHex, 'bgColor');
  syncColorInputs(gradStartInput, gradStartHex, 'gradStart');
  syncColorInputs(gradEndInput, gradEndHex, 'gradEnd');
  syncColorInputs(overlayColorInput, overlayColorHex, 'overlayColor');

  gradDirectionSelect.addEventListener('change', () => {
    state.gradDirection = gradDirectionSelect.value;
    render();
  });

  bgImageFitSelect.addEventListener('change', () => {
    state.bgImageFit = bgImageFitSelect.value;
    render();
  });

  overlayOpacityInput.addEventListener('input', () => {
    const v = parseInt(overlayOpacityInput.value);
    state.overlayOpacity = v / 100;
    overlayOpacityVal.textContent = `${v}%`;
    render();
  });

  // ─── Image Upload ───────────────────────────────────────────────────
  imageDropZone.addEventListener('click', () => bgImageInput.click());

  imageDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropZone.classList.add('dragover');
  });

  imageDropZone.addEventListener('dragleave', () => {
    imageDropZone.classList.remove('dragover');
  });

  imageDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadBgImage(file);
    }
  });

  bgImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadBgImage(file);
  });

  function loadBgImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.bgImage = img;
        // Show thumbnail in drop zone
        imageDropZone.classList.add('has-image');
        imageDropZone.innerHTML = `<img src="${e.target.result}" alt="Background">`;
        render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ─── Layers ─────────────────────────────────────────────────────────
  btnAddText.addEventListener('click', () => addTextLayer());
  btnAddSvg.addEventListener('click', () => addSvgLayer());

  function addTextLayer() {
    const layer = {
      id: ++layerIdCounter,
      type: 'text',
      visible: true,
      text: 'Your Title Here',
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: '700',
      color: '#000000',
      align: 'center',     // 'left' | 'center' | 'right'
      vAlign: 'middle',    // 'top' | 'middle' | 'bottom'
      offsetX: 0,
      offsetY: 0,
      letterSpacing: 0,
      opacity: 100,
    };
    state.layers.push(layer);
    selectLayer(layer.id);
    renderLayersList();
    render();
  }

  function addSvgLayer() {
    const layer = {
      id: ++layerIdCounter,
      type: 'svg',
      visible: true,
      svgCode: '',
      color: '#000000',
      size: 120,
      align: 'center',
      vAlign: 'middle',
      offsetX: 0,
      offsetY: 0,
      opacity: 100,
    };
    state.layers.push(layer);
    selectLayer(layer.id);
    renderLayersList();
    render();
  }

  function removeLayer(id) {
    state.layers = state.layers.filter(l => l.id !== id);
    if (state.selectedLayerId === id) {
      state.selectedLayerId = null;
      panelProperties.style.display = 'none';
    }
    renderLayersList();
    render();
  }

  function toggleLayerVisibility(id) {
    const layer = state.layers.find(l => l.id === id);
    if (layer) {
      layer.visible = !layer.visible;
      renderLayersList();
      render();
    }
  }

  function selectLayer(id) {
    state.selectedLayerId = id;
    renderLayersList();
    renderProperties();
  }

  function moveLayer(id, direction) {
    const idx = state.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= state.layers.length) return;
    [state.layers[idx], state.layers[newIdx]] = [state.layers[newIdx], state.layers[idx]];
    renderLayersList();
    render();
  }

  // ─── Render Layers List ─────────────────────────────────────────────
  function renderLayersList() {
    if (state.layers.length === 0) {
      layersList.innerHTML = `
        <div class="layers-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <p>No layers yet.<br>Add text or SVG to start.</p>
        </div>`;
      return;
    }

    layersList.innerHTML = state.layers.map(layer => {
      const isSelected = layer.id === state.selectedLayerId;
      const icon = layer.type === 'text'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z"/></svg>`;
      const name = layer.type === 'text'
        ? (layer.text.length > 20 ? layer.text.slice(0, 20) + '…' : layer.text)
        : 'SVG Icon';
      const visIcon = layer.visible
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

      return `
        <div class="layer-item ${isSelected ? 'selected' : ''}" data-layer-id="${layer.id}">
          <button class="layer-visibility-btn ${layer.visible ? '' : 'hidden'}" data-action="toggle-vis" data-id="${layer.id}" title="Toggle visibility">
            ${visIcon}
          </button>
          <span class="layer-icon">${icon}</span>
          <span class="layer-name">${escapeHtml(name)}</span>
          <div class="layer-actions-inline">
            <button class="layer-action-btn" data-action="move-up" data-id="${layer.id}" title="Move up">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="layer-action-btn" data-action="move-down" data-id="${layer.id}" title="Move down">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="layer-action-btn delete" data-action="delete" data-id="${layer.id}" title="Delete layer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    // Bind events
    layersList.querySelectorAll('.layer-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        selectLayer(parseInt(item.dataset.layerId));
      });
    });

    layersList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const action = btn.dataset.action;
        if (action === 'delete') removeLayer(id);
        else if (action === 'toggle-vis') toggleLayerVisibility(id);
        else if (action === 'move-up') moveLayer(id, -1);
        else if (action === 'move-down') moveLayer(id, 1);
      });
    });
  }

  // ─── Properties Panel ───────────────────────────────────────────────
  function renderProperties() {
    const layer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!layer) {
      panelProperties.style.display = 'none';
      return;
    }

    panelProperties.style.display = 'block';
    propTitle.textContent = layer.type === 'text' ? 'Text Properties' : 'SVG Properties';

    let html = '';

    if (layer.type === 'text') {
      html = buildTextProperties(layer);
    } else {
      html = buildSvgProperties(layer);
    }

    // Common: alignment
    html += buildAlignmentUI(layer);

    // Common: offset
    html += `
      <div class="form-row">
        <div class="form-group">
          <label>Offset X</label>
          <input type="number" class="input-number" id="prop-offsetX" value="${layer.offsetX}">
        </div>
        <div class="form-group">
          <label>Offset Y</label>
          <input type="number" class="input-number" id="prop-offsetY" value="${layer.offsetY}">
        </div>
      </div>`;

    // Opacity
    html += `
      <div class="form-group">
        <label>Opacity <span class="range-val">${layer.opacity}%</span></label>
        <input type="range" class="range-input" id="prop-opacity" min="0" max="100" value="${layer.opacity}">
      </div>`;

    // Delete
    html += `
      <div class="prop-delete-row">
        <button class="btn btn-sm btn-danger-ghost" id="prop-delete-layer" style="width:100%;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete Layer
        </button>
      </div>`;

    propertiesBody.innerHTML = html;
    bindPropertyEvents(layer);
  }

  function buildTextProperties(layer) {
    const fontOptions = GOOGLE_FONTS.map(f =>
      `<option value="${f}" ${f === layer.fontFamily ? 'selected' : ''}>${f}</option>`
    ).join('');

    const weightOptions = [
      { v: '300', l: 'Light' },
      { v: '400', l: 'Regular' },
      { v: '500', l: 'Medium' },
      { v: '600', l: 'Semi Bold' },
      { v: '700', l: 'Bold' },
      { v: '800', l: 'Extra Bold' },
      { v: '900', l: 'Black' },
    ].map(w => `<option value="${w.v}" ${w.v === layer.fontWeight ? 'selected' : ''}>${w.l}</option>`).join('');

    return `
      <div class="form-group">
        <label>Text Content</label>
        <textarea class="input-text" id="prop-text" rows="2">${escapeHtml(layer.text)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Font</label>
          <select class="select-input" id="prop-font">${fontOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Weight</label>
          <select class="select-input" id="prop-weight">${weightOptions}</select>
        </div>
        <div class="form-group">
          <label>Size (px)</label>
          <input type="number" class="input-number" id="prop-fontSize" value="${layer.fontSize}" min="8" max="400">
        </div>
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-input-row">
          <input type="color" id="prop-color" value="${layer.color}">
          <input type="text" class="input-hex" id="prop-color-hex" value="${layer.color}" maxlength="7">
        </div>
      </div>
      <div class="form-group">
        <label>Letter Spacing (px)</label>
        <input type="number" class="input-number" id="prop-letterSpacing" value="${layer.letterSpacing}" min="-20" max="50">
      </div>`;
  }

  function buildSvgProperties(layer) {
    return `
      <div class="form-group">
        <label>SVG Code</label>
        <textarea class="input-text svg-input" id="prop-svgCode" rows="5">${escapeHtml(layer.svgCode)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Size (px)</label>
          <input type="number" class="input-number" id="prop-svgSize" value="${layer.size}" min="10" max="600">
        </div>
        <div class="form-group">
          <label>Color</label>
          <div class="color-input-row">
            <input type="color" id="prop-color" value="${layer.color}">
            <input type="text" class="input-hex" id="prop-color-hex" value="${layer.color}" maxlength="7">
          </div>
        </div>
      </div>`;
  }

  function buildAlignmentUI(layer) {
    const positions = [
      ['top-left', 'top', 'top-right'],
      ['left', 'center', 'right'],
      ['bottom-left', 'bottom', 'bottom-right'],
    ];

    const alignMap = {
      'top-left': { align: 'left', vAlign: 'top' },
      'top': { align: 'center', vAlign: 'top' },
      'top-right': { align: 'right', vAlign: 'top' },
      'left': { align: 'left', vAlign: 'middle' },
      'center': { align: 'center', vAlign: 'middle' },
      'right': { align: 'right', vAlign: 'middle' },
      'bottom-left': { align: 'left', vAlign: 'bottom' },
      'bottom': { align: 'center', vAlign: 'bottom' },
      'bottom-right': { align: 'right', vAlign: 'bottom' },
    };

    const currentKey = Object.keys(alignMap).find(k =>
      alignMap[k].align === layer.align && alignMap[k].vAlign === layer.vAlign
    ) || 'center';

    const dotSvg = `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="3" fill="currentColor"/></svg>`;

    const cells = positions.flat().map(pos => {
      const active = pos === currentKey ? 'active' : '';
      return `<button class="align-btn ${active}" data-align="${pos}" title="${pos}">${dotSvg}</button>`;
    }).join('');

    return `
      <div class="form-group">
        <label>Alignment</label>
        <div class="alignment-grid">${cells}</div>
      </div>`;
  }

  // ─── Bind Property Events ───────────────────────────────────────────
  function bindPropertyEvents(layer) {
    const on = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    // Text-specific
    if (layer.type === 'text') {
      on('prop-text', 'input', (e) => {
        layer.text = e.target.value;
        renderLayersList();
        render();
      });
      on('prop-font', 'change', (e) => {
        layer.fontFamily = e.target.value;
        render();
      });
      on('prop-weight', 'change', (e) => {
        layer.fontWeight = e.target.value;
        render();
      });
      on('prop-fontSize', 'input', (e) => {
        layer.fontSize = parseInt(e.target.value) || 12;
        render();
      });
      on('prop-letterSpacing', 'input', (e) => {
        layer.letterSpacing = parseInt(e.target.value) || 0;
        render();
      });
    }

    // SVG-specific
    if (layer.type === 'svg') {
      on('prop-svgCode', 'input', (e) => {
        layer.svgCode = e.target.value;
        render();
      });
      on('prop-svgSize', 'input', (e) => {
        layer.size = parseInt(e.target.value) || 60;
        render();
      });
    }

    // Color
    const propColor = document.getElementById('prop-color');
    const propColorHex = document.getElementById('prop-color-hex');
    if (propColor && propColorHex) {
      propColor.addEventListener('input', () => {
        propColorHex.value = propColor.value;
        layer.color = propColor.value;
        render();
      });
      propColorHex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(propColorHex.value)) {
          propColor.value = propColorHex.value;
          layer.color = propColorHex.value;
          render();
        }
      });
    }

    // Alignment
    propertiesBody.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = btn.dataset.align;
        const map = {
          'top-left': { align: 'left', vAlign: 'top' },
          'top': { align: 'center', vAlign: 'top' },
          'top-right': { align: 'right', vAlign: 'top' },
          'left': { align: 'left', vAlign: 'middle' },
          'center': { align: 'center', vAlign: 'middle' },
          'right': { align: 'right', vAlign: 'middle' },
          'bottom-left': { align: 'left', vAlign: 'bottom' },
          'bottom': { align: 'center', vAlign: 'bottom' },
          'bottom-right': { align: 'right', vAlign: 'bottom' },
        };
        if (map[pos]) {
          layer.align = map[pos].align;
          layer.vAlign = map[pos].vAlign;
          renderProperties();
          render();
        }
      });
    });

    // Offsets
    on('prop-offsetX', 'input', (e) => {
      layer.offsetX = parseInt(e.target.value) || 0;
      render();
    });
    on('prop-offsetY', 'input', (e) => {
      layer.offsetY = parseInt(e.target.value) || 0;
      render();
    });

    // Opacity
    on('prop-opacity', 'input', (e) => {
      layer.opacity = parseInt(e.target.value);
      e.target.previousElementSibling?.querySelector('.range-val')
        && (document.querySelector('#prop-opacity').parentElement.querySelector('.range-val').textContent = `${layer.opacity}%`);
      render();
    });

    // Delete
    on('prop-delete-layer', 'click', () => removeLayer(layer.id));
  }

  // ─── Canvas Rendering ───────────────────────────────────────────────
  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // 1. Background
    drawBackground();

    // 2. Layers (in order)
    state.layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      if (layer.type === 'text') {
        drawTextLayer(layer);
      } else if (layer.type === 'svg') {
        drawSvgLayer(layer);
      }

      ctx.restore();
    });

    updateZoomLabel();
  }

  function drawBackground() {
    if (state.bgMode === 'color') {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else if (state.bgMode === 'gradient') {
      const dir = state.gradDirection;
      let x0 = 0, y0 = 0, x1 = CANVAS_W, y1 = 0;
      if (dir === 'to right') { x0 = 0; y0 = 0; x1 = CANVAS_W; y1 = 0; }
      else if (dir === 'to left') { x0 = CANVAS_W; y0 = 0; x1 = 0; y1 = 0; }
      else if (dir === 'to bottom') { x0 = 0; y0 = 0; x1 = 0; y1 = CANVAS_H; }
      else if (dir === 'to top') { x0 = 0; y0 = CANVAS_H; x1 = 0; y1 = 0; }
      else if (dir === 'to bottom right') { x0 = 0; y0 = 0; x1 = CANVAS_W; y1 = CANVAS_H; }
      else if (dir === 'to top right') { x0 = 0; y0 = CANVAS_H; x1 = CANVAS_W; y1 = 0; }

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, state.gradStart);
      grad.addColorStop(1, state.gradEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else if (state.bgMode === 'image' && state.bgImage) {
      drawBgImage();
      // Overlay
      if (state.overlayOpacity > 0) {
        ctx.fillStyle = state.overlayColor;
        ctx.globalAlpha = state.overlayOpacity;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalAlpha = 1;
      }
    } else {
      // Fallback
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawBgImage() {
    const img = state.bgImage;
    const fit = state.bgImageFit;

    if (fit === 'cover') {
      const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
    } else if (fit === 'contain') {
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
    } else {
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function getPosition(layer, contentW, contentH) {
    const padding = 60;
    let x, y;

    // Horizontal
    if (layer.align === 'left') x = padding;
    else if (layer.align === 'right') x = CANVAS_W - contentW - padding;
    else x = (CANVAS_W - contentW) / 2;

    // Vertical
    if (layer.vAlign === 'top') y = padding;
    else if (layer.vAlign === 'bottom') y = CANVAS_H - contentH - padding;
    else y = (CANVAS_H - contentH) / 2;

    return { x: x + (layer.offsetX || 0), y: y + (layer.offsetY || 0) };
  }

  function drawTextLayer(layer) {
    const font = `${layer.fontWeight} ${layer.fontSize}px '${layer.fontFamily}', sans-serif`;
    ctx.font = font;
    ctx.fillStyle = layer.color;
    ctx.textBaseline = 'top';

    // Handle multi-line
    const lines = layer.text.split('\n');
    const lineHeight = layer.fontSize * 1.3;
    const totalH = lines.length * lineHeight;

    // Measure max width
    let maxW = 0;
    const lineWidths = lines.map(line => {
      // Account for letter spacing
      let w = ctx.measureText(line).width;
      if (layer.letterSpacing) {
        w += (line.length - 1) * layer.letterSpacing;
      }
      maxW = Math.max(maxW, w);
      return w;
    });

    const pos = getPosition(layer, maxW, totalH);

    lines.forEach((line, i) => {
      let lx = pos.x;
      const ly = pos.y + i * lineHeight;

      // Adjust x for text alignment within block
      if (layer.align === 'center') {
        lx = pos.x + (maxW - lineWidths[i]) / 2;
      } else if (layer.align === 'right') {
        lx = pos.x + (maxW - lineWidths[i]);
      }

      if (layer.letterSpacing && layer.letterSpacing !== 0) {
        // Draw char by char for letter spacing
        let cx = lx;
        for (let c = 0; c < line.length; c++) {
          ctx.fillText(line[c], cx, ly);
          cx += ctx.measureText(line[c]).width + layer.letterSpacing;
        }
      } else {
        ctx.fillText(line, lx, ly);
      }
    });
  }

  // SVG rendering cache
  const svgCache = new Map();

  function drawSvgLayer(layer) {
    if (!layer.svgCode || !layer.svgCode.trim()) return;
    const size = layer.size;
    // Inject color into SVG — replace currentColor and stroke/fill values
    let svgStr = layer.svgCode.trim();

    // Replace currentColor
    svgStr = svgStr.replace(/currentColor/g, layer.color);

    // Override hardcoded stroke and fill colors (ignoring 'none' and 'transparent')
    svgStr = svgStr.replace(/fill="(?!(?:none|transparent))[^"]*"/ig, `fill="${layer.color}"`);
    svgStr = svgStr.replace(/stroke="(?!(?:none|transparent))[^"]*"/ig, `stroke="${layer.color}"`);

    // Ensure SVG has proper xmlns
    if (!svgStr.includes('xmlns')) {
      svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Set width/height
    svgStr = svgStr.replace(/width="[^"]*"/, '').replace(/height="[^"]*"/, '');
    svgStr = svgStr.replace('<svg', `<svg width="${size}" height="${size}"`);

    const cacheKey = svgStr + '_' + size;

    if (svgCache.has(cacheKey)) {
      const cachedImg = svgCache.get(cacheKey);
      if (cachedImg.complete && cachedImg.naturalWidth > 0) {
        const pos = getPosition(layer, size, size);
        ctx.drawImage(cachedImg, pos.x, pos.y, size, size);
        return;
      }
    }

    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      svgCache.set(cacheKey, img);
      URL.revokeObjectURL(url);
      // Re-render to show the image
      requestAnimationFrame(() => render());
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // ─── Zoom Label ─────────────────────────────────────────────────────
  function updateZoomLabel() {
    const wrapper = document.getElementById('canvas-wrapper');
    const displayW = wrapper.getBoundingClientRect().width;
    const percent = Math.round((displayW / CANVAS_W) * 100);
    zoomLabel.textContent = `${percent}%`;
  }

  // ─── Export ─────────────────────────────────────────────────────────
  btnExport.addEventListener('click', exportPNG);

  function exportPNG() {
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast('Export failed', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notion-cover.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Cover exported as PNG!', 'success');
    }, 'image/png');
  }

  // ─── Toast ──────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success'
      ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
      : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 300ms var(--ease-out) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ─── Utility ────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Init ───────────────────────────────────────────────────────────
  renderLayersList();
  render();

  // Resize observer for zoom label
  const resizeObserver = new ResizeObserver(() => updateZoomLabel());
  resizeObserver.observe(document.getElementById('canvas-viewport'));

})();
