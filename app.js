// app.js - Wires UI buttons to vision processing and serial hardware control

let canvas = document.getElementById('imageCanvas');
let ctx = canvas.getContext('2d');
let currentGCode = "";

// Check OpenCV readiness
let checkOpenCV = setInterval(() => {
    if (typeof cv !== 'undefined' && cv.Mat) {
        clearInterval(checkOpenCV);
        document.getElementById('processBtn').disabled = false;
    }
}, 500);

// Load uploaded image
document.getElementById('imageLoader').addEventListener('change', (e) => {
    let reader = new FileReader();
    reader.onload = function (event) {
        let img = new Image();
        img.onload = function () {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

// Process button handler
document.getElementById('processBtn').addEventListener('click', async () => {
    let result = await analyzeImageAndGenerateGCode(canvas);
    if (result) {
        currentGCode = result.gcode;
        document.getElementById('gcodeOutput').value = currentGCode;
        cv.imshow('imageCanvas', result.processedMat);
        result.processedMat.delete();
    }
});

// Serial connection button handler
document.getElementById('connectSerialBtn').addEventListener('click', () => {
    connectSerial();
});

// Send G-code button handler
document.getElementById('sendGcodeBtn').addEventListener('click', () => {
    if (currentGCode) {
        sendGCodeToMachine(currentGCode);
    } else {
        alert("No G-code generated yet!");
    }
});