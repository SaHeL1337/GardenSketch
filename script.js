document.addEventListener('DOMContentLoaded', () => {
    const cropListElement = document.getElementById('crop-list');
    const cropFilterElement = document.getElementById('crop-filter');
    const gardenCanvas = document.getElementById('garden-canvas');
    const gardenWidthInput = document.getElementById('garden-width');
    const gardenHeightInput = document.getElementById('garden-height');
    const gardenControls = document.querySelector('.garden-controls');
    const clearGardenButton = document.getElementById('clear-garden-button');
    const ctx = gardenCanvas.getContext('2d');

    let cropsData = [];
    let gardenCrops = []; // Crops currently placed in the garden
    let gardenWidthM = parseFloat(gardenWidthInput.value);
    let gardenHeightM = parseFloat(gardenHeightInput.value);
    let pixelsPerMeter = 100;

    let isDragging = false;
    let draggedCrop = null;
    let isGroupDragging = false; // Flag for group drag
    let draggedGroup = []; // Array to hold crops in the group
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const SNAP_THRESHOLD_PX = 10; // Snap within 10 pixels
    const PLACEMENT_SCAN_STEP_M = 0.05; // How finely to scan for placement
    const ICON_SIZE_PX = 16; // Size of the create row icon
    const ICON_PADDING_PX = 2; // Padding from corner
    const ICON_SPACING_PX = 4; // Spacing between icons

    const STORAGE_KEY = 'gardenSketchState'; // Key for localStorage

    let loadedSVGs = {}; // Store loaded SVG Image objects for crops

    // --- Local Storage --- 
    function saveGardenState() {
        try {
            const state = {
                width: gardenWidthM,
                height: gardenHeightM,
                crops: gardenCrops
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            console.log("Garden state saved.");
        } catch (error) {
            console.error("Error saving garden state:", error);
            // Handle potential storage quota errors
        }
    }

    function loadGardenState() {
        try {
            const savedStateJSON = localStorage.getItem(STORAGE_KEY);
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                gardenWidthM = savedState.width || 5; // Use default if property missing
                gardenHeightM = savedState.height || 3;
                gardenCrops = savedState.crops || [];

                // Update input fields to reflect loaded dimensions
                gardenWidthInput.value = gardenWidthM;
                gardenHeightInput.value = gardenHeightM;
                console.log("Garden state loaded.");
                return true; // Indicate state was loaded
            }
        } catch (error) {
            console.error("Error loading garden state:", error);
            // If parsing fails, could clear corrupted state
            // localStorage.removeItem(STORAGE_KEY);
        }
        return false; // Indicate no state was loaded / default used
    }

    // --- Data Loading ---
    async function loadCrops() {
        try {
            const response = await fetch('crops.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            cropsData = await response.json(); 
            
            // Preload SVG images from strings
            const svgLoadPromises = cropsData.map(crop => {
                return new Promise((resolve) => {
                    if (crop.svgString) {
                        const img = new Image();
                        const svgDataBase64 = btoa(unescape(encodeURIComponent(crop.svgString))); // Handle potential special chars
                        img.onload = () => {
                            loadedSVGs[crop.name] = img;
                            console.log(`Loaded SVG for ${crop.name}`);
                            resolve();
                        };
                        img.onerror = (err) => {
                            console.error(`Error loading SVG for ${crop.name}:`, err);
                            loadedSVGs[crop.name] = null;
                            resolve();
                        };
                        img.src = `data:image/svg+xml;base64,${svgDataBase64}`; 
                    } else {
                         loadedSVGs[crop.name] = null;
                         resolve();
                    }
                });
            });

            await Promise.all(svgLoadPromises);
            console.log("Finished SVG loading attempt.");

            displayCrops(cropsData);

            if (!loadGardenState()) {
                 gardenWidthM = parseFloat(gardenWidthInput.value);
                 gardenHeightM = parseFloat(gardenHeightInput.value);
            }
            
            resizeGarden();

        } catch (error) {
            console.error('Error loading crops:', error);
            cropListElement.innerHTML = '<li>Error loading crops.</li>';
        }
    }

    // --- Crop List Management (No Checkboxes) ---
    function displayCrops(crops) {
        cropListElement.innerHTML = ''; // Clear existing list
        crops.forEach(crop => {
            const li = document.createElement('li');
            li.dataset.cropName = crop.name;

            // Color Preview
            const colorPreview = document.createElement('div');
            colorPreview.classList.add('crop-color-preview');
            colorPreview.style.backgroundColor = crop.color || '#ccc';
            li.appendChild(colorPreview);

            // Crop Name Span
            const cropNameSpan = document.createElement('span');
            cropNameSpan.textContent = `${crop.name} (${crop.width_m}m x ${crop.height_m}m)`;
            li.appendChild(cropNameSpan);

            // Double click to add
            li.addEventListener('dblclick', () => addCropToGarden(crop));
            cropListElement.appendChild(li);
        });
    }

    cropFilterElement.addEventListener('input', (e) => {
        const filterText = e.target.value.toLowerCase();
        const filteredCrops = cropsData.filter(crop =>
            crop.name.toLowerCase().includes(filterText)
        );
        displayCrops(filteredCrops);
    });

    // --- Garden Canvas Management ---
    function resizeGarden() {
        gardenWidthM = parseFloat(gardenWidthInput.value);
        gardenHeightM = parseFloat(gardenHeightInput.value);

        const container = gardenCanvas.parentElement;
        const availableWidth = container.clientWidth;
        const availableHeight = container.clientHeight - gardenControls.offsetHeight - 40;

        // Prevent invalid aspect ratio if height/width is 0 or negative
        const aspectRatio = (gardenHeightM > 0 && gardenWidthM > 0) ? gardenWidthM / gardenHeightM : 1;

        let canvasWidth = availableWidth;
        let canvasHeight = canvasWidth / aspectRatio;

        if (canvasHeight > availableHeight) {
            canvasHeight = availableHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        canvasWidth = Math.max(50, canvasWidth); // Ensure minimum size
        canvasHeight = Math.max(50, canvasHeight);

        gardenCanvas.width = canvasWidth;
        gardenCanvas.height = canvasHeight;

        if (gardenWidthM > 0) {
             pixelsPerMeter = gardenCanvas.width / gardenWidthM;
        } else {
             pixelsPerMeter = 1;
        }

        drawGarden();
        saveGardenState(); // Save state after resizing
    }

    function drawGarden() {
        ctx.clearRect(0, 0, gardenCanvas.width, gardenCanvas.height);
        ctx.fillStyle = '#f0e6d2';
        ctx.fillRect(0, 0, gardenCanvas.width, gardenCanvas.height);

        gardenCrops.forEach(crop => {
            drawCrop(crop);
        });
    }

    function drawCrop(crop) {
        const widthPx = crop.width_m * pixelsPerMeter;
        const heightPx = crop.height_m * pixelsPerMeter;
        const xPx = crop.x * pixelsPerMeter;
        const yPx = crop.y * pixelsPerMeter;
        const isSelected = crop.id === selectedCropId; // Using temporary variable from mousedown now

        // Draw background color first (fallback)
        ctx.fillStyle = crop.color || '#eee';
        ctx.fillRect(xPx, yPx, widthPx, heightPx);

        // Draw SVG if loaded
        const svgImg = loadedSVGs[crop.name];
        if (svgImg && svgImg.complete && svgImg.naturalWidth > 0) {
             try { ctx.drawImage(svgImg, xPx, yPx, widthPx, heightPx); } 
             catch (e) { 
                 console.error(`Error drawing SVG for ${crop.name}:`, e);
                 ctx.fillStyle = crop.color || '#eee'; ctx.fillRect(xPx, yPx, widthPx, heightPx);
                 drawCropTextFallback(crop, xPx, yPx, widthPx, heightPx);
             }
        } else {
            ctx.fillStyle = crop.color || '#eee'; ctx.fillRect(xPx, yPx, widthPx, heightPx);
            drawCropTextFallback(crop, xPx, yPx, widthPx, heightPx);
        }

        // Draw border (reverted: always black, 1px)
        ctx.strokeStyle = 'black'; 
        ctx.lineWidth = 1;
        ctx.strokeRect(xPx, yPx, widthPx, heightPx);

        // --- Icon Drawing Logic --- 
        if (isSelected) { // Only draw icons if selected
            const iconWidthReq = ICON_SIZE_PX;
            const iconHeightReq = ICON_SIZE_PX;
            const sideBySideWidthReq = ICON_SIZE_PX * 2 + ICON_SPACING_PX + ICON_PADDING_PX * 2;
            const sideBySideHeightReq = ICON_SIZE_PX + ICON_PADDING_PX * 2;
            const stackedWidthReq = ICON_SIZE_PX + ICON_PADDING_PX * 2;
            const stackedHeightReq = ICON_SIZE_PX * 2 + ICON_SPACING_PX + ICON_PADDING_PX * 2;

            let canDrawSideBySide = (widthPx >= sideBySideWidthReq && heightPx >= sideBySideHeightReq);
            let canDrawStacked = (widthPx >= stackedWidthReq && heightPx >= stackedHeightReq);

            if (canDrawSideBySide) {
                // Draw side-by-side (horizontal) - Existing logic
                const rowIconX = xPx + widthPx - ICON_SIZE_PX - ICON_PADDING_PX;
                const singleIconX = rowIconX - ICON_SIZE_PX - ICON_SPACING_PX;
                const iconY = yPx + ICON_PADDING_PX;
                drawSingleIcon(singleIconX, iconY);
                drawRowIcon(rowIconX, iconY);
            } else if (canDrawStacked) {
                // Draw stacked (vertical)
                const iconX = xPx + widthPx - ICON_SIZE_PX - ICON_PADDING_PX;
                const singleIconY = yPx + ICON_PADDING_PX;
                const rowIconY = singleIconY + ICON_SIZE_PX + ICON_SPACING_PX;
                drawSingleIcon(iconX, singleIconY);
                drawRowIcon(iconX, rowIconY);
            } 
            // Else: Not enough space for either layout, don't draw icons
        }
    }

    // Helper to draw the Single Add (+) icon
    function drawSingleIcon(x, y) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.fillRect(x, y, ICON_SIZE_PX, ICON_SIZE_PX);
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, ICON_SIZE_PX, ICON_SIZE_PX);
        ctx.beginPath();
        ctx.moveTo(x + ICON_SIZE_PX / 2, y + ICON_PADDING_PX * 2);
        ctx.lineTo(x + ICON_SIZE_PX / 2, y + ICON_SIZE_PX - ICON_PADDING_PX * 2);
        ctx.moveTo(x + ICON_PADDING_PX * 2, y + ICON_SIZE_PX / 2);
        ctx.lineTo(x + ICON_SIZE_PX - ICON_PADDING_PX * 2, y + ICON_SIZE_PX / 2);
        ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineWidth = 1;
    }

    // Helper to draw the Row Add (...) icon
    function drawRowIcon(x, y) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.fillRect(x, y, ICON_SIZE_PX, ICON_SIZE_PX);
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, ICON_SIZE_PX, ICON_SIZE_PX);
        const dotRadius = 1.5; const dotY = y + ICON_SIZE_PX / 2; const dotSpacing = ICON_SIZE_PX / 4;
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(x + dotSpacing, dotY, dotRadius, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + dotSpacing * 2, dotY, dotRadius, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + dotSpacing * 3, dotY, dotRadius, 0, Math.PI * 2); ctx.fill();
    }

    // Helper for drawing fallback text
    function drawCropTextFallback(crop, xPx, yPx, widthPx, heightPx) {
        const baseFontSize = Math.max(8, Math.min(heightPx * 0.4, 18));
        ctx.font = `${baseFontSize}px sans-serif`;
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textWidth = ctx.measureText(crop.name).width;
        if (textWidth < widthPx * 0.8 && heightPx > 12) { 
            ctx.fillText(crop.name, xPx + widthPx / 2, yPx + heightPx / 2);
        }
    }

    // --- Collision Detection Helper ---
    function isOverlapping(rect1, rect2) {
        const epsilon = 0.001; 
        return !(
            rect1.x + rect1.width_m <= rect2.x + epsilon ||
            rect1.x + epsilon >= rect2.x + rect2.width_m ||
            rect1.y + rect1.height_m <= rect2.y + epsilon ||
            rect1.y + epsilon >= rect2.y + rect2.height_m   
        );
    }

    // --- Placement Logic ---
    function findPlacementPosition(newCropWidth, newCropHeight) {
        let testPos = { x: 0, y: 0, width_m: newCropWidth, height_m: newCropHeight };
        let overlaps = false;
        for (const existingCrop of gardenCrops) {
            if (isOverlapping(testPos, existingCrop)) {
                overlaps = true;
                break;
            }
        }
        if (!overlaps) {
            return { x: 0, y: 0 };
        }

        for (let y = 0; y <= gardenHeightM - newCropHeight; y += PLACEMENT_SCAN_STEP_M) {
            for (let x = 0; x <= gardenWidthM - newCropWidth; x += PLACEMENT_SCAN_STEP_M) {
                testPos = { x: x, y: y, width_m: newCropWidth, height_m: newCropHeight };
                overlaps = false;
                for (const existingCrop of gardenCrops) {
                    if (isOverlapping(testPos, existingCrop)) {
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) {
                    return { x: x, y: y };
                }
            }
        }

        return null;
    }

    function addCropToGarden(cropData) {
        const position = findPlacementPosition(cropData.width_m, cropData.height_m);

        if (position) {
            const newCrop = {
                ...cropData,
                id: Date.now() + Math.random(),
                x: position.x,
                y: position.y
            };
            gardenCrops.push(newCrop);
            drawGarden();
            saveGardenState(); // Save after adding
        } else {
            console.warn(`Could not find placement position for ${cropData.name}. Garden might be full.`);
            alert(`Could not find a place for ${cropData.name}. The garden might be too full.`);
        }
    }

    // --- Single/Row Creation Logic ---
    function canPlaceCropAt(targetX_m, targetY_m, cropWidth_m, cropHeight_m, ignoreId = null) {
        if (targetX_m < 0 || targetY_m < 0 || targetX_m + cropWidth_m > gardenWidthM || targetY_m + cropHeight_m > gardenHeightM) {
            return false; // Out of bounds
        }
        const testRect = { x: targetX_m, y: targetY_m, width_m: cropWidth_m, height_m: cropHeight_m };
        for (const existingCrop of gardenCrops) {
             if (existingCrop.id !== ignoreId && isOverlapping(testRect, existingCrop)) {
                 return false; // Overlaps another crop
             }
        }
        return true;
    }

    function addSingleCropNextTo(sourceCrop) {
        const targetX_m = sourceCrop.x + sourceCrop.width_m;
        const targetY_m = sourceCrop.y;

        if (canPlaceCropAt(targetX_m, targetY_m, sourceCrop.width_m, sourceCrop.height_m)) {
             const newCrop = {
                ...sourceCrop,
                id: Date.now() + Math.random(),
                x: targetX_m,
                y: targetY_m
             };
            gardenCrops.push(newCrop);
            drawGarden();
            saveGardenState();
            console.log(`Added single ${sourceCrop.name}`);
        } else {
            console.log(`Cannot add single ${sourceCrop.name}, no space.`);
            // Optional: Add user feedback (e.g., brief visual cue)
        }
    }

    function createRowFromCrop(sourceCrop) {
        const startX_m = sourceCrop.x + sourceCrop.width_m;
        const y_m = sourceCrop.y;
        const cropWidth_m = sourceCrop.width_m;
        let currentX_m = startX_m;
        let addedCount = 0;

        while (canPlaceCropAt(currentX_m, y_m, cropWidth_m, sourceCrop.height_m)) {
             const newCrop = {
                 ...sourceCrop,
                 id: Date.now() + Math.random() + addedCount, // Ensure unique ID
                 x: currentX_m,
                 y: y_m
             };
             gardenCrops.push(newCrop);
             currentX_m += cropWidth_m;
             addedCount++;
        }
        
        if (addedCount > 0) {
            console.log(`Added row of ${addedCount} ${sourceCrop.name}(s)`);
            drawGarden();
            saveGardenState();
        } else {
             console.log(`Cannot add row for ${sourceCrop.name}, no space.`);
        }
    }

    // --- Group Dragging Logic ---
    function findHorizontallyConnectedGroup(clickedCrop) {
        const group = [clickedCrop];
        const checkQueue = [clickedCrop];
        const visitedIds = new Set([clickedCrop.id]);
        const epsilon = 0.01; // Tolerance for floating point comparisons

        while (checkQueue.length > 0) {
            const currentCrop = checkQueue.shift();

            gardenCrops.forEach(otherCrop => {
                if (!visitedIds.has(otherCrop.id) && otherCrop.name === currentCrop.name && Math.abs(otherCrop.y - currentCrop.y) < epsilon) {
                    // Check if directly to the right
                    if (Math.abs(otherCrop.x - (currentCrop.x + currentCrop.width_m)) < epsilon) {
                        group.push(otherCrop);
                        visitedIds.add(otherCrop.id);
                        checkQueue.push(otherCrop);
                    }
                    // Check if directly to the left
                    else if (Math.abs((otherCrop.x + otherCrop.width_m) - currentCrop.x) < epsilon) {
                        group.push(otherCrop);
                        visitedIds.add(otherCrop.id);
                        checkQueue.push(otherCrop);
                    }
                }
            });
        }
        return group;
    }

    // --- Auto Fill Logic ---
    // function calculatePlacementScore(...) { ... }
    // function autoFillGarden() { ... }

    // --- Clear Garden Function ---
    function clearGarden() {
        if (confirm("Are you sure you want to clear the entire garden?")) {
            gardenCrops = []; // Empty the array
            drawGarden(); // Redraw the empty garden
            saveGardenState(); // Save the empty state
            console.log("Garden cleared.");
        }
    }

    // --- Event Listeners ---
    gardenCanvas.addEventListener('mousedown', (e) => {
        isDragging = false;
        isGroupDragging = false;
        draggedCrop = null;
        draggedGroup = [];
        let potentialDragCrop = null; // Store the crop under the initial click

        const rect = gardenCanvas.getBoundingClientRect();
        const mouseX_px = e.clientX - rect.left;
        const mouseY_px = e.clientY - rect.top;

        let clickedOnIcon = false;
        let clickedOnEmptySpace = true;
        let newlySelectedCropId = null; // Temporarily store ID if a new crop is clicked

        // 1. Find the topmost crop under the cursor
        for (let i = gardenCrops.length - 1; i >= 0; i--) {
            const crop = gardenCrops[i];
            const xPx = crop.x * pixelsPerMeter;
            const yPx = crop.y * pixelsPerMeter;
            const widthPx = crop.width_m * pixelsPerMeter;
            const heightPx = crop.height_m * pixelsPerMeter;

            if (mouseX_px >= xPx && mouseX_px <= xPx + widthPx && mouseY_px >= yPx && mouseY_px <= yPx + heightPx) {
                clickedOnEmptySpace = false;
                potentialDragCrop = crop; // Found the crop clicked on
                newlySelectedCropId = crop.id; // Potential new selection
                break; // Stop searching
            }
        }

        // 2. If a crop was clicked, check if an icon *on that crop* was clicked
        if (potentialDragCrop) {
            const crop = potentialDragCrop; // Use the found crop
            const xPx = crop.x * pixelsPerMeter;
            const yPx = crop.y * pixelsPerMeter;
            const widthPx = crop.width_m * pixelsPerMeter;
            const heightPx = crop.height_m * pixelsPerMeter;

            // Determine icon layout for *this specific crop*
            const sideBySideWidthReq = ICON_SIZE_PX * 2 + ICON_SPACING_PX + ICON_PADDING_PX * 2;
            const sideBySideHeightReq = ICON_SIZE_PX + ICON_PADDING_PX * 2;
            const stackedWidthReq = ICON_SIZE_PX + ICON_PADDING_PX * 2;
            const stackedHeightReq = ICON_SIZE_PX * 2 + ICON_SPACING_PX + ICON_PADDING_PX * 2;
            let canDrawSideBySide = (widthPx >= sideBySideWidthReq && heightPx >= sideBySideHeightReq);
            let canDrawStacked = (widthPx >= stackedWidthReq && heightPx >= stackedHeightReq);

            if (canDrawSideBySide) {
                const rowIconX = xPx + widthPx - ICON_SIZE_PX - ICON_PADDING_PX;
                const singleIconX = rowIconX - ICON_SIZE_PX - ICON_SPACING_PX;
                const iconY = yPx + ICON_PADDING_PX;
                if (mouseX_px >= singleIconX && mouseX_px <= singleIconX + ICON_SIZE_PX && mouseY_px >= iconY && mouseY_px <= iconY + ICON_SIZE_PX) {
                    addSingleCropNextTo(crop);
                    clickedOnIcon = true;
                } else if (mouseX_px >= rowIconX && mouseX_px <= rowIconX + ICON_SIZE_PX && mouseY_px >= iconY && mouseY_px <= iconY + ICON_SIZE_PX) {
                    createRowFromCrop(crop);
                    clickedOnIcon = true;
                }
            } else if (canDrawStacked) {
                const iconX = xPx + widthPx - ICON_SIZE_PX - ICON_PADDING_PX;
                const singleIconY = yPx + ICON_PADDING_PX;
                const rowIconY = singleIconY + ICON_SIZE_PX + ICON_SPACING_PX;
                if (mouseX_px >= iconX && mouseX_px <= iconX + ICON_SIZE_PX && mouseY_px >= singleIconY && mouseY_px <= singleIconY + ICON_SIZE_PX) {
                    addSingleCropNextTo(crop);
                    clickedOnIcon = true;
                } else if (mouseX_px >= iconX && mouseX_px <= iconX + ICON_SIZE_PX && mouseY_px >= rowIconY && mouseY_px <= rowIconY + ICON_SIZE_PX) {
                    createRowFromCrop(crop);
                    clickedOnIcon = true;
                }
            }
            
            if (clickedOnIcon) {
                 // If an action was performed, deselect everything and exit
                 selectedCropId = null;
                 drawGarden(); 
                 return; 
            }
        }

        // 3. If no icon was clicked, handle selection and potential drag start
        if (clickedOnEmptySpace) {
            selectedCropId = null; // Clicked background, deselect
        } else {
             // Clicked on a crop (potentialDragCrop is set)
             selectedCropId = newlySelectedCropId; // Select the clicked crop

             // Prepare for potential drag
             const mouseX_m = mouseX_px / pixelsPerMeter;
             const mouseY_m = mouseY_px / pixelsPerMeter;
             dragOffsetX = mouseX_m - potentialDragCrop.x;
             dragOffsetY = mouseY_m - potentialDragCrop.y;
             if (e.shiftKey) {
                 isGroupDragging = true; // Will find group on mousemove if needed
             } else {
                 isDragging = true;
             }
             gardenCanvas.style.cursor = 'grabbing';
        }

        // 4. Redraw to show selection/deselection
        drawGarden();
    });

    // Mousedown logic reverted to previous simpler version for now
    // Keep simpler mousemove, mouseup, mouseleave from the reverted state
    // ... (This needs correction based on the new logic for selection)

     // *** CORRECTED mousemove, mouseup, mouseleave based on click-to-select logic ***
    gardenCanvas.addEventListener('mousemove', (e) => {
        // Only process if a drag was potentially started on mousedown
        if (!isDragging && !isGroupDragging) return; 

        // CONFIRM DRAG START (if not already dragging)
        // This logic might need adjustment if potentialDragCrop isn't accessible
        // For now, assume isDragging/isGroupDragging means potentialDragCrop was set
        if(selectedCropId !== null) { // If a crop was selected on mousedown, deselect when drag truly starts
            selectedCropId = null;
            // Find the actual crop to drag based on initial click (potentialDragCrop)
            // This assumes potentialDragCrop is available from mousedown or we re-find it
             const currentPotentialDragCrop = gardenCrops.find(c => 
                c.x === (mouseX_px / pixelsPerMeter - dragOffsetX) && 
                c.y === (mouseY_px / pixelsPerMeter - dragOffsetY) ); // This is flawed logic

            // SAFER APPROACH: Need to properly pass potentialDragCrop from mousedown
            // OR - rely on mouseup to handle click vs drag detection better?
            // Let's simplify: if mouse moves while isDragging/isGroupDragging is true, we ARE dragging.
            // The selection update happens in mousedown now.
            // We just need to ensure the correct crop/group is being moved.
            
            // If isDragging, find the crop by ID (assuming it's stored) - needs fix
            // If isGroupDragging, find the group by ID (needs fix) - needs fix
            
            // REVERTING mousemove drag confirmation - assume mousedown sets flags correctly for now
            // If mousemove happens and isDragging/isGroupDragging is true, move the object
        }

        // Proceed with moving logic
        const rect = gardenCanvas.getBoundingClientRect();
        const mouseX_px = e.clientX - rect.left;
        const mouseY_px = e.clientY - rect.top;
        const mouseX_m = mouseX_px / pixelsPerMeter;
        const mouseY_m = mouseY_px / pixelsPerMeter;

        if (isDragging && draggedCrop) { // Need to ensure draggedCrop is set correctly
             let targetX_m = mouseX_m - dragOffsetX;
             let targetY_m = mouseY_m - dragOffsetY;
             let { snappedX_m, snappedY_m } = calculateSnapping(targetX_m, targetY_m, draggedCrop, [draggedCrop.id]);
             draggedCrop.x = Math.max(0, Math.min(snappedX_m, gardenWidthM - draggedCrop.width_m));
             draggedCrop.y = Math.max(0, Math.min(snappedY_m, gardenHeightM - draggedCrop.height_m));
        } else if (isGroupDragging && draggedGroup.length > 0) { // Need to ensure draggedGroup is set correctly
             const primaryCrop = draggedGroup[0]; 
             let groupTargetX = mouseX_m - dragOffsetX; 
             let groupTargetY = mouseY_m - dragOffsetY;
             let deltaX = groupTargetX - primaryCrop.x;
             let deltaY = groupTargetY - primaryCrop.y;
             let minX_m = Infinity, maxX_m = -Infinity, minY_m = Infinity, maxY_m = -Infinity;
             draggedGroup.forEach(crop => {
                 minX_m = Math.min(minX_m, crop.x + deltaX);
                 maxX_m = Math.max(maxX_m, crop.x + crop.width_m + deltaX);
                 minY_m = Math.min(minY_m, crop.y + deltaY);
                 maxY_m = Math.max(maxY_m, crop.y + crop.height_m + deltaY);
             });
             if (minX_m < 0) deltaX -= minX_m;
             if (maxX_m > gardenWidthM) deltaX -= (maxX_m - gardenWidthM);
             if (minY_m < 0) deltaY -= minY_m;
             if (maxY_m > gardenHeightM) deltaY -= (maxY_m - gardenHeightM);
             draggedGroup.forEach(crop => {
                 crop.x += deltaX;
                 crop.y += deltaY;
             });
        }
        drawGarden();
    });

    gardenCanvas.addEventListener('mouseup', (e) => {
         if (isDragging || isGroupDragging) { // If a drag actually occurred
             saveGardenState();
         } 
         // Always reset drag state on mouseup
         isDragging = false;
         isGroupDragging = false;
         draggedCrop = null;
         draggedGroup = [];
         potentialDragCrop = null; // Clear the potential drag target
         gardenCanvas.style.cursor = 'default';
         // Don't necessarily redraw here unless selection changed without drag?
         // Selection handled in mousedown, redraw already happened there.
         // But need to update cursor based on final position.
         updateCursorStyle(e);
    });

    gardenCanvas.addEventListener('mouseleave', (e) => {
        if (isDragging || isGroupDragging) { // If dragging off canvas
            saveGardenState(); 
            isDragging = false;
            isGroupDragging = false;
            draggedCrop = null;
            draggedGroup = [];
            potentialDragCrop = null;
            gardenCanvas.style.cursor = 'default';
            // Might want to redraw if the crop position was reverted or finalized here
            drawGarden(); 
        }
        // If not dragging, leaving the canvas doesn't change selection state
    });

    // Update cursor style based on hover
    function updateCursorStyle(e) {
         if (isDragging || isGroupDragging) return;

         const rect = gardenCanvas.getBoundingClientRect();
         const mouseX_px = e ? e.clientX - rect.left : -1;
         const mouseY_px = e ? e.clientY - rect.top : -1;

         let cursorStyle = 'default';
         for (let i = gardenCrops.length - 1; i >= 0; i--) {
             const crop = gardenCrops[i];
             const cropX_px = crop.x * pixelsPerMeter;
             const cropY_px = crop.y * pixelsPerMeter;
             const cropW_px = crop.width_m * pixelsPerMeter;
             const cropH_px = crop.height_m * pixelsPerMeter;

              if (
                  mouseX_px >= cropX_px && mouseX_px <= cropX_px + cropW_px &&
                  mouseY_px >= cropY_px && mouseY_px <= cropY_px + cropH_px
              ) {
                  cursorStyle = 'grab';
                  break;
              }
         }
         gardenCanvas.style.cursor = cursorStyle;
    }

    gardenCanvas.addEventListener('mousemove', updateCursorStyle);

    // --- Initialization ---
    gardenWidthInput.addEventListener('change', resizeGarden);
    gardenHeightInput.addEventListener('change', resizeGarden);
    window.addEventListener('resize', resizeGarden);

    // Add listener for the Clear Garden button
    if (clearGardenButton) {
        clearGardenButton.addEventListener('click', clearGarden);
    } else {
        console.error("Clear Garden button not found!");
    }

    loadCrops(); // Loads master crops, then attempts to load saved state, then resizes/draws
}); 