// Create a new style element in the DOM to inject CSS rules for the relationship map nodes
const rmapStyles = document.createElement('style');
rmapStyles.innerHTML = `
.rmap-node {
    position: absolute;
    transform: translate(-50%, -50%);
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.5);
    cursor: grab;
    user-select: none;
    z-index: 10;
    pointer-events: auto;
}
.rmap-node:active { cursor: grabbing; }
.rmap-delete {
    position: absolute; top: -8px; right: -8px;
    background: #ef4444; color: white; border-radius: 50%;
    width: 20px; height: 20px; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; opacity: 0; transition: opacity 0.2s;
}
.rmap-connect {
    position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
    background: #3b82f6; color: white; border-radius: 50%;
    width: 20px; height: 20px; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; opacity: 0; transition: opacity 0.2s;
}
.rmap-node:hover .rmap-delete, .rmap-node:hover .rmap-connect, .rmap-node:hover .rmap-color { opacity: 1; }
`;
// Append the dynamically created style element to the document head
document.head.appendChild(rmapStyles);

// Relationship Map Logic
window.rmapState = { nodes: {}, edges: [] };

let rmapPanX = 0;
let rmapPanY = 0;
let rmapZoom = 1;
let rmapPanning = false;
let rmapDragThrottle = null;

let rmapDraggingNode = null;
let rmapConnectingFrom = null;

function toggleRelationshipMap() {
    toggleWidget('widget-relationship-map');
}

function initRelationshipMap() {
    // Query the DOM for the relationship map canvas container element by its ID
    const canvasContainerElement = document.getElementById('rmapCanvas');
    if (!canvasContainerElement) return;
    
    // Add background click to deselect/add node
    canvasContainerElement.ondblclick = (mouseEvent) => {
        if (mouseEvent.target === canvasContainerElement || mouseEvent.target.tagName === 'svg' || mouseEvent.target.id === 'rmapPanWrapper') {
            // Measure the screen bounding rectangle of the relationship map canvas container
            const containerBoundingRect = canvasContainerElement.getBoundingClientRect();
            const nodePositionX = ((mouseEvent.clientX - containerBoundingRect.left) - rmapPanX) / rmapZoom;
            const nodePositionY = ((mouseEvent.clientY - containerBoundingRect.top) - rmapPanY) / rmapZoom;
            const newNodeId = 'node_' + Date.now();
            window.rmapState.nodes[newNodeId] = { id: newNodeId, x: nodePositionX, y: nodePositionY, text: 'New Node' };
            renderRmap();
            saveRmapState();
        }
    };
    
    

    canvasContainerElement.onwheel = (wheelEvent) => {
        if (wheelEvent.target === canvasContainerElement || wheelEvent.target.tagName === 'svg' || wheelEvent.target.id === 'rmapPanWrapper') {
            wheelEvent.preventDefault();
            const zoomDelta = wheelEvent.deltaY > 0 ? 0.9 : 1.1;
            
            // Zoom toward mouse cursor
            // Measure the screen bounding rectangle of the relationship map canvas container
            const containerBoundingRect = canvasContainerElement.getBoundingClientRect();
            const mouseX = wheelEvent.clientX - containerBoundingRect.left;
            const mouseY = wheelEvent.clientY - containerBoundingRect.top;
            
            const worldX = (mouseX - rmapPanX) / rmapZoom;
            const worldY = (mouseY - rmapPanY) / rmapZoom;
            
            rmapZoom *= zoomDelta;
            if (rmapZoom < 0.2) rmapZoom = 0.2;
            if (rmapZoom > 4) rmapZoom = 4;
            
            rmapPanX = mouseX - (worldX * rmapZoom);
            rmapPanY = mouseY - (worldY * rmapZoom);
            
            renderRmap();
        }
    };

    canvasContainerElement.onmousedown = (mouseEvent) => {
        if (mouseEvent.target === canvasContainerElement || mouseEvent.target.tagName === 'svg' || mouseEvent.target.id === 'rmapPanWrapper') {
            rmapPanning = true;
        }
    };

    canvasContainerElement.onmousemove = (mouseEvent) => {
        if (rmapPanning) {
            rmapPanX += mouseEvent.movementX;
            rmapPanY += mouseEvent.movementY;
            renderRmap();
        } else if (rmapDraggingNode) {
            // Measure the screen bounding rectangle of the relationship map canvas container
            const containerBoundingRect = canvasContainerElement.getBoundingClientRect();
            window.rmapState.nodes[rmapDraggingNode].x = ((mouseEvent.clientX - containerBoundingRect.left) - rmapPanX) / rmapZoom;
            window.rmapState.nodes[rmapDraggingNode].y = ((mouseEvent.clientY - containerBoundingRect.top) - rmapPanY) / rmapZoom;
            renderRmap();
            if (!rmapDragThrottle) {
                // Schedule a throttled timer to persist the relationship map state at up to 20fps
                rmapDragThrottle = setTimeout(() => {
                    saveRmapState();
                    rmapDragThrottle = null;
                }, 50); // 20fps sync
            }
        }
        if (rmapConnectingFrom) {
            // Draw temporary line
            // Measure the screen bounding rectangle of the relationship map canvas container
            const containerBoundingRect = canvasContainerElement.getBoundingClientRect();
            renderRmap(((mouseEvent.clientX - containerBoundingRect.left) - rmapPanX) / rmapZoom, ((mouseEvent.clientY - containerBoundingRect.top) - rmapPanY) / rmapZoom);
        }
    };
    
    canvasContainerElement.onmouseup = (mouseEvent) => {
        if (rmapPanning) {
            rmapPanning = false;
        }
        if (rmapDraggingNode) {
            rmapDraggingNode = null;
            saveRmapState();
        }
        if (rmapConnectingFrom) {
            rmapConnectingFrom = null;
            renderRmap();
        }
        // Also handle leaving container
        canvasContainerElement.onmouseleave = (leaveEvent) => {
            rmapPanning = false;
            if (rmapDraggingNode) { rmapDraggingNode = null; saveRmapState(); }
            if (rmapConnectingFrom) { rmapConnectingFrom = null; renderRmap(); }
        };
    };
}

function renderRmap(temporaryTargetX = null, temporaryTargetY = null) {
    // Query the DOM for the relationship map nodes container element by its ID
    const nodesContainerElement = document.getElementById('rmapNodes');
    // Query the DOM for the relationship map SVG edge layer element by its ID
    const svgCanvasElement = document.getElementById('rmapSvg');
    // Query the DOM for the pan/zoom wrapper element by its ID
    const panWrapperElement = document.getElementById('rmapPanWrapper');
    if (!nodesContainerElement || !svgCanvasElement) return;
    if (panWrapperElement) {
        panWrapperElement.style.transform = `translate(${rmapPanX}px, ${rmapPanY}px) scale(${rmapZoom})`;
    }
    
    // Render Nodes without destroying inputs if they exist
    const currentIds = Object.keys(window.rmapState.nodes);
    // Remove deleted nodes
    Array.from(nodesContainerElement.children).forEach(childNodeElement => {
        if (!currentIds.includes(childNodeElement.dataset.id)) {
            childNodeElement.remove();
        }
    });
    
    // Add or update nodes
    currentIds.forEach(nodeId => {
        const nodeObject = window.rmapState.nodes[nodeId];
        // Query the nodes container for an existing DOM element matching this node ID
        let nodeDivElement = nodesContainerElement.querySelector(`[data-id="${nodeId}"]`);
        if (!nodeDivElement) {
            // Create a new div element in the DOM to represent the relationship map node
            nodeDivElement = document.createElement('div');
            nodeDivElement.className = 'rmap-node';
            nodeDivElement.dataset.id = nodeId;
            nodeDivElement.innerHTML = `<textarea class="rmap-input" onkeyup="updateRmapNode('${nodeObject.id}', this.value)" onchange="updateRmapNode('${nodeObject.id}', this.value)" style="background:transparent; color:#fff; border:none; text-align:center; width:${nodeObject.w || 100}px; height:${nodeObject.h || 20}px; font-size:12px; outline:none; pointer-events:auto; user-select:text; resize:both; overflow:hidden;" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" onmouseup="updateRmapNodeSize('${nodeObject.id}', this.style.width, this.style.height)">${escapeHtml(nodeObject.text)}</textarea>
            <div class="rmap-delete" onclick="deleteRmapNode('${nodeObject.id}'); event.stopPropagation()"><i class="fa-solid fa-xmark"></i></div>
            <div class="rmap-color" onclick="cycleRmapNodeColor('${nodeObject.id}'); event.stopPropagation()" style="position:absolute; top:-8px; left:-8px; background:#f59e0b; color:white; border-radius:50%; width:20px; height:20px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.2s;"><i class="fa-solid fa-palette"></i></div>
            <div class="rmap-connect" onmousedown="startRmapConnect('${nodeObject.id}', event)"><i class="fa-solid fa-link"></i></div>`;
            
            nodeDivElement.onmousedown = (mouseEvent) => {
                if (mouseEvent.target.tagName !== 'TEXTAREA' && !mouseEvent.target.closest('.rmap-connect') && !mouseEvent.target.closest('.rmap-delete')) {
                    rmapDraggingNode = nodeObject.id;
                }
            };
            
            nodeDivElement.onmouseup = (mouseEvent) => {
                if (rmapConnectingFrom && rmapConnectingFrom !== nodeObject.id) {
                    const existingEdgeObject = window.rmapState.edges.find(edgeObject => 
                        (edgeObject.source === rmapConnectingFrom && edgeObject.target === nodeObject.id) ||
                        (edgeObject.source === nodeObject.id && edgeObject.target === rmapConnectingFrom)
                    );
                    if (existingEdgeObject) {
                        existingEdgeObject.type = 'two-way';
                    } else {
                        window.rmapState.edges.push({ source: rmapConnectingFrom, target: nodeObject.id, type: 'one-way' });
                    }
                    rmapConnectingFrom = null;
                    saveRmapState();
                }
            };
            nodesContainerElement.appendChild(nodeDivElement);
        }
        // Update positions
        nodeDivElement.style.left = nodeObject.x + 'px';
        nodeDivElement.style.top = nodeObject.y + 'px';
        nodeDivElement.style.background = nodeObject.color || '#1f2937';
        if (nodeObject.color === 'transparent') {
            nodeDivElement.style.border = '1px dashed #6b7280';
        } else {
            nodeDivElement.style.border = '2px solid #374151';
        }
        // Only update text if it's not focused to avoid cursor jumping
        // Query the node element for its inner textarea input
        const textareaInputElement = nodeDivElement.querySelector('textarea');
        if (textareaInputElement && document.activeElement !== textareaInputElement) {
            textareaInputElement.value = nodeObject.text;
            if(nodeObject.w) textareaInputElement.style.width = nodeObject.w + 'px';
            if(nodeObject.h) textareaInputElement.style.height = nodeObject.h + 'px';
        }
    });
    
    // Render Edges (edges can be wiped, they don't have state)
    svgCanvasElement.innerHTML = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" /></marker><marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse"><polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" /></marker></defs>';
    window.rmapState.edges.forEach((edgeObject, edgeIndex) => {
        const sourceNodeObject = window.rmapState.nodes[edgeObject.source];
        const targetNodeObject = window.rmapState.nodes[edgeObject.target];
        if (!sourceNodeObject || !targetNodeObject) return;
        
        // Create an SVG path element in the SVG namespace to draw the bezier curve between nodes
        const svgPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const horizontalControlOffset = (targetNodeObject.x - sourceNodeObject.x) * 0.4;
        const svgPathDataString = `M ${sourceNodeObject.x} ${sourceNodeObject.y} C ${sourceNodeObject.x + horizontalControlOffset} ${sourceNodeObject.y}, ${targetNodeObject.x - horizontalControlOffset} ${targetNodeObject.y}, ${targetNodeObject.x} ${targetNodeObject.y}`;
        svgPathElement.setAttribute('d', svgPathDataString);
        svgPathElement.setAttribute('stroke', '#ef4444');
        svgPathElement.setAttribute('stroke-width', '2.5');
        svgPathElement.setAttribute('fill', 'none');
        
        if (edgeObject.type === 'one-way') {
            svgPathElement.setAttribute('marker-end', 'url(#arrowhead)');
        } else if (edgeObject.type === 'two-way') {
            svgPathElement.setAttribute('marker-start', 'url(#arrowhead-start)');
            svgPathElement.setAttribute('marker-end', 'url(#arrowhead)');
        }
        
        svgPathElement.style.cursor = 'pointer';
        svgPathElement.style.pointerEvents = 'stroke';
        svgPathElement.ondblclick = () => {
            window.rmapState.edges.splice(edgeIndex, 1);
            saveRmapState();
            renderRmap();
        };
        svgCanvasElement.appendChild(svgPathElement);
        
        // Render text on line
        const midpointX = (sourceNodeObject.x + targetNodeObject.x) / 2;
        const midpointY = (sourceNodeObject.y + targetNodeObject.y) / 2;
        
        // Query the nodes container for an existing edge label div matching this edge index
        let edgeLabelDivElement = nodesContainerElement.querySelector(`[data-edge-idx="${edgeIndex}"]`);
        if (!edgeLabelDivElement) {
            // Create a new div element in the DOM to hold the editable label on the relationship edge
            edgeLabelDivElement = document.createElement('div');
            edgeLabelDivElement.dataset.edgeIdx = edgeIndex;
            edgeLabelDivElement.style.position = 'absolute';
            edgeLabelDivElement.style.transform = 'translate(-50%, -50%)';
            edgeLabelDivElement.style.pointerEvents = 'auto';
            edgeLabelDivElement.style.zIndex = '5';
            edgeLabelDivElement.innerHTML = `<textarea onkeyup="updateRmapEdgeText(${edgeIndex}, this.value)" onchange="updateRmapEdgeText(${edgeIndex}, this.value)" placeholder="..." style="background:rgba(0,0,0,0.7); border-radius:4px; color:#ffffff; border:none; text-align:center; min-width:120px; min-height:40px; font-size:11px; outline:none; padding:4px; resize:both; overflow:hidden;" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">${escapeHtml(edgeObject.text || '')}</textarea>`;
            nodesContainerElement.appendChild(edgeLabelDivElement);
        }
        edgeLabelDivElement.style.left = midpointX + 'px';
        edgeLabelDivElement.style.top = midpointY + 'px';
        // Query the edge label element for its inner textarea input
        const textareaInputElement = edgeLabelDivElement.querySelector('textarea');
        if (textareaInputElement && document.activeElement !== textareaInputElement) {
            textareaInputElement.value = edgeObject.text || '';
        }
    });
    
    // Cleanup old edge divs
    Array.from(nodesContainerElement.children).forEach(childNodeElement => {
        if (childNodeElement.dataset.edgeIdx !== undefined && childNodeElement.dataset.edgeIdx >= window.rmapState.edges.length) {
            childNodeElement.remove();
        }
    });
    
    if (rmapConnectingFrom && temporaryTargetX !== null && temporaryTargetY !== null) {
        const sourceNodeObject = window.rmapState.nodes[rmapConnectingFrom];
        // Create an SVG path element in the SVG namespace for the temporary connection line while dragging
        const svgPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const horizontalControlOffset = (temporaryTargetX - sourceNodeObject.x) * 0.4;
        const svgPathDataString = `M ${sourceNodeObject.x} ${sourceNodeObject.y} C ${sourceNodeObject.x + horizontalControlOffset} ${sourceNodeObject.y}, ${temporaryTargetX - horizontalControlOffset} ${temporaryTargetY}, ${temporaryTargetX} ${temporaryTargetY}`;
        svgPathElement.setAttribute('d', svgPathDataString);
        svgPathElement.setAttribute('stroke', '#cbd5e1');
        svgPathElement.setAttribute('stroke-width', '2');
        svgPathElement.setAttribute('stroke-dasharray', '4 4');
        svgPathElement.setAttribute('fill', 'none');
        svgCanvasElement.appendChild(svgPathElement);
    }
}

function cycleRmapNodeColor(nodeId) {
    const availableColors = ['#1f2937', '#7f1d1d', '#14532d', '#1e3a8a', '#581c87', '#78350f', 'transparent'];
    const nodeObject = window.rmapState.nodes[nodeId];
    if (nodeObject) {
        let colorIndex = availableColors.indexOf(nodeObject.color || '#1f2937');
        colorIndex = (colorIndex + 1) % availableColors.length;
        nodeObject.color = availableColors[colorIndex];
        saveRmapState();
        renderRmap();
    }
}

function updateRmapEdgeText(edgeIndex, edgeText) {
    if (window.rmapState.edges[edgeIndex]) {
        window.rmapState.edges[edgeIndex].text = edgeText;
        saveRmapState();
    }
}


function updateRmapNodeSize(nodeId, widthValue, heightValue) {
    if (window.rmapState.nodes[nodeId]) {
        window.rmapState.nodes[nodeId].w = parseInt(widthValue);
        window.rmapState.nodes[nodeId].h = parseInt(heightValue);
        saveRmapState();
    }
}
function updateRmapNode(nodeId, nodeText) {
    if (window.rmapState.nodes[nodeId]) {
        window.rmapState.nodes[nodeId].text = nodeText;
        saveRmapState();
    }
}

function deleteRmapNode(nodeId) {
    delete window.rmapState.nodes[nodeId];
    window.rmapState.edges = window.rmapState.edges.filter(edgeObject => edgeObject.source !== nodeId && edgeObject.target !== nodeId);
    saveRmapState();
    renderRmap();
}

function startRmapConnect(nodeId, mouseEvent) {
    mouseEvent.stopPropagation();
    rmapConnectingFrom = nodeId;
}

function saveRmapState() {
    if (!activeChronicleId) return;
    // Send an authenticated HTTP POST request to persist the current relationship map state to the server
    authFetch(`/api/gameboard/relationship-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chronicle_id: activeChronicleId,
            map_state: window.rmapState
        })
    }).catch(console.error);
}

function loadRmapState(mapStateData) {
    if (mapStateData && typeof mapStateData === 'object') {
        window.rmapState = { nodes: mapStateData.nodes || {}, edges: mapStateData.edges || [] };
    } else {
        window.rmapState = { nodes: {}, edges: [] };
    }
    renderRmap();
}

// Hook into existing socket
// Register a window load event listener to initialize the relationship map once the page finishes loading
window.addEventListener('load', () => {
    initRelationshipMap();
});
