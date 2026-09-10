// serial.js - Handles Web Serial API connection to the laser controller

let port;
let writer;

async function connectSerial() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        writer = port.writable.getWriter();
        
        document.getElementById('connectionStatus').innerText = "Connected";
        document.getElementById('connectionStatus').className = "status-connected";
        document.getElementById('sendGcodeBtn').disabled = false;
        console.log("Serial connection established.");
    } catch (error) {
        console.error("Serial connection failed:", error);
        alert("Could not connect to device. Ensure USB is plugged in.");
    }
}

async function sendGCodeToMachine(gcodeText) {
    if (!writer) {
        alert("Device not connected!");
        return;
    }

    const lines = gcodeText.split("\n");
    for (let line of lines) {
        if (line.trim() === "" || line.startsWith(";")) continue;
        
        const data = encoder.encode(line.trim() + "\n");
        await writer.write(data);
        console.log(`Sent: ${line.trim()}`);
        
        // Brief delay to allow GRBL buffer processing
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    alert("G-code execution completed!");
}

const encoder = new TextEncoder();