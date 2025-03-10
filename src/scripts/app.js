import UI from '@alexgyver/ui'; import CanvasMatrix from './canvas'
import Matrix from './matrix';
import ImageLoader from './imageloader';
import * as proc from './processor';
import Timer from './timer';
import { dither, edges_median, edges_simple, edges_sobel, threshold } from './filters';
import { Component } from '@alexgyver/component';
import { lang } from './lang';

let base_ui = new UI(), filt_ui = new UI();
const preview_delay = 400;
let canvas = new CanvasMatrix();
let image = new ImageLoader();
let editor = new Matrix();
let timer = new Timer();
let files = null;
let cur_lang = 1; // 0- Enlish, 1 - Russian
let prev_s = 0;

const displayModes = [
    { active: '#478be6', back: 0 },
    { active: '#000000', back: 1 }
];

async function file_h(file) {
    if (file instanceof File || typeof file === 'string') {
        files = null;
        await processFile(file);
    } else if (file instanceof FileList) {
        files = file;
        await processFile(files[0]);
    } else {
        files = null;
    }
}
async function processFile(file) {
    try {
        await image.load(file);
    } catch (e) {
        alert(e);
        return;
    }
    editor.clear();
    base_ui.name = image.name;
    update_h();
}
async function link_h(link) {
    if (link.length) {
        await file_h(link);
        base_ui.link = '';
    }
}

function resize_h() {
    let wh = [base_ui.width, base_ui.height];
    canvas.resize(wh[0], wh[1]);
    editor.resize(wh[0], wh[1]);
    if (Math.max(wh[0], wh[1]) > 500) filt_ui.preview = false;
    update_h();
}

function fit_h() {
    if (image.image) image.fit(canvas);
    update_h();
}

function update_h() {
    update();
    render();
}

function update() {
    if (image.image) {

        image.render(
            canvas,
            base_ui.rotate,
            filt_ui.invert_b,
            {
                invert: displayModes[filt_ui.display].back ^ filt_ui.invert,
                brightness: filt_ui.brightness,
                contrast: filt_ui.contrast,
                saturate: filt_ui.saturate,
                blur: filt_ui.blur,
                grayscale: base_ui.mode == 2 ? 0 : 100,
            }
        );

        // grayscale
        if (base_ui.mode != 2) {
            for (let i = 0; i < canvas.matrix.length; i++) {
                canvas.matrix[i] &= 0xff;
            }
        }

        if (base_ui.mode <= 1) {
            if (filt_ui.edges) edges_simple(canvas.matrix, canvas.W, canvas.H);
            if (filt_ui.sobel) edges_sobel(canvas.matrix, canvas.W, canvas.H, filt_ui.sobel);
            if (filt_ui.dither) dither(canvas.matrix, canvas.W, canvas.H);
            if (base_ui.mode == 0) threshold(canvas.matrix, filt_ui.threshold * 2.56);
            if (filt_ui.median) edges_median(canvas.matrix, canvas.W, canvas.H);
        }
    }
}

function render() {
    canvas.merge(editor);
    canvas.render(filt_ui.grid);
    process();
}

function process() {
    let result = proc.makeCode(canvas, base_ui.process, base_ui.name);
    base_ui.code = result.code;

    let info = `${canvas.W}x${canvas.H} (${result.size} bytes)<br>`;
    info += Math.round(canvas.matrix.filter(v => v).length / canvas.matrix.length * 100) + '% pixels on'
    base_ui.result = info;
}

function show() {
    image.show(canvas,
        base_ui.rotate,
        displayModes[filt_ui.display].back ^ filt_ui.invert_b,
        {
            invert: filt_ui.invert,
        }
    );
}

function display_h() {
    let colors = displayModes[filt_ui.display];
    canvas.setColors(colors.active, colors.back);
    update_h();
}

function mode_h(mode) {
    filt_ui.control('edges').display(mode != 2);
    filt_ui.control('sobel').display(mode != 2);
    filt_ui.control('median').display(mode != 2);

    filt_ui.control('dither').display(mode == 0);
    filt_ui.control('threshold').display(mode == 0);
    filt_ui.control('editor').display(mode == 0);

    base_ui.process = (mode == 0) ? 0 : (mode == 1 ? 7 : 8);
    canvas.setMode(mode);
    resetFilt();
    reset_h();
    update_h();
}

function process_h(p) {
    update_h();
}

function reset_h() {
    base_ui.control('rotate').default();
    filt_ui.control('invert_b').default();
    filt_ui.control('invert').default();
    resetFilt();
    editor.clear();
    update_h();
}

function resetFilt() {
    filt_ui.control('brightness').default();
    filt_ui.control('contrast').default();
    filt_ui.control('saturate').default();
    filt_ui.control('blur').default();
    filt_ui.control('edges').default();
    filt_ui.control('sobel').default();
    filt_ui.control('dither').default();
    filt_ui.control('threshold').default();
    filt_ui.control('median').default();
    filt_ui.control('editor').default();
}

// ============== EDITOR ==============
function btn_to_val(btn) {
    // 0 lmb, 1 mmb, 2 rmb
    return (btn == 0) ? 1 : (btn == 1 ? 0 : -1);
}
function click_h(v, button) {
    if (filt_ui.editor) {
        editor.set(v.x, v.y, btn_to_val(button));
        update_h();
    }
}

// ============== MOUSE ==============
function drag_h(v, button) {
    if (filt_ui.editor) {
        editor.set(v.block.x, v.block.y, btn_to_val(button));
        update_h();
        return;
    }

    editor.clear();
    image.pan(v.dx, v.dy, v.release);
    if (filt_ui.preview || v.release) {
        update_h();
    } else {
        show();
    }
}
function scale_h(v) {
    wheel_h(prev_s < v ? 1 : -1);
    prev_s = v;
}
function wheel_h(v) {
    if (filt_ui.editor) return;
    timer.stop();
    editor.clear();
    image.scale(v);

    if (filt_ui.preview) {
        update_h();
    } else {
        show();
        timer.start(update_h, preview_delay);
    }
}
function rotate_h() {
    editor.clear();

    if (filt_ui.preview) {
        update_h();
    } else {
        show();
        timer.start(update_h, preview_delay);
    }
}

function sleep(time) {
    return new Promise(res => setTimeout(res, time));
}

async function bulk_h() {
    if (files == null) {
        alert(lang[cur_lang].base.bulk_info);
        return;
    }

    let str = '';
    let idx = 0;
    let size = 0;
    let process = base_ui.process;
    let name = base_ui.name;
    let names = '';
    let offset = Object.assign({}, image.offset);

    for (let file of files) {
        base_ui.result = 'Bulk process: ' + Math.round(idx / files.length * 100) + '%';
        try {
            await image.load(file);
        } catch (e) {
            alert(e);
            return;
        }
        editor.clear();
        image.setOffset(offset);
        update();
        canvas.merge(editor);
        canvas.render(filt_ui.grid);

        let result = proc.makeCode(canvas, process, name + '_' + idx);
        if (idx) {
            names += ', ';
            if (idx % 8 == 0) names += '\r\n\t';
        }
        names += result.name;
        idx++;
        size += result.size;
        str += result.code;
        str += '\r\n\r\n';
    }
    str += `const uint16_t ${name}_list_size = ${idx};\r\n\r\n`;
    str += `${proc.processes.prefix[process]}* const ${name}_list_pgm[] PROGMEM = {\r\n\t${names}\r\n};\r\n\r\n`;
    str += `${proc.processes.prefix[process]}* const ${name}_list[] = {\r\n\t${names}\r\n};\r\n\r\n`;

    base_ui.code = str;
    base_ui.result = 'Encoded ' + idx + ' files<br>' + (size / 1024.0).toFixed(2) + ' kB';
    return str;
}

async function bulkH_h() {
    let bulk = await bulk_h();
    if (!bulk) return;

    let str = `#pragma once
    #include <Arduino.h>
    ${(base_ui.process >= 3 && base_ui.process <= 5) ? '#include <GyverGFX.h>' : ''}
    
    // Bitmaper bulk process ${files.length} files
    
    `;
    str += bulk;
    proc.downloadTextH('bulk', str);
}

// ============== SAVE ==============
function copy_h() {
    navigator.clipboard.writeText(base_ui.code);
}
function saveH_h() {
    proc.downloadCode(canvas, base_ui.process, base_ui.name);
}
function saveBrail_h() {
    proc.downloadBrail(canvas, base_ui.process, base_ui.name);
}
function saveBin_h() {
    proc.downloadBin(canvas, base_ui.process, base_ui.name);
}
function send_h() {
    let blob = proc.makeBlob(canvas, base_ui.process);
    let formData = new FormData();
    formData.append('bitmap', blob);

    fetch(window.location.href + `bitmap?width=${canvas.W}&height=${canvas.H}`, {
        method: 'POST',
        body: formData
    });
}
function png_h() {
    let link = document.createElement('a');
    link.href = canvas.cv.toDataURL('image/png');
    link.download = base_ui.name + '.png';
    link.click();
}

function lang_h(v) {
    base_ui.lang = v;
    base_ui.setLabels(lang[v].base);
    filt_ui.setLabels(lang[v].filters);
    filt_ui.control('display').options = lang[v].display;
    cur_lang = v;
}

function git_h() {
    window.open('https://github.com/AlexGyver/Bitmaper', '_blank').focus();
}

document.addEventListener("DOMContentLoaded", () => {
    if ('serviceWorker' in navigator && typeof USE_SW !== 'undefined') {
        navigator.serviceWorker.register('sw.js');
    }

    let filters = Component.make('div', {
        id: 'filters',
        class: 'filters',
        parent: document.body,
    });

    let ctx = {};
    Component.make('div', {
        class: 'cv_cont',
        context: ctx,
        parent: document.body,
        children: [
            {
                tag: 'div',
                class: 'cv_inner',
                children: [
                    {
                        tag: 'canvas',
                        class: 'canvas',
                        var: 'cv',
                    }
                ]
            }
        ]
    });

    canvas = new CanvasMatrix(ctx.$cv, click_h, drag_h, wheel_h, displayModes[0].active, displayModes[0].back);

    let buttons = { copy: ["Copy", copy_h], header: [".h", saveH_h], brail: [".txt (Brail)", saveBrail_h], bin: [".bin", saveBin_h] };
    if (window.location.hostname.match(/^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/)) {
        buttons.send = ['Send', send_h];
    }

    // base_ui
    base_ui = new UI({ title: "Bitmaper", theme: 'dark' })
        .addFile('file', '', file_h)
        .addText('link', '', '', link_h)
        .addText('name', '', '', update_h)
        .addNumber('width', '', 128, 1, resize_h)
        .addNumber('height', '', 64, 1, resize_h)
        .addButton('fit', '', fit_h)
        .addRange('scale', '', 0, -300, 300, 1, scale_h)
        .addRange('rotate', '', 0, -180, 180, 5, rotate_h)
        .addSelect('mode', '', ['Mono', 'Gray', 'RGB'], mode_h)
        .addSelect('process', '', proc.processes.names, process_h)
        .addHTML('result', '', '')
        .addButtons({ bulk: ['', bulk_h], bulk_h: ['.h', bulkH_h] })
        .addArea('code', '', '')
        .addButtons(buttons)
        .addSelect('lang', 'Language', ['English', 'Russian'], lang_h)
        .addButtons({ info: ['', info_h], github: ['GitHub', git_h] })

    base_ui.control('scale').input.addEventListener('mouseup', () => base_ui.scale = 0);

    filt_ui = new UI({ title: "Filters", theme: 'dark', parent: filters })
        .addSelect('display', '', [], display_h)
        .addSwitch('grid', '', 1, update_h)
        .addSwitch('invert_b', '', 0, update_h)
        .addSwitch('preview', '', 1)
        .addSwitch('invert', '', 0, update_h)
        .addRange('brightness', '', 100, 0, 250, 5, update_h)
        .addRange('contrast', '', 100, 0, 250, 5, update_h)
        .addRange('saturate', '', 100, 0, 250, 5, update_h)
        .addRange('blur', '', 0, 0, 1, 0.05, update_h)
        .addSwitch('edges', '', 0, update_h)
        .addRange('sobel', '', 0, 0, 1, 0.05, update_h)
        .addSwitch('dither', '', 0, update_h)
        .addRange('threshold', '11', 50, 0, 100, 1, update_h)
        .addSwitch('median', '', 0, update_h)
        .addSwitch('editor', '', 0)
        .addButton('png', '', png_h)
        .addButton('reset', '', reset_h);

    switch (navigator.language || navigator.userLanguage) {
        case 'ru-RU':
        case 'ru':
            lang_h(1);
            break;
        default:
            lang_h(0);
            break;
    }
    resize_h();
});

function info_h() {
    let text = `Bitmaper - программа для преобразования картинок в битмапы

Режимы изображения
- Mono - монохромный (чёрно-белый)
- Gray - оттенки серого
- RGB - полноцветное изображение

Алгоритмы кодирования
- 1x pix/byte - 1 пиксель в байте, строками слева направо сверху вниз: [data_0, ...data_n]
- 8x Horizontal - 8 пикселей в байте горизонтально (MSB слева), строками слева направо сверху вниз: [data_0, ...data_n]
- 8x Vertical Col - 8 пикселей в байте вертикально (MSB снизу), столбцами сверху вниз слева направо: [data_0, ...data_n]
- 8x Vertical Row - 8 пикселей в байте вертикально (MSB снизу), строками слева направо сверху вниз: [data_0, ...data_n] Подходит для GyverOLED
- GyverGFX BitMap - 8 пикселей вертикально (MSB снизу), столбцами сверху вниз слева направо: [widthLSB, widthMSB, heightLSB, heightMSB, data_0, ...data_n]
- GyverGFX BitPack - сжатый формат*: [widthLSB, widthMSB, heightLSB, heightMSB, data_0, ...data_n]
- GyverGFX Image - программа выберет лёгкий между BitMap и BitPack: [0 map | 1 pack, x, x, x, x, data_0, ...data_n]
- Grayscale - 1 пиксель в байте, оттенки серого
- RGB888 - 1 пиксель на 3 байта (24 бит RGB): [r0, g0, b0, ...]
- RGB565 - 1 пиксель на 2 байта (16 бит RGB): [rrrrrggggggbbbbb, ...] тип uint16_t
- RGB233 - 1 пиксель в байте (8 бит RGB): [rrgggbbb, ...]

Редактор
- Действия кнопок мыши при включенном редакторе: ЛКМ - добавить точку, ПКМ - стереть точку, СКМ - отменить изменения на слое редактора
- При изменении размера битмапа, при перемещении и масштабировании изображения слой редактора очищается

Массовая конвертация
- Выбрать несколько файлов или перетащить их на кнопку выбора файлов. Отобразится первый файл
- Настроить параметры кодирования и фильтры, они будут применены ко всем остальным файлам
- Нажать "Массовая конвертация", дождаться окончания
- Результат появится в окне вывода кода. Изображения будут иметь суффиксы с номером, также прогармма составит из них список
- Смотри пример в readme на GitHub

Прочее
- На изображениях со сплошными участками BitPack может быть в разы эффективнее обычного BitMap. На изображениях с dithering работает неэффективно.
- Как кодирует BitPack: младший бит - состояние пикселя, остальные - количество. Сканирование идёт столбцами сверху вниз слева направо. Один чанк - 6 бит (состояние + 5 бит количества), 4 чанка пакуются в три байта как aaaaaabb, bbbbcccc, ccdddddd
- Активный пиксель на выбранном стиле отображения: OLED - голубой, Paper - чёрный
- При открытии приложения с локального сервера (IP адрес в строке адреса), например с esp, появится кнопка Send - при нажатии приложение отправит битмап в выбранном формате через formData на url /bitmap с query string параметрами width и height, т.е. <ip>/bitmap?width=N&height=N`;

    let ctx = {};
    Component.make('div', {
        class: 'info_cont',
        var: 'info',
        parent: document.body,
        context: ctx,
        also(el) {
            el.addEventListener('click', () => el.remove());
        },
        children: [
            {
                tag: 'div',
                class: 'info_inner',
                also(el) {
                    el.addEventListener('click', (e) => e.stopPropagation());
                },
                children: [
                    {
                        tag: 'button',
                        text: 'x',
                        also(el) {
                            el.addEventListener('click', () => ctx.$info.remove());
                        },
                    },
                    {
                        tag: 'span',
                        text: text,
                    }
                ]
            }
        ]
    });
}