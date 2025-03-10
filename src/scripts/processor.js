import { HEXtoRGB } from "./utils";

//#region processes
export const processes = {
    names: [
        '1 pix/byte',
        '8x Horizontal',
        '8x Vertical Col',
        '8x Vertical Row',
        'GyverGFX Image',
        'GyverGFX BitMap',
        'GyverGFX BitPack',
        'Grayscale',
        'RGB888',
        'RGB565',
        'RGB233',
    ],
    prefix: [
        'const uint8_t',
        'const uint8_t',
        'const uint8_t',
        'const uint8_t',
        'gfximage_t',
        'gfxmap_t',
        'gfxpack_t',
        'const uint8_t',
        'const uint8_t',
        'const uint16_t',
        'const uint8_t',
    ],
    extension: [
        '1p',
        '8h',
        '8vc',
        '8vr',
        'img',
        'map',
        'pack',
        'gray',
        'rgb888',
        'rgb565',
        'rgb233',
    ],
    func: [
        make1bit,
        make8horiz,
        make8vert_col,
        make8vert_row,
        makeImage,
        makeBitmap,
        makeBitpack,
        makeGray,
        makeRGB888,
        makeRGB565,
        makeRGB233,
    ],
    mult: [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        1,
    ]
}

//#region makers
function make1bit(m) {
    return m.matrix.map(x => x ? 1 : 0);
}
function make8horiz(m) {
    let data = [];
    let chunk = Math.ceil(m.W / 8);
    for (let y = 0; y < m.H; y++) {
        for (let xx = 0; xx < chunk; xx++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte <<= 1;
                byte |= m.get(xx * 8 + b, y) ? 1 : 0;
            }
            data.push(byte);
        }
    }
    return data;
}
function make8vert_col(m) {
    let data = [];
    let chunk = Math.ceil(m.H / 8);
    for (let x = 0; x < m.W; x++) {
        for (let yy = 0; yy < chunk; yy++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte >>= 1;
                byte |= (m.get(x, yy * 8 + b) ? 1 : 0) << 7;
            }
            data.push(byte);
        }
    }
    return data;
}
function make8vert_row(m) {
    let data = [];
    let chunk = Math.ceil(m.H / 8);
    for (let yy = 0; yy < chunk; yy++) {
        for (let x = 0; x < m.W; x++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte >>= 1;
                byte |= (m.get(x, yy * 8 + b) ? 1 : 0) << 7;
            }
            data.push(byte);
        }
    }
    return data;
}
function makeBitpack(m) {
    let data = [(m.W & 0xff), (m.W >> 8) & 0xff, (m.H & 0xff), (m.H >> 8) & 0xff];
    let i = 0, value = 0, shift = 0;

    let push = () => {
        let chunk = (i << 1) | value;
        switch ((shift++) & 0b11) {
            case 0:
                data.push(chunk << 2);
                break;
            case 1:
                data[data.length - 1] |= chunk >> 4;
                data.push((chunk << 4) & 0b11110000);
                break;
            case 2:
                data[data.length - 1] |= chunk >> 2;
                data.push((chunk << 6) & 0b11000000);
                break;
            case 3:
                data[data.length - 1] |= chunk;
                break;
        }
    }

    for (let x = 0; x < m.W; x++) {
        for (let y = 0; y < m.H; y++) {
            let v = m.get(x, y) ? 1 : 0;
            if (!i) {
                i = 1;
                value = v;
            } else {
                if (value == v) {
                    i++;
                    if (i == 31) {
                        push();
                        i = 0;
                    }
                } else {
                    push();
                    value = v;
                    i = 1;
                }
            }
        }
    }
    if (i) push();

    return data;
}
function makeBitmap(m) {
    return [(m.W & 0xff), ((m.W >> 8) & 0xff), (m.H & 0xff), ((m.H >> 8) & 0xff)].concat(make8vert_col(m));
}
function makeImage(m) {
    let mapsize = Math.ceil(m.H / 8) * m.W + 4;
    let pack = makeBitpack(m);
    return (mapsize <= pack.length) ? [0].concat(makeBitmap(m)) : [1].concat(pack);
}
function makeGray(m) {
    return [...m.matrix];
}
function makeRGB888(m) {
    let data = [];
    for (let hex of m.matrix) {
        data.push(...HEXtoRGB(hex));
    }
    return data;
}
function makeRGB565(m) {
    let data = [];
    for (let hex of m.matrix) {
        let rgb = HEXtoRGB(hex);
        data.push(((rgb[0] & 0b11111000) << 8) | ((rgb[1] & 0b11111100) << 3) | (rgb[2] >> 3));
    }
    return data;
}
function makeRGB233(m) {
    let data = [];
    for (let hex of m.matrix) {
        let rgb = HEXtoRGB(hex);
        data.push((rgb[0] & 0b11000000) | ((rgb[1] & 0b11100000) >> 2) | ((rgb[2] & 0b11100000) >> 5));
    }
    return data;
}

//#region export
function makeCodeArray(data, width = 16) {
    let code = '';
    for (let i = 0; i < data.length; i++) {
        if (i % width == 0) code += '\r\n\t';
        code += '0x' + data[i].toString(16).padStart(2, 0);
        if (i != data.length - 1) code += ', ';
    }
    return code;
}

export function makeBlob(m, type) {
    let data = processes.func[type](m);
    let bytes = Int8Array.from(data);
    return new Blob([bytes], { type: "application/octet-stream" });
}

export function downloadBin(m, type, name) {
    let blob = makeBlob(m, type);
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    name += '.' + processes.extension[type];
    link.download = name;
    link.click();
}

export function downloadBrail(m, type, name) {
    var r = "";
    console.log(m.matrix, m.W, m.H);
    for(let y=0; y < m.H; y+=4) {
        for(let x=0; x<m.W; x+=2) {
            var v = 0;
            for (var k = 0; k < 8; k++) {
                var x1 = x, y1 = y;
                if (k <= 2) y1 += k;
                else if (k <= 5) {
                    x1++;
                    y1 += k - 3;
                } else if (k == 6) y1 += 3;
                else {
                    y1 += 3;
                    x1++;
                }
                v = (v >> 1) | (((((x1 + y1 * m.W) < m.W*m.H) ? m.matrix[x1 + y1 * m.W] : 0) > 0) << 7);
            }
            r += String.fromCharCode(v + 10240);
        }
        r += "\n";
        //console.log(y);
    }
    console.log(r);
    let enc = new TextEncoder();
    let bytes = enc.encode(r);
    let blob = new Blob([bytes], { type: "text/plain" });
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    name += '.txt';
    link.download = name;
    link.click();
}

export function downloadCode(m, type, name) {
    let code = makeCode(m, type, name);
    let str = `#pragma once
#include <Arduino.h>
${(type >= 3 && type <= 5) ? '#include <GyverGFX.h>' : ''}

// ${name} (${code.size} bytes)
// ${processes.names[type]}

`;
    str += code.code;
    downloadTextH(name, str);
}

export function downloadTextH(name, str) {
    let enc = new TextEncoder();
    let bytes = enc.encode(str);
    let blob = new Blob([bytes], { type: "text/plain" });
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);

    link.download = name + '.h';
    link.click();
}

export function makeCode(m, type, name) {
    let data = processes.func[type](m);
    let codename = `${name}_${m.W}x${m.H}`;
    let code = `${processes.prefix[type]} ${codename}[] PROGMEM = {`;
    code += makeCodeArray(data, 24);
    code += '\r\n};'
    return { code: code, size: data.length * processes.mult[type], name: codename };
}