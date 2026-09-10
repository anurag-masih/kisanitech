// vision.js - Handles image analysis, coordinate mapping, and G-code compilation

async function analyzeImageAndGenerateGCode(canvasElement) {
    if (typeof cv === 'undefined' || !cv.Mat) {
        alert("OpenCV is still loading...");
        return { gcode: "", processedCanvas: null };
    }

    let src = cv.imread(canvasElement);
    let hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);

    // Color thresholding (Upgrade point: replace this block with YOLO model inference later)
    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
    let upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
    let mask = new cv.Mat();
    cv.inRange(hsv, lowerGreen, upperGreen, mask);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Physical bed mapping (400mm x 400mm)
    let bedWidthMm = 400.0;
    let bedHeightMm = 400.0;
    let scaleX = bedWidthMm / src.cols;
    let scaleY = bedHeightMm / src.rows;

    let gcodeLines = [];
    gcodeLines.push("G21 ; Units in mm");
    gcodeLines.push("G90 ; Absolute positioning");
    gcodeLines.push("M4  ; Dynamic laser mode");

    let processedMat = src.clone();

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);

        if (area > 150) { // Filter noise
            let moments = cv.moments(cnt);
            if (moments.m00 !== 0) {
                let cx = moments.m10 / moments.m00;
                let cy = moments.m01 / moments.m00;

                let mmX = cx * scaleX;
                let mmY = cy * scaleY;

                // Build G-code target loop
                gcodeLines.push(`G1 X${mmX.toFixed(2)} Y${mmY.toFixed(2)} F3000`);
                gcodeLines.push(`M3 S250`);
                gcodeLines.push(`G4 P0.4`);
                gcodeLines.push(`M5`);

                // Draw bounding box and target point on image output
                let rect = cv.boundingRect(cnt);
                cv.rectangle(processedMat, new cv.Point(rect.x, rect.y), new cv.Point(rect.x + rect.width, rect.y + rect.height), [0, 255, 0, 255], 3);
                cv.circle(processedMat, new cv.Point(cx, cy), 6, [255, 0, 0, 255], -1);
            }
        }
    }

    gcodeLines.push("G1 X0 Y0 F3000");
    gcodeLines.push("M30");

    // Clean up memory
    src.delete(); hsv.delete(); lowerGreen.delete(); upperGreen.delete();
    mask.delete(); contours.delete(); hierarchy.delete();

    return {
        gcode: gcodeLines.join("\n"),
        processedMat: processedMat
    };
}