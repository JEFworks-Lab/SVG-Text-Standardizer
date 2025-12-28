let originalSVG = null;
let originalSVGIsolated = null; // Isolated copy with unique IDs to prevent style conflicts
let modifiedSVG = null;
let textElements = [];
let sizeMappings = {}; // Maps detected sizes to standard sizes
let uniqueSizes = []; // Array of unique detected sizes

// DOM elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const controlsPanel = document.getElementById('controlsPanel');
const previewSection = document.getElementById('previewSection');
const originalPreview = document.getElementById('originalPreview');
const standardizedPreview = document.getElementById('standardizedPreview');
const applyBtn = document.getElementById('applyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const fontFamilySelect = document.getElementById('fontFamily');
const sizeInputsContainer = document.getElementById('sizeInputsContainer');
const addSizeBtn = document.getElementById('addSizeBtn');
const mappingContainer = document.getElementById('mappingContainer');

// Drag and drop handlers
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'image/svg+xml') {
        handleFile(file);
    } else {
        alert('Please drop a valid SVG file');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
});

// Handle file upload
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const svgContent = e.target.result;
        // Store the original SVG as a string - this will never be modified
        originalSVG = svgContent;
        // Create an isolated copy with unique identifiers to prevent style conflicts
        originalSVGIsolated = createIsolatedOriginalSVG();
        parseSVG(svgContent);
        // Display the original preview using the isolated copy
        displayOriginalPreview();
        document.getElementById('mainContent').style.display = 'grid';
    };
    reader.readAsText(file);
}

// Parse SVG and extract text elements
function parseSVG(svgContent) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
        alert('Error parsing SVG: ' + parserError.textContent);
        return;
    }
    
    textElements = [];
    const sizeSet = new Set();
    const texts = svgElement.querySelectorAll('text');
    
    texts.forEach((text, index) => {
        const element = {
            index: index,
            // Don't store references to DOM nodes - only store data
            fontSize: getFontSize(text, svgDoc),
            fontFamily: getFontFamily(text, svgDoc),
            transform: text.getAttribute('transform') || '',
            scaleX: getScaleX(text),
            scaleY: getScaleY(text),
            textContent: text.textContent || text.innerText || '',
            className: text.getAttribute('class') || ''
        };
        textElements.push(element);
        
        // Calculate effective size (accounting for scale)
        const effectiveSize = element.fontSize * Math.max(element.scaleX, element.scaleY);
        sizeSet.add(parseFloat(effectiveSize.toFixed(2)));
    });
    
    // Store unique sizes sorted
    uniqueSizes = Array.from(sizeSet).sort((a, b) => a - b);
    
    // Initialize mappings to closest standard sizes (will be updated when user sets standard sizes)
    sizeMappings = {};
    
    updateMappingUI();
}

// Get font size from element (check style, class, or inline)
function getFontSize(textElement, svgDoc) {
    // Check inline style
    const style = textElement.getAttribute('style');
    if (style) {
        const fontSizeMatch = style.match(/font-size:\s*([\d.]+)px/);
        if (fontSizeMatch) {
            return parseFloat(fontSizeMatch[1]);
        }
    }
    
    // Check class
    const className = textElement.getAttribute('class');
    if (className) {
        const styleSheet = svgDoc.querySelector('style');
        if (styleSheet) {
            const styleText = styleSheet.textContent || styleSheet.innerHTML;
            const classRegex = new RegExp(`\\.${className}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`, 'i');
            const match = styleText.match(classRegex);
            if (match) {
                return parseFloat(match[1]);
            }
        }
    }
    
    // Default
    return 12;
}

// Get font family from element
function getFontFamily(textElement, svgDoc) {
    // Check inline style
    const style = textElement.getAttribute('style');
    if (style) {
        const fontFamilyMatch = style.match(/font-family:\s*([^;]+)/);
        if (fontFamilyMatch) {
            return fontFamilyMatch[1].trim().replace(/['"]/g, '');
        }
    }
    
    // Check class
    const className = textElement.getAttribute('class');
    if (className) {
        const styleSheet = svgDoc.querySelector('style');
        if (styleSheet) {
            const styleText = styleSheet.textContent || styleSheet.innerHTML;
            const classRegex = new RegExp(`\\.${className}[^}]*font-family:\\s*([^;]+)`, 'i');
            const match = styleText.match(classRegex);
            if (match) {
                return match[1].trim().replace(/['"]/g, '').split(',')[0].trim();
            }
        }
    }
    
    // Default
    return 'Arial';
}

// Get scale X from transform
function getScaleX(textElement) {
    const transform = textElement.getAttribute('transform') || '';
    const scaleMatch = transform.match(/scale\(([\d.]+)\s+[\d.]+\)/);
    if (scaleMatch) {
        return parseFloat(scaleMatch[1]);
    }
    const singleScaleMatch = transform.match(/scale\(([\d.]+)\)/);
    if (singleScaleMatch) {
        return parseFloat(singleScaleMatch[1]);
    }
    return 1;
}

// Get scale Y from transform
function getScaleY(textElement) {
    const transform = textElement.getAttribute('transform') || '';
    const scaleMatch = transform.match(/scale\([\d.]+\s+([\d.]+)\)/);
    if (scaleMatch) {
        return parseFloat(scaleMatch[1]);
    }
    const singleScaleMatch = transform.match(/scale\(([\d.]+)\)/);
    if (singleScaleMatch) {
        return parseFloat(singleScaleMatch[1]);
    }
    return 1;
}

// Get text elements for a specific effective size
function getTextElementsForSize(effectiveSize) {
    const roundedSize = parseFloat(effectiveSize.toFixed(2));
    return textElements.filter(element => {
        const elementEffectiveSize = element.fontSize * Math.max(element.scaleX, element.scaleY);
        return parseFloat(elementEffectiveSize.toFixed(2)) === roundedSize;
    });
}

// Create an isolated copy of the original SVG with unique identifiers
function createIsolatedOriginalSVG() {
    if (!originalSVG) return null;
    
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(originalSVG, 'image/svg+xml');
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
        return originalSVG; // Fallback to original if parsing fails
    }
    
    const svgElement = svgDoc.documentElement;
    const uniqueId = 'original-svg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Add unique ID to the SVG element
    svgElement.setAttribute('id', uniqueId);
    
    // First, collect all class names used in the SVG
    const classNames = new Set();
    const allElements = svgElement.querySelectorAll('*');
    allElements.forEach(el => {
        const className = el.getAttribute('class');
        if (className) {
            // Handle multiple classes
            className.split(/\s+/).forEach(cls => {
                if (cls) classNames.add(cls);
            });
        }
    });
    
    // Make all class names unique to prevent style conflicts
    const styleSheet = svgDoc.querySelector('style');
    if (styleSheet) {
        let styleText = styleSheet.textContent || styleSheet.innerHTML;
        // Replace all class selectors with unique prefixed versions
        classNames.forEach(className => {
            const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Replace class selector in CSS
            const regex = new RegExp(`\\.${escapedClassName}(?![\\w-])`, 'g');
            styleText = styleText.replace(regex, `.${uniqueId}-${className}`);
        });
        styleSheet.textContent = styleText;
    }
    
    // Update all class attributes to use the unique prefix
    allElements.forEach(el => {
        const className = el.getAttribute('class');
        if (className) {
            // Replace each class with the unique prefixed version
            const newClasses = className.split(/\s+/).map(cls => {
                return cls ? `${uniqueId}-${cls}` : cls;
            }).join(' ');
            el.setAttribute('class', newClasses);
        }
    });
    
    // Serialize the isolated SVG
    return new XMLSerializer().serializeToString(svgDoc);
}

// Display original preview - use the isolated copy to prevent style conflicts
function displayOriginalPreview() {
    if (originalSVGIsolated) {
        // Clear the container completely
        originalPreview.innerHTML = '';
        // Use the isolated copy which has unique identifiers
        originalPreview.innerHTML = originalSVGIsolated;
    } else if (originalSVG) {
        // Create isolated copy if not already created
        originalSVGIsolated = createIsolatedOriginalSVG();
        originalPreview.innerHTML = originalSVGIsolated || originalSVG;
    }
}

// Get all standard sizes from inputs
function getStandardSizes() {
    const inputs = sizeInputsContainer.querySelectorAll('.size-input');
    const sizes = Array.from(inputs)
        .map(input => parseFloat(input.value))
        .filter(size => !isNaN(size) && size > 0);
    return sizes.sort((a, b) => a - b);
}

// Add a new size input
function addSizeInput(value = '') {
    const row = document.createElement('div');
    row.className = 'size-input-row';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'size-input';
    input.placeholder = 'Size';
    input.min = '1';
    if (value) input.value = value;
    // Event listener will be handled by delegated listener on container
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-size';
    removeBtn.title = 'Remove size';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        // Prevent removing the last size input
        const existingInputs = sizeInputsContainer.querySelectorAll('.size-input-row');
        if (existingInputs.length > 1) {
            row.remove();
            updateMappingUI();
        } else {
            alert('You must have at least one standard size');
        }
    });
    
    row.appendChild(input);
    row.appendChild(removeBtn);
    sizeInputsContainer.appendChild(row);
}

// Initialize add/remove size functionality
addSizeBtn.addEventListener('click', () => {
    addSizeInput();
});

// Initialize remove buttons for existing size inputs
function initializeRemoveButtons() {
    const removeButtons = sizeInputsContainer.querySelectorAll('.btn-remove-size');
    removeButtons.forEach(btn => {
        // Remove any existing listeners and add new one
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const row = newBtn.closest('.size-input-row');
            const existingInputs = sizeInputsContainer.querySelectorAll('.size-input-row');
            if (existingInputs.length > 1) {
                row.remove();
                updateMappingUI();
            } else {
                alert('You must have at least one standard size');
            }
        });
    });
}

// Initialize on page load
initializeRemoveButtons();

// Update mapping UI when standard sizes change (delegated event listener)
sizeInputsContainer.addEventListener('input', (e) => {
    if (e.target.classList.contains('size-input')) {
        updateMappingUI();
    }
});

// Update mapping UI
function updateMappingUI() {
    const standardSizes = getStandardSizes();
    
    if (uniqueSizes.length === 0) {
        mappingContainer.innerHTML = '<p class="mapping-instructions">Load an SVG file to see size mappings</p>';
        return;
    }
    
    // Initialize mappings if not set
    uniqueSizes.forEach(size => {
        if (!sizeMappings[size]) {
            sizeMappings[size] = findClosestSize(size, standardSizes);
        }
    });
    
    mappingContainer.innerHTML = '<p class="mapping-instructions">Map each detected size to one of the standard sizes above</p>';
    
    uniqueSizes.forEach(size => {
        const mappingRow = document.createElement('div');
        mappingRow.className = 'mapping-row';
        
        // Get all text elements with this effective size
        const textElementsForSize = getTextElementsForSize(size);
        
        // Create info section showing text details
        const infoSection = document.createElement('div');
        infoSection.className = 'mapping-info-section';
        
        const sizeLabel = document.createElement('div');
        sizeLabel.className = 'mapping-size-label';
        sizeLabel.textContent = `${size.toFixed(2)}px →`;
        
        const textDetails = document.createElement('div');
        textDetails.className = 'mapping-text-details';
        
        if (textElementsForSize.length > 0) {
            const detailsList = document.createElement('div');
            detailsList.className = 'text-details-list';
            
            textElementsForSize.forEach((element, idx) => {
                const detailItem = document.createElement('div');
                detailItem.className = 'text-detail-item';
                const hasStretching = element.scaleX !== 1 || element.scaleY !== 1;
                const textPreview = element.textContent.length > 40 
                    ? element.textContent.substring(0, 40) + '...' 
                    : element.textContent;
                detailItem.innerHTML = `
                    <span class="text-preview">"${textPreview}"</span>
                    <span class="text-props">
                        ${element.fontSize.toFixed(2)}px | ${element.fontFamily}
                        ${hasStretching ? ` | Scale: ${element.scaleX.toFixed(2)}x, ${element.scaleY.toFixed(2)}y` : ''}
                    </span>
                `;
                detailsList.appendChild(detailItem);
            });
            
            textDetails.appendChild(detailsList);
        }
        
        const selectContainer = document.createElement('div');
        selectContainer.className = 'mapping-select-container';
        
        const select = document.createElement('select');
        select.className = 'size-mapping-select';
        select.dataset.originalSize = size;
        
        standardSizes.forEach(standardSize => {
            const option = document.createElement('option');
            option.value = standardSize;
            option.textContent = `${standardSize}px`;
            if (sizeMappings[size] === standardSize) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            const originalSize = parseFloat(e.target.dataset.originalSize);
            const mappedSize = parseFloat(e.target.value);
            sizeMappings[originalSize] = mappedSize;
        });
        
        selectContainer.appendChild(select);
        
        // Assemble the row
        const leftSection = document.createElement('div');
        leftSection.className = 'mapping-left';
        leftSection.appendChild(sizeLabel);
        leftSection.appendChild(textDetails);
        
        const rightSection = document.createElement('div');
        rightSection.className = 'mapping-right';
        rightSection.appendChild(selectContainer);
        
        mappingRow.appendChild(leftSection);
        mappingRow.appendChild(rightSection);
        mappingContainer.appendChild(mappingRow);
    });
}

// Apply standardization
applyBtn.addEventListener('click', () => {
    const fontFamily = fontFamilySelect.value;
    const standardSizes = getStandardSizes();
    
    if (standardSizes.length === 0) {
        alert('Please add at least one standard size');
        return;
    }
    
    // Ensure all mappings are set
    uniqueSizes.forEach(size => {
        if (!sizeMappings[size]) {
            sizeMappings[size] = findClosestSize(size, standardSizes);
        }
    });
    
    // Create a fresh copy of the SVG from the original string
    // This ensures we never modify the original
    // Use a completely separate parser instance to avoid any cross-contamination
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(originalSVG, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
        alert('Error parsing SVG: ' + parserError.textContent);
        return;
    }
    
    // Add a unique ID to the modified SVG to ensure styles don't leak
    const modifiedId = 'modified-svg-' + Date.now();
    svgElement.setAttribute('id', modifiedId);
    
    // Get all text elements from the fresh copy
    const texts = svgElement.querySelectorAll('text');
    
    texts.forEach((text, index) => {
        const element = textElements[index];
        if (!element) return;
        
        // Get effective size and use manual mapping
        const originalSize = element.fontSize;
        const effectiveSize = originalSize * Math.max(element.scaleX, element.scaleY);
        const roundedSize = parseFloat(effectiveSize.toFixed(2));
        // Use manual mapping if available, otherwise find closest
        const mappedSize = sizeMappings[roundedSize] || findClosestSize(effectiveSize, standardSizes);
        
        // Remove transform scaling (keep translation and other transforms)
        let transform = element.transform || '';
        // Remove scale from transform, keep translate and other transforms
        transform = transform.replace(/scale\([^)]+\)/g, '').trim();
        // Clean up extra spaces and commas
        transform = transform.replace(/,\s+/g, ' ').replace(/\s+/g, ' ').trim();
        // Remove trailing commas or spaces
        transform = transform.replace(/[,\s]+$/, '');
        
        // Set new font size and family
        const style = text.getAttribute('style') || '';
        let newStyle = style;
        
        // Remove old font-size and font-family from style
        newStyle = newStyle.replace(/font-size:\s*[^;]+;?/gi, '');
        newStyle = newStyle.replace(/font-family:\s*[^;]+;?/gi, '');
        newStyle = newStyle.trim();
        
        // Add new font properties
        const fontProps = `font-size: ${mappedSize}px; font-family: ${fontFamily};`;
        newStyle = newStyle ? `${newStyle}; ${fontProps}` : fontProps;
        
        text.setAttribute('style', newStyle);
        
        // Update transform (only if there's something left after removing scale)
        if (transform && transform.length > 0) {
            text.setAttribute('transform', transform);
        } else {
            text.removeAttribute('transform');
        }
        
        // Update class-based styles if they exist
        const className = element.className || text.getAttribute('class');
        if (className) {
            const styleSheet = svgDoc.querySelector('style');
            if (styleSheet) {
                // Get a fresh copy of the style text to avoid any reference issues
                let styleText = styleSheet.textContent || styleSheet.innerHTML;
                // Update font-size in class
                styleText = styleText.replace(
                    new RegExp(`(\\.${className}[^}]*font-size:\\s*)[\\d.]+px`, 'gi'),
                    `$1${mappedSize}px`
                );
                // Update font-family in class
                styleText = styleText.replace(
                    new RegExp(`(\\.${className}[^}]*font-family:\\s*)[^;]+`, 'gi'),
                    `$1${fontFamily}`
                );
                // Set the modified style text
                styleSheet.textContent = styleText;
            }
        }
    });
    
    // Convert back to string
    modifiedSVG = new XMLSerializer().serializeToString(svgDoc);
    
    // Display standardized preview
    standardizedPreview.innerHTML = modifiedSVG;
    
    // CRITICAL: Always refresh the original preview from the stored string
    // This ensures it's never affected by any modifications
    // Use the function to ensure proper isolation
    displayOriginalPreview();
    
    downloadBtn.style.display = 'inline-block';
});

// Find closest standard size
function findClosestSize(size, standardSizes) {
    return standardSizes.reduce((prev, curr) => {
        return Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev;
    });
}


// Download modified SVG
downloadBtn.addEventListener('click', () => {
    if (!modifiedSVG) return;
    
    const blob = new Blob([modifiedSVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'standardized.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Reset
resetBtn.addEventListener('click', () => {
    if (originalSVG) {
        // Keep original preview unchanged, just clear standardized preview
        standardizedPreview.innerHTML = '';
        downloadBtn.style.display = 'none';
        modifiedSVG = null;
        // Reset mappings to auto-closest
        if (uniqueSizes.length > 0) {
            const standardSizes = getStandardSizes();
            if (standardSizes.length > 0) {
                uniqueSizes.forEach(size => {
                    sizeMappings[size] = findClosestSize(size, standardSizes);
                });
                updateMappingUI();
            }
        }
    }
});

