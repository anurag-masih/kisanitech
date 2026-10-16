// vision.js - Handles perspective correction, image analysis, coordinate mapping, and G-code compilation

async function analyzeImageAndGenerateGCode(canvasElement) {
    if (typeof cv === 'undefined' || !cv.Mat) {
        alert("OpenCV is still loading...");
        return { gcode: "", processedCanvas: null };
    }

    let src = cv.imread(canvasElement);

    // ==========================================
    // STEP 1: PERSPECTIVE CORRECTION (Freehand Warp)
    // ==========================================
    // NOTE: You can dynamically pass or auto-detect these 4 corner points (Top-Left, Top-Right, Bottom-Right, Bottom-Left).
    // For automatic handling or full bed usage, you can define them based on your image size or image markers.
    let srcWidth = src.cols;
    let srcHeight = src.rows;

    // Default fallback: assumes the whole image bounds are the corners if no custom tag detection is used yet.
    // (To use manual/auto corner detection, replace these coordinates with your detected marker points)
    let cornerPoints = [
        { x: 0, y: 0 },                       // Top-Left
        { x: srcWidth, y: 0 },                // Top-Right
        { x: srcWidth, y: srcHeight },        // Bottom-Right
        { x: 0, y: srcHeight }                // Bottom-Left
    ];

    let warpedMat = warpBedPerspective(src, cornerPoints);

    // ==========================================
    // STEP 2: COLOR THRESHOLDING & WEED DETECTION
    // ==========================================
    let hsv = new cv.Mat();
    cv.cvtColor(warpedMat, hsv, cv.COLOR_RGB2HSV);

    // Color thresholding for green weeds
    let lowerGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 40, 40, 0]);
    let upperGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [85, 255, 255, 0]);
    let mask = new cv.Mat();
    cv.inRange(hsv, lowerGreen, upperGreen, mask);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // ==========================================
    // STEP 3: PHYSICAL BED MAPPING (400mm x 400mm)
    // ==========================================
    // Because warpedMat is standardized to a 400x400 pixel square, scaling is 1:1 to millimeters!
    let bedWidthMm = 400.0;
    let bedHeightMm = 400.0;
    let scaleX = bedWidthMm / warpedMat.cols;
    let scaleY = bedHeightMm / warpedMat.rows;

    let gcodeLines = [];
    gcodeLines.push("G21 ; Units in mm");
    gcodeLines.push("G90 ; Absolute positioning");
    gcodeLines.push("M4  ; Dynamic laser mode");

    let processedMat = warpedMat.clone();

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
    src.delete(); 
    warpedMat.delete();
    hsv.delete(); 
    lowerGreen.delete(); 
    upperGreen.delete();
    mask.delete(); 
    contours.delete(); 
    hierarchy.delete();

    return {
        gcode: gcodeLines.join("\n"),
        processedMat: processedMat
    };
}

// Helper Function: Perspective Transformation to flatten freehand angled photos
function warpBedPerspective(srcMat, cornerPoints) {
    let targetSize = 400; // 400x400 pixels mapped to 400mm x 400mm bed
    let dsize = new cv.Size(targetSize, targetSize);

    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        cornerPoints[0].x, cornerPoints[0].y, // Top-Left
        cornerPoints[1].x, cornerPoints[1].y, // Top-Right
        cornerPoints[2].x, cornerPoints[2].y, // Bottom-Right
        cornerPoints[3].x, cornerPoints[3].y  // Bottom-Left
    ]);

    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        targetSize, 0,
        targetSize, targetSize,
        0, targetSize
    ]);

    let transformMatrix = cv.getPerspectiveTransform(srcTri, dstTri);
    let warpedMat = new cv.Mat();
    cv.warpPerspective(srcMat, warpedMat, transformMatrix, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    srcTri.delete();
    dstTri.delete();
    transformMatrix.delete();

    return warpedMat;
}
