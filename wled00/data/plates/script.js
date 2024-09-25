class Helpers {

  static arrEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  static clearLocalStorage() {
    localStorage.removeItem('midnadisc');
  }

  static cordToStr(plate, index) {
    const l = 'abcdefgh';
    const p = plate === 'top' ? 't' : 'b';
    const c = index % 12;
    const r = Math.floor(index / 12);
    const row_letter = l[r];

    return {
      c: c,
      i: index,
      p: plate,
      r: r,
      s: `${p}-${row_letter}-${c + 1}`,
    }
  }

  static createPlateImage(top_plate, bottom_plate) {
    // Define canvas size and circle properties
    const rows = 8;
    const cols = 12;
    const canvasWidth = 96;
    const canvasHeight = 128;

    const circleRadius = 3; // Radius for circles
    const circleDiameter = circleRadius * 2;
    const spacing = 2; // Space between circles
    const plateSpacing = 6; // Space between the two plates

    // Calculate the total width and height of the grid
    const totalGridWidth = cols * (circleDiameter + spacing) - spacing;
    const totalGridHeight = rows * (circleDiameter + spacing) - spacing;

    // Calculate starting positions to center the grid
    const startX = (canvasWidth - totalGridWidth) / 2 + 3;
    const startY = (canvasHeight - (totalGridHeight * 2 + plateSpacing)) / 2 + 6;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight + 6;
    const ctx = canvas.getContext('2d');

    // Set background color
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Function to draw circles
    function drawCircles(plate, yOffset) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col;
          const color = plate[index] || '#eee';
          const x = startX + col * (circleDiameter + spacing);
          const y = startY + yOffset + row * (circleDiameter + spacing);
          ctx.beginPath();
          ctx.arc(x, y, circleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.closePath();
        }
      }
    }

    // Draw top plate
    drawCircles(top_plate, 0);

    // Draw bottom plate with extra spacing
    drawCircles(bottom_plate, totalGridHeight + plateSpacing);

    // Convert canvas to base64 URL
    return canvas.toDataURL('image/png');
  }

  static createWledData(state) {
    const plateMap = Helpers.newPlateMap();

    state.plates.bottom.forEach((color, index) => {
      if (!color) return;
      const cord = Helpers.cordToStr('bottom', index);
      plateMap[cord.s].color = color;
    });

    state.plates.top.forEach((color, index) => {
      if (!color) return;
      const cord = Helpers.cordToStr('top', index);
      plateMap[cord.s].color = color;
    });

    const data = Object.values(plateMap)
      .filter(w => (w.color !== '#eee' && w.color !== '#000000'))
      .reduce((acc, w) => {
        acc.push([w.leds.upper_row.start, w.leds.upper_row.end, w.color.slice(1)]);
        acc.push([w.leds.lower_row.start, w.leds.lower_row.end, w.color.slice(1)]);
        return acc;
      }, []);

    const positionData = data.length > 0 ? Helpers.sortAndFlatten(data) : Helpers.getEmptyWledData().seg.i;

    const wled = Helpers.getEmptyWledData();

    wled.bri = Math.floor(parseInt(state.values.brightness) / 100 * 255);
    wled.seg.i = positionData;

    return wled;
  }

  static downloadJsonFile(preset, fileName) {
    const { id, title, data } = preset; // Use the passed 'preset' parameter instead of 'jsonObject'
    const presetWithRemovedImg = { id, title, data };
    const jsonString = JSON.stringify(presetWithRemovedImg, null, 2); // Pretty print JSON with indentation
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element
    const fakeLink = document.createElement('a');
    fakeLink.href = url;
    fakeLink.download = fileName;

    // Append the anchor to the body
    document.body.appendChild(fakeLink);

    // Programmatically click the anchor to trigger the download
    fakeLink.click();

    // Remove the anchor from the DOM
    document.body.removeChild(fakeLink);

    // Revoke the object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  static fromDateToString(d) {
    return d.toISOString().replace(/:/g, "_").replace('.', '__')
  }

  static fromStringToDate(s) {
    return new Date(s.replace('__', '.').replace(/_/g, ':'))
  }

  static getEmptyWledData() {
    return { "on": true, "bri": 128, "seg": { "id": 0, "i": [0, 4095, "000000"] } };
  }

  static hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return { r, g, b };
  }

  static hexToWavelength(hex) {
    // Convert the #RRGGBB string to RGB values
    const { r, g, b } = Helpers.hexToRGB(hex);

    // Calculate the perceived color (hue)
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const delta = maxVal - minVal;

    if (delta === 0) {
      return null;  // Gray color does not correspond to a specific wavelength
    }

    let hue;
    if (maxVal === r) {
      hue = (g - b) / delta;
    } else if (maxVal === g) {
      hue = 2 + (b - r) / delta;
    } else {
      hue = 4 + (r - g) / delta;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }

    // Map hue to wavelength
    let wavelength;
    if (hue < 60) {
      wavelength = 645 - (645 - 700) * (hue / 60);
    } else if (hue < 120) {
      wavelength = 580 - (580 - 645) * ((hue - 60) / 60);
    } else if (hue < 180) {
      wavelength = 510 - (510 - 580) * ((hue - 120) / 60);
    } else if (hue < 240) {
      wavelength = 490 - (490 - 510) * ((hue - 180) / 60);
    } else if (hue < 300) {
      wavelength = 435 - (435 - 490) * ((hue - 240) / 60);
    } else {
      wavelength = 400 - (400 - 435) * ((hue - 300) / 60);
    }

    if (isNaN(wavelength) || !wavelength) {
      return null;
    }

    return Math.round(wavelength);
  }

  static readAndValidateJsonFiles(files, callback) {
    const results = [];
    let processedFiles = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const jsonContent = JSON.parse(e.target.result);

          ['id', 'title', 'data'].forEach(key => {
            if (jsonContent[key] === undefined) {
              throw SyntaxError(`Content is missing a key "${key}"`)
            }
            if (key === 'data') {
              ['brightness', 'plates'].forEach(data_key => {
                if (!jsonContent[key][data_key] === undefined) {
                  throw SyntaxError(`Content is missing a key "${key}.${data_key}"`)
                }
              })
            }
          });

          results.push({ fileName: file.name, content: jsonContent });
        } catch (error) {
          results.push({ fileName: file.name, error: true, msg: error.message });
        } finally {
          processedFiles++;
          if (processedFiles === files.length) {
            callback(results); // Return results via callback
          }
        }
      };
      reader.readAsText(file);
    }
  }

  static newPlateMap() {
    const top_origin_x = 11;
    const top_origin_y = 2;
    const bottom_origin_x = 11;
    const bottom_origin_y = 33;
    const res = {};
    const matrix_width = 64;
    const columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rows = "abcdefgh";
    const len_columns = columns.length;
    const len_rows = rows.length;
    const plate_offset_x = 3;
    const plate_offset_y = 3;

    for (let i = 0; i < len_columns; i++) {
      for (let j = 0; j < len_rows; j++) {
        const xb = bottom_origin_x + plate_offset_x + plate_offset_x * i;
        const yb = bottom_origin_y + plate_offset_y + plate_offset_y * j;
        const bottom_led_upper_start = yb * matrix_width + xb;
        const bottom_led_lower_start = (yb + 1) * matrix_width + xb;
        const bottom_key = `b-${rows[j]}-${columns[i]}`;

        res[bottom_key] = {
          str: bottom_key,
          leds: {
            upper_row: { start: bottom_led_upper_start, end: bottom_led_upper_start + 2 },
            lower_row: { start: bottom_led_lower_start, end: bottom_led_lower_start + 2 }
          },
          color: '#eee',
        };

        const xt = top_origin_x + plate_offset_x + plate_offset_x * i;
        const yt = top_origin_y + plate_offset_y + plate_offset_y * j;
        const top_led_upper_start = yt * matrix_width + xt;
        const top_led_lower_start = (yt + 1) * matrix_width + xt;
        const top_key = `t-${rows[j]}-${columns[i]}`;

        res[top_key] = {
          str: top_key,
          leds: {
            upper_row: { start: top_led_upper_start, end: top_led_upper_start + 2 },
            lower_row: { start: top_led_lower_start, end: top_led_lower_start + 2 }
          },
          color: '#eee',
        };
      }
    }

    return res;
  }

  static sortAndFlatten(arr) {
    const sortedArr = arr.sort((a, b) => a[0] - b[0]);
    const flattenedArr = sortedArr.flat();

    return flattenedArr;
  }

  static sendPostRequest(payload, alertError) {
    const url = 'http://'+location.host+'/json/state';
    const headers = {
      'Content-Type': 'application/json'
    };

    const jsonPayload = JSON.stringify(payload);

    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: jsonPayload
    })
      .then(response => {
        console.info(`Status Code: ${response.status}`);

        return response.text();
      })
      .then(responseContent => {
        console.info(`Response Content: ${responseContent}`);

        return Promise.resolve(true);
      })
      .catch(error => {
        if (alertError) {
          alert(`LED screen server error: ${error}`);
        }
        console.error(`Error: ${error}`);

        return Promise.resolve(false);
      });
  }

  static strToCord(str) {
    const rows = "abcdefgh";
    const [p, r, c] = str.split("-");

    const plate = p === 't' ? 'top' : 'bottom';
    const row = rows.indexOf(r);
    const column = parseInt(c) - 1;

    return {
      c: column,
      i: row * 12 + column,
      p: plate,
      r: row,
      s: str,
    }
  }

  static testHex(hex) {
    return /^#([0-9a-f]{2}){3}$/i.test(hex)
  }

  static textContrastCalcFromBg(bgColorHex) {
    const { r, g, b } = this.hexToRGB(bgColorHex);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000' : '#fff';
  }

  static uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  }

}


class UI {

  // static methods 
  static handleActionClearPlates(event) {
    event.preventDefault();
    if (!confirm('Are you sure you want to clear the plates?')) { return; }
    app.ui.clearPlates();
  }

  static handleErase(event) {
    event.preventDefault();
    app.ui.selectErase();
  }

  static handleRemoveAllPresets(event) {
    event.preventDefault();
    if (!confirm('Are you sure you want to remove all presets?')) { return; }
    app.ui.removeAllPresets();
  }

  static handleActionSavePreset(event) {
    event.preventDefault();
    app.ui.saveToPreset();
  }

  static handleActionSendToDevice(event) {
    event.preventDefault();
    if (!confirm('Are you sure you want to send this preset to the device?')) { return; }

    app.ui.sendToDevice();
  }

  static handleRangeChange(callback) {
    let isMouseDown = false;

    return {
      change: (event) => { callback(event.target.value); },
      mousedown: (event) => { isMouseDown = true; callback(event.target.value); },
      mousemove: (event) => { if (isMouseDown) { callback(event.target.value); } },
      mouseup: (event) => { isMouseDown = false; callback(event.target.value); },
      touchstart: (event) => { isMouseDown = true; callback(event.target.value); },
      touchmove: (event) => { if (isMouseDown) { callback(event.target.value); } },
      touchend: (event) => { isMouseDown = false; callback(event.target.value); },
    }
  }

  static handleInputColorChange(callback) {
    return {
      change: (event) => { if (event.cancelable) { event.preventDefault(); } callback(event.target.value) },
      input: (event) => { if (event.cancelable) { event.preventDefault(); } callback(event.target.value) },
    }
  }

  static handleInputTextRGBChange(callback) {
    return {
      keyup: (event) => { if (event.cancelable) { event.preventDefault(); } callback(event.target.value) },
    }
  }

  static handleColorItemSelection(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.createColorIntentDialog(event.target.getAttribute('md-value'));
  }

  static handleColorSelectionRecent(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.selectColorFromRecent(event.target.getAttribute('md-value'));
  }

  static handleCloseColorPicker(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.closeDialog();
  }

  static handleColorSelectorMethodChange(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.colorInputMethodChange(event.target.value);
  }

  static handleDialogSave(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.dialogSave();
  }

  static handleImportFiles(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    Helpers.readAndValidateJsonFiles(event.target.files, app.ui.callbackImportFiles.bind(app.ui));
  }

  static handleOpenBrightness(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.openBrightness();
  }

  static handleOpenColorPicker(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.openColorPicker();
  }

  static handlePresetDownload(event) {
    let error = false;
    const ref = event.target.getAttribute('md-ref');

    if (!ref) { error = true; }

    const preset = app.ui.getPresetById(ref);

    if (!preset) { error = true }

    if (error) {
      const htmlPresetTitle = event.target.parentElement.parentElement.querySelector('.preset-title').textContent;
      alert(`Error has occured while downloading preset "${htmlPresetTitle}"`);
    }

    Helpers.downloadJsonFile(preset, `${preset.title}.json`);
  }


  static handlePresetLoad(event) {
    let error = false;
    const ref = event.target.getAttribute('md-ref');

    if (!ref) { error = true; }

    const preset = app.ui.getPresetById(ref);

    if (!preset) { error = true }

    if (error) {
      const htmlPresetTitle = event.target.parentElement.parentElement.querySelector('.preset-title').textContent;
      alert(`Error has occured while loading preset "${htmlPresetTitle}"`);
    }

    if (!confirm(`Are you sure you want to load the preset "${preset.title}"?`)) { return; }

    app.ui.loadPreset(preset);
  }

  static handlePresetRemove(event) {
    let error = false;
    const ref = event.target.getAttribute('md-ref');

    if (!ref) { error = true; }

    const preset = app.ui.getPresetById(ref);

    if (!preset) { error = true }

    if (error) {
      const htmlPresetTitle = event.target.parentElement.parentElement.querySelector('.preset-title').textContent;
      alert(`Error has occured while removing preset "${htmlPresetTitle}"`);
    }

    if (!confirm(`Are you sure you want to remove the preset "${preset.title}"?`)) { return; }

    app.ui.removePreset(ref);
  }

  static handleStorageEvent(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    app.ui.appLoadStateHistoryFromStorage().then(() => app.ui.render());
  }

  static handleTabs(event) {
    app.ui.openTab(event.target.getAttribute('ref'));
  }

  static handleTitleChange(event) {
    app.ui.valueChangeTitle(event.target.value);
  }


  handleCursorActions(event) {
    const isTouch = event.type.indexOf('touch') > -1 ? true : false;

    if ((isTouch && event.type === 'touchend') || event.type === 'mouseup') {
      this.mouseActionStart = false;
      if (this.plates !== null) {
        this.savePlates();
      }
      return;
    }

    if (
      !this.mouseActionStart
      && (event.type === 'touchstart' || event.type === 'mousedown')
      && /SVG.*Element/.test(event.target?.constructor?.name)) {
      this.plates = window.structuredClone(this.state.plates);
      this.mouseActionStart = true;
      if (isTouch) {
        this.body.classList.add('lock-screen');
      }
    }

    if (!this.mouseActionStart) {
      return;
    }

    const target = isTouch ? document.elementFromPoint(event.touches[0].clientX, event.touches[0].clientY) : event.target;

    if (target?.constructor?.name === 'SVGCircleElement') {
      target.setAttribute("fill", this.state.values.color);
      const cord_str = target.classList[1];
      if (!cord_str) return;
      const cord_obj = Helpers.strToCord(cord_str)
      this.plates[cord_obj.p][cord_obj.i] = this.state.values.color === '#eee' ? null : this.state.values.color;
    }

  }

  // public fields 

  // title

  inputTitle = null;

  // !title


  // modal

  buttonDialogSave = null;
  divColorInputMethod = null;
  divsOpenBrightness = null;
  divsOpenColorPicker = null;
  elementColorInputRange = null;
  elementsDialogClose = null;
  inputColorNative = null;
  inputRangeBrightness = null;
  inputTextRGB = null;
  labelBrightnessRange = null;
  modal = null;
  modalBrightnessSection = null;
  modalColorPickerSection = null;

  // !modal

  // state

  dragging = false;
  intent = null;
  mouseActionStart = false;
  plates = null;
  plateMap = null;
  state = null;
  stateHistory = [];

  initialState = {
    uuid: null,
    title: `Preset_${Helpers.fromDateToString(new Date())}`,
    values: {
      brightness: 100,
      color: '#ff0000',
    },
    plates: {
      bottom: [],
      top: [],
    },
    recent_colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'],
    modal: {
      colorInputMethod: {
        colorList: true,
        rgb: false,
        wavelength: false,
        native: false,
      },
      opened: false,
      showColorPicker: false,
      showBrightness: false,
      title: '',
    },
    presets: [],
    tabs: {
      plates: true,
      presets: false,
    }
  };

  // !state

  // public methods 
  appLoadStateHistoryFromStorage() {
    let hasError = false;
    const localStorageData = localStorage.getItem('midnadisc');

    if (!localStorageData) return Promise.reject(false);

    let parsedData = null;

    try {
      parsedData = JSON.parse(localStorageData);
    } catch (e) {
      hasError = true;
      console.error('Unparsable localStorage for key "midnadisc"', e, localStorageData);
      localStorageData.removeItem('midnadisc');
    }

    if (hasError) return Promise.reject(false);

    this.stateHistory = parsedData;
    this.state = parsedData[parsedData.length - 1];

    return Promise.resolve(true)
  }

  appSaveStateHistoryToStorage() {
    try {
      localStorage.setItem('midnadisc', JSON.stringify(this.stateHistory));
    } catch (e) {
      console.error('There was and error saveing data to localStorage for key "midnadisc"', e, this.stateHistory);
    }
  }

  callbackChangeBrightness(value) {
    this.changeBrightness(value);
  }

  callbackChangeColor(hexColor) {
    this.createColorIntentDialog(hexColor)
  }

  callbackImportFiles(results) {
    const state = this.#getNewState();
    const ids = state.presets.reduce((acc, p) => { acc[p.id] = p.id; return acc; }, {});

    results.forEach(res => {
      if (res.error) {
        alert(`Error occurred while processing file ${res.fileName} with message: "${res.msg}"`);
      } else {
        while (ids[res.content.id] !== undefined) {
          res.content.id = Helpers.uuidv4();
        }
        const fileName = res.fileName.replace('.json', '');
        if (fileName !== res.content.title) {
          res.content.title = fileName;
        }
        res.content.img = Helpers.createPlateImage(res.content.data.plates.top, res.content.data.plates.bottom);
        state.presets.unshift(res.content);
      }
    });

    this.render(state);
  }

  saveToPreset() {
    const state = this.#getNewState();
    const title = state.title ? state.title : `Preset_${Helpers.fromDateToString(new Date())}`;
    state.title = title;
    state.uuid = Helpers.uuidv4();

    const brightnessInt = parseInt(state.values.brightness);

    state.presets.unshift({
      id: state.uuid,
      title: title,
      img: Helpers.createPlateImage(state.plates.top, state.plates.bottom),
      data: {
        brightness: !isNaN(brightnessInt) ? brightnessInt : 100,
        plates: state.plates,
      }
    });

    this.render(state);
  }

  sendToDevice() {
    const emptyWled = Helpers.getEmptyWledData();
    const wled = Helpers.createWledData(this.state);

    Helpers.sendPostRequest(emptyWled).then((success) => {
      if (success) {
        Helpers.sendPostRequest(wled, true);
      }
    })
  }

  changeBrightness(value) {
    this.intent = this.createBrightnessIntent(value);
    this.labelBrightnessRange.textContent = `${value}%`;
  }

  clearDialogState(state) {
    state.modal = {
      ...state.modal,
      opened: false,
      showColorPicker: false,
      showBrightness: false,
      title: 'Modal',
    };
  }

  clearPlates() {
    const state = this.#getNewState();
    this.plates = null;
    state.plates = { bottom: [], top: [] };
    this.render(state);
  }

  closeDialog() {
    const state = this.#getNewState();
    this.intent = null;
    this.clearDialogState(state);
    this.render(state);
  }

  colorInputMethodChange(value) {
    const state = this.#getNewState();
    state.modal.colorInputMethod.colorList = value === 'colorList' ? true : false;
    state.modal.colorInputMethod.rgb = value === 'rgb' ? true : false;
    state.modal.colorInputMethod.wavelength = value === 'wavelength' ? true : false;
    state.modal.colorInputMethod.native = value === 'native' ? true : false;
    this.render(state);
  }

  constructor() {
    this.body = document.querySelector('body');
    this.topSVG = document.querySelector('.top');
    this.bottomSVG = document.querySelector('.bottom');

    // title 
    this.inputTitle = document.querySelector('#current-preset-title');

    // modal
    this.buttonDialogSave = document.querySelector("#dialog-save");

    this.buttonsCloseDialog = document.querySelector(".action-close-dialog");
    this.dialogTitle = document.querySelector('#dialog-title');


    this.divColorInputMethod = document.querySelector('#color-input-metod');
    this.divColorList = document.querySelector("#color-list");
    this.divColorListScroll = this.divColorList.querySelector('.scroll');
    this.divColorNative = document.querySelector('#color-native');
    this.divColorRGB = document.querySelector('#color-rgb');
    this.selectColorMethod = document.querySelector('select[name=color_selector_method]');

    this.inputImportFiles = document.querySelector("#import-files");
    this.inputColorNative = this.divColorNative.querySelector('input[name=input_color_native]');
    this.inputRangeBrightness = document.querySelector('input[name=input_bri]');
    this.inputTextRGB = this.divColorRGB.querySelector('input[name=input_color_rgb]')

    this.divErase = document.querySelector('.btn-erase');
    this.divsOpenBrightness = document.querySelector('.action-open-brightness');
    this.divsOpenColorPicker = document.querySelector('.action-open-colorpicker');
    this.divPresets = document.querySelector('#presets');
    this.divsRecentColorsListContainers = document.querySelectorAll(".recent-colors");
    this.divTabLinkPlates = document.querySelector('div[ref=plates]');
    this.divTabLinkPresets = document.querySelector('div[ref=presets]');
    this.divTabPlates = document.querySelector('#tab-plates');
    this.divTabPresets = document.querySelector('#tab-presets');

    this.buttonSendToDevice = document.querySelector('#send-to-device');
    this.buttonClearPlate = document.querySelector('#clear-plate');
    this.buttonSavePreset = document.querySelector('#save-preset');
    this.buttonRemoveAllPresets = document.querySelector('#remove-all-presets');

    this.labelBrightnessRange = document.querySelector('label[for=input_bri]');

    this.modal = document.querySelector(".modal");
    this.modalBrightnessSection = document.querySelector('#d-brightness');
    this.modalColorPickerSection = document.querySelector('#d-color');

    this.spanShowColorRGB = document.querySelector('#show-color-rgb');
    this.spanShowColorR = document.querySelector('#show-color-r');
    this.spanShowColorG = document.querySelector('#show-color-g');
    this.spanShowColorB = document.querySelector('#show-color-b');
    this.spanShowColorWavelength = document.querySelector('#show-color-wavelength');
    this.spanShowColorBox = document.querySelector('#show-color-box');

    this.tempalateColorItem = document.querySelector("#template-color-item").content.querySelector('.color-item')
    this.tempalateRecentColorItem = document.querySelector('#template-recent-color-item').content.querySelector('.color');
    this.tempalatePreset = document.querySelector('#template-preset').content.querySelector('.preset');

    // !modal
    addEventListener("storage", this.handleStorageEvent);
    this.appLoadStateHistoryFromStorage().then((() => {
      this.render(null, true);
    }).bind(this), (() => {
      this.render(null, true);
    }).bind(this))
  }

  createBrightnessIntent(value) {
    const intent = this.intent ? this.intent : this.#getNewIntent();
    intent.brightness = value;
    return intent;
  }

  createColorIntentDialog(hexColor) {
    this.intent = this.intent ? this.intent : this.#getNewIntent();
    this.intent.color = hexColor;
    if (Helpers.testHex(hexColor)) {
      this.setShowColor(hexColor);
    }
  }

  dialogSave() {
    const validation = this.validateIntent(this.intent);
    if (validation.hasError) {
      if (validation.color.error) {
        this.inputTextRGB.classList.add('error');
      }
    } else {
      this.inputTextRGB.classList.remove('error');
      if (!this.intet) {
        this.itent = this.#getNewIntent();
      }
      const state = this.setValues(this.intent.color, this.intent.brightness);
      this.clearDialogState(state);
      this.intent = null;
      this.render(state)
    }
  }

  getPresetById(id) {
    const preset = this.state?.presets?.reduce((acc, p) => { return p.id === id ? p : acc; }, undefined);
    return preset ? preset : null;
  }

  initEventHandlers() {
    document.addEventListener('touchstart', this.handleCursorActions.bind(this));
    document.addEventListener('mousedown', this.handleCursorActions.bind(this));
    document.addEventListener('mousemove', this.handleCursorActions.bind(this));
    document.addEventListener('touchmove', this.handleCursorActions.bind(this));
    document.addEventListener('mouseup', this.handleCursorActions.bind(this));
    document.addEventListener('touchend', this.handleCursorActions.bind(this));


    this.buttonDialogSave.addEventListener('click', UI.handleDialogSave);

    this.buttonClearPlate.addEventListener('click', UI.handleActionClearPlates.bind(this));
    this.buttonRemoveAllPresets.addEventListener('click', UI.handleRemoveAllPresets.bind(this));
    this.buttonSavePreset.addEventListener('click', UI.handleActionSavePreset.bind(this));
    this.buttonSendToDevice.addEventListener('click', UI.handleActionSendToDevice.bind(this));

    this.inputColorNativeEvents = UI.handleInputColorChange(this.callbackChangeColor.bind(this));
    this.inputColorNative.addEventListener('change', this.inputColorNativeEvents.change.bind(this));
    this.inputColorNative.addEventListener('input', this.inputColorNativeEvents.input.bind(this));

    this.inputRangeBrightnessEvents = UI.handleRangeChange(this.callbackChangeBrightness.bind(this));
    this.inputRangeBrightness.addEventListener('change', this.inputRangeBrightnessEvents.change.bind(this));
    this.inputRangeBrightness.addEventListener('mousedown', this.inputRangeBrightnessEvents.mousedown.bind(this));
    this.inputRangeBrightness.addEventListener('mousemove', this.inputRangeBrightnessEvents.mousemove.bind(this));
    this.inputRangeBrightness.addEventListener('mouseup', this.inputRangeBrightnessEvents.mouseup.bind(this));
    this.inputRangeBrightness.addEventListener('touchstart', this.inputRangeBrightnessEvents.touchstart.bind(this));
    this.inputRangeBrightness.addEventListener('touchmove', this.inputRangeBrightnessEvents.touchmove.bind(this));
    this.inputRangeBrightness.addEventListener('touchend', this.inputRangeBrightnessEvents.touchend.bind(this));

    this.inputTextRGBEvents = UI.handleInputTextRGBChange(this.callbackChangeColor.bind(this));
    this.inputTextRGB.addEventListener('keyup', this.inputTextRGBEvents.keyup);

    this.inputImportFiles.addEventListener("change", UI.handleImportFiles);

    this.selectColorMethod.addEventListener('change', UI.handleColorSelectorMethodChange);

    this.initSelectFromRecentColorsEvents();

    this.buttonsCloseDialog.addEventListener('click', UI.handleCloseColorPicker);
    this.divErase.addEventListener('click', UI.handleErase);

    this.divsOpenBrightness.addEventListener('click', UI.handleOpenBrightness);

    this.divsOpenColorPicker.addEventListener('click', UI.handleOpenColorPicker);

    this.inputTitle.addEventListener('change', UI.handleTitleChange);

    document.querySelectorAll('.tab-link').forEach(tl => {
      tl.addEventListener('click', UI.handleTabs);
    })
  }

  initSelectFromRecentColorsEvents() {
    this.divsRecentColorsListContainers.forEach(div => {
      const items = div.querySelectorAll('.picker.color');
      items.forEach(i => {
        i.addEventListener('click', UI.handleColorSelectionRecent);
      })
    });
  }

  initSelectFromColorListEvents() {
    const items = this.divColorListScroll.querySelectorAll('.color-item');
    items.forEach(i => {
      i.addEventListener('click', UI.handleColorItemSelection);
    });
  }

  initPresetActionEvents(preset) {
    preset.querySelector('.p-download').addEventListener('click', UI.handlePresetDownload);
    preset.querySelector('.p-load').addEventListener('click', UI.handlePresetLoad);
    preset.querySelector('.p-remove').addEventListener('click', UI.handlePresetRemove);
  }

  loadPreset(preset) {
    const state = this.#getNewState();
    state.plates = preset.data.plates;
    state.values.brightness = preset.data.brightness;
    this.render(state);
  }

  openBrightness() {
    const state = this.#getNewState();
    state.modal.opened = !state.modal.opened;
    state.modal.showBrightness = true;
    state.modal.showColorPicker = false;
    state.modal.title = 'Brightness';
    this.render(state);
  }

  openColorPicker() {
    const state = this.#getNewState();
    state.modal.opened = !state.modal.opened;
    state.modal.showBrightness = false;
    state.modal.showColorPicker = true;
    state.modal.title = 'Colors';
    this.intent = this.#getNewIntent();
    this.render(state);
  }

  openTab(tabRef) {
    const state = this.#getNewState();
    state.tabs.plates = tabRef === 'plates' ? true : false;
    state.tabs.presets = tabRef === 'presets' ? true : false;
    this.render(state);
  }

  render(input_state, initial) {
    const state = input_state ? input_state : this.#getNewState();
    this.state = state;

    try {
      this.#renderTabs();
      this.#renderPlates();
      this.#renderStateRecentColor(initial);
      this.#renderTitle();
      this.#renderBrightnessValue();
      this.#renderStatePresets();
      this.#renderStateDialog();
      // console.log(state);
      this.stateHistory.push(state);
      this.stateHistory = this.stateHistory.slice(-100);
      this.appSaveStateHistoryToStorage();
    } catch (e) {
      console.error(e);
    }

  }

  removePreset(id) {
    const state = this.#getNewState();
    state.presets = state.presets.filter(p => p.id !== id);
    this.render(state);
  }

  removeAllPresets() {
    const state = this.#getNewState();
    state.presets = [];
    this.render(state);
  }

  removePresetActionEvents(preset) {
    preset.querySelector('.p-download').removeEventListener('click', UI.handlfePresetDownload);
    preset.querySelector('.p-download').removeEventListener('touchstart', UI.handlePresetDownload);
    preset.querySelector('.p-load').removeEventListener('click', UI.handlePresetLoad);
    preset.querySelector('.p-load').removeEventListener('touchstart', UI.handlePresetLoad);
    preset.querySelector('.p-remove').removeEventListener('click', UI.handlePresetRemove);
    preset.querySelector('.p-remove').removeEventListener('touchstart', UI.handlePresetRemove);
  }

  savePlates() {
    const state = this.#getNewState();
    state.plates = this.plates;
    this.plates = null;
    this.render(state);
  }

  selectColorFromRecent(value) {
    const state = this.setValues(value);
    this.render(state);
  }

  selectErase() {
    const state = this.#getNewState();
    state.values.color = '#eee';
    state.recent_colors = ['#eee', ...this.state.recent_colors.filter(rc => rc !== '#eee')];
    this.render(state);
  }

  setValues(color, brightness) {
    const state = this.#getNewState();
    state.values.color = color ? color : state.values.color;
    state.values.brightness = brightness ? brightness : state.values.brightness
    state.recent_colors = color ? [color, ...this.state.recent_colors.filter(rc => rc !== color && rc !== '#eee')] : state.recent_colors;
    return state;
  }

  setShowColor(hexColor) {
    const wavelength = Helpers.hexToWavelength(hexColor);
    const { r, g, b } = Helpers.hexToRGB(hexColor);

    this.spanShowColorBox.style.backgroundColor = hexColor;
    this.spanShowColorRGB.textContent = hexColor;
    this.spanShowColorR.textContent = r
    this.spanShowColorG.textContent = g
    this.spanShowColorB.textContent = b
    this.spanShowColorWavelength.textContent = wavelength ? `${wavelength}nm` : 'N/A';
  }

  validateIntent(intent) {
    if (!intent) return { hasError: false, brightness: { error: false }, color: { error: false } };

    let hasError = false;

    const validation = {};

    if (intent.brightness) {
      if (intent.brightness < 0 || intent.brightness > 255) {
        hasError = true;
        validation.brightness = { error: true, msg: 'Value must be in range 0 - 255' };
      } else {
        validation.brightness = { error: false };
      }
    }

    if (!Helpers.testHex(intent?.color)) {
      hasError = true;
      validation.color = { error: true, msg: 'Must be valid color in format #rrggbb' };
    } else {
      validation.color = { error: false };
    }

    validation.hasError = hasError;

    return validation;
  }

  valueChangeTitle(value) {
    this.state.title = value;
    this.render();
  }

  #recreateColorList(container, colorList) {
    const colorItems = Array.from(container.querySelectorAll('.color-item'));
    colorItems.forEach(ci => {
      ci.removeEventListener('click', UI.handleColorItemSelection);
      ci.removeEventListener('touchstart', UI.handleColorItemSelection);
      ci.remove();
    });

    colorList.forEach(rc => {
      const node = document.importNode(this.tempalateColorItem, true);
      node.setAttribute('md-value', rc);
      node.textContent = rc.substr(1, 6);
      node.style.backgroundColor = rc;
      node.style.color = Helpers.textContrastCalcFromBg(rc);
      container.appendChild(node);
    });

    this.initSelectFromColorListEvents();
  }

  // private methods
  #recreateRecentColors(container, threeRecentColors) {
    const colorElements = Array.from(container.querySelectorAll('.color'));
    colorElements.forEach(ce => {
      ce.removeEventListener('click', UI.handleColorSelectionRecent);
      ce.removeEventListener('touchstart', UI.handleColorSelectionRecent);
      ce.remove();
    });
    threeRecentColors.forEach(rc => {
      const node = document.importNode(this.tempalateRecentColorItem, true);
      node.setAttribute('md-value', rc);
      node.textContent = rc.substr(1, 6);
      node.style.backgroundColor = rc;
      node.style.color = Helpers.textContrastCalcFromBg(rc);
      if (rc === this.state.values.color) {
        node.setAttribute('selected', 'true');
      }
      container.appendChild(node);
    });

    this.initSelectFromRecentColorsEvents();
  }

  #getNewIntent() {
    return window.structuredClone(this.intent ? this.intent : this.state.values);
  }

  #getNewState() {
    if (this.state) {
      return window.structuredClone(this.state);
    }

    const state = this.state ? window.structuredClone(this.state) : this.initialState;
    state.uuid = Helpers.uuidv4();

    return state;
  }

  #getOldState() {
    if (this.stateHistory?.length) {
      return this.stateHistory[this.stateHistory.length - 1];
    }

    return null;
  }

  #renderBrightnessValue() {
    this.divsOpenBrightness.textContent = `${this.state.values.brightness}%`;
  }

  #renderPlates() {
    for (let i = 0; i < 96; i++) {
      const bottomColor = this.state.plates.bottom[i] ?? '#eee';
      const topColor = this.state.plates.top[i] ?? '#eee';
      const b_obj = Helpers.cordToStr('bottom', i);
      const t_obj = Helpers.cordToStr('top', i);

      this.bottomSVG.querySelector(`circle.${b_obj.s}`)?.setAttribute('fill', bottomColor);
      this.topSVG.querySelector(`circle.${t_obj.s}`)?.setAttribute('fill', topColor);

    }
  }

  #renderStatePresets() {
    const presetsHtml = Array.from(this.divPresets.querySelectorAll('.preset'));

    const htmlUuids = presetsHtml.map(e => e.getAttribute('md-id')).sort();
    const uuids = this.state.presets.map(p => p.id).sort();

    if (!Helpers.arrEqual(htmlUuids, uuids)) {
      presetsHtml.forEach(ph => {
        this.removePresetActionEvents(ph);
        ph.remove();
      });
      this.state.presets.forEach(p => {
        const node = document.importNode(this.tempalatePreset, true);
        node.setAttribute('md-id', p.id);
        node.querySelector('.p-remove').setAttribute('md-ref', p.id);
        node.querySelector('.p-download').setAttribute('md-ref', p.id);
        node.querySelector('.p-load').setAttribute('md-ref', p.id);
        node.querySelector('.preset-title').textContent = p.title;
        // node.querySelector('.preset-values > textarea').textContent = JSON.stringify(p.data);
        const img = node.querySelector('.preset-image > img');
        img.setAttribute('src', p.img);
        img.setAttribute('title', p.title);
        img.setAttribute('alt', p.title);
        this.divPresets.appendChild(node);
        this.initPresetActionEvents(node);
      })
    }

  }

  #renderStateDialog() {
    this.dialogTitle.textContent = this.state.modal.title;

    this.modalBrightnessSection.style.display = this.state.modal.showBrightness ? 'flex' : 'none';
    this.modalColorPickerSection.style.display = this.state.modal.showColorPicker ? 'flex' : 'none';

    if (this.state.modal.showBrightness) {
      const brightness = this.intent ? this.intent.brightness : this.state.values.brightness;

      this.inputRangeBrightness.value = brightness;
      this.labelBrightnessRange.textContent = `${brightness}%`;

    } else if (this.state.modal.showColorPicker) {
      const color = this.intent ? this.intent.color : this.state.values.color;

      this.inputColorNative.value = color;
      this.inputTextRGB.value = color;

      this.setShowColor(color);
      this.#recreateColorList(this.divColorListScroll, this.state.recent_colors.filter(rc => rc !== '#eee'));

      this.divColorList.style.display = this.state.modal.colorInputMethod.colorList ? 'flex' : 'none';
      this.divColorRGB.style.display = this.state.modal.colorInputMethod.rgb ? 'flex' : 'none';
      this.divColorNative.style.display = this.state.modal.colorInputMethod.native ? 'flex' : 'none';

      const key_selected = Object.entries(this.state.modal.colorInputMethod).reduce((acc, e) => { return e[1] === true ? e[0] : acc; }, 'colorList');
      this.selectColorMethod.value = key_selected;
    }


    if (this.state.modal.opened) {
      this.modal.classList.add('opened');
    } else {
      this.modal.classList.remove('opened');
    }
  }

  #renderStateRecentColor(initial) {
    const old_state = this.#getOldState();
    const newColor = this.state?.values?.color;
    const oldColor = old_state?.values?.color;

    if (!initial && newColor === oldColor) {
      return;
    }

    const oldThreeRecentColors = old_state ? old_state.recent_colors.slice(0, 3) : [];
    const newTreeRecentColors = this.state.recent_colors.slice(0, 3);

    this.divsRecentColorsListContainers.forEach(container => {
      if (initial || oldThreeRecentColors.indexOf(newColor) === -1) {
        this.#recreateRecentColors(container, newTreeRecentColors)
      } else {
        const newSelectedElement = Array.from(container.querySelectorAll('.color')).filter(ce => ce.getAttribute('md-value') === newColor)[0];
        const oldSelectedElement = container.querySelector('.color');
        container.insertBefore(newSelectedElement, oldSelectedElement);
        oldSelectedElement.removeAttribute('selected');
        newSelectedElement.setAttribute('selected', 'true');
      }
    });
  }

  #renderTabs() {
    this.divTabPlates.style.display = this.state.tabs.plates ? 'flex' : 'none';
    this.divTabPresets.style.display = this.state.tabs.presets ? 'flex' : 'none';

    if (this.state.tabs.plates) {
      this.divTabLinkPlates.classList.add('selected')
    } else {
      this.divTabLinkPlates.classList.remove('selected')
    }

    if (this.state.tabs.presets) {
      this.divTabLinkPresets.classList.add('selected');
    } else {
      this.divTabLinkPresets.classList.remove('selected');
    }
  }

  #renderTitle() {
    this.inputTitle.value = this.state.title;
  }

}

((undefined) => {
  window.app = {
    ui: new UI(),
  }

  window.app.ui.initEventHandlers();
})()