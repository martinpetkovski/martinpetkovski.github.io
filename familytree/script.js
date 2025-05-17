let familyData = [];
let canvas, ctx;
let panX = 0, panY = 0, scale = 1;
let isDragging = false, lastX, lastY;
let selectedId = null;

// Connection styles with varied colors and widths
const connectionStyles = [
  { color: '#00b7eb', width: 6 },  // Cyan, very thick
  { color: '#66bb6a', width: 4 },  // Green, thick
  { color: '#ab47bc', width: 2 },  // Purple, medium
  { color: '#ffca28', width: 1 }   // Yellow, thin (highest z-index)
];

// Load JSON data
fetch('family.json')
  .then(response => response.json())
  .then(data => {
    familyData = data;
    populatePersonSearch();
    drawTree();
  })
  .catch(error => console.error('Error loading JSON:', error));

// Populate datalist for searchable combo box
function populatePersonSearch(searchTerm = '') {
  const datalist = document.getElementById('personList');
  datalist.innerHTML = '';
  const filteredData = searchTerm
    ? familyData.filter(person =>
        `${person.name} ${person.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : familyData;
  filteredData.forEach(person => {
    const option = document.createElement('option');
    option.value = `${person.name} ${person.surname}`;
    option.dataset.id = person.id;
    datalist.appendChild(option);
  });
}

// Render a single node
function renderNode(person, pos, selectedId, connectedIds, nodesContainer) {
  const country = person.origin.split(', ')[1] || person.origin;
  const originDisplay = `${typeof flagMap !== 'undefined' && flagMap[country] ? flagMap[country] : '🌍'} ${person.origin}`;

  const node = document.createElement('div');
  node.className = 'person-node';
  if (person.id === selectedId) {
    node.classList.add('highlighted');
  } else if (connectedIds.has(person.id)) {
    node.classList.add('connected');
  }
  node.style.transform = `translate(${pos.x * scale + panX}px, ${pos.y * scale + panY}px) scale(${scale})`;
  node.style.transformOrigin = 'top left';
  node.innerHTML = `
    <div class="header">${person.name} ${person.surname}</div>
    <div class="content">
      <table>
        <tr>
          <td class="label">Born</td>
          <td class="separator">|</td>
          <td class="value">${person.dateOfBirth}</td>
        </tr>
        <tr>
          <td class="label">Original</td>
          <td class="separator">|</td>
          <td class="value">${person.originalSurname}</td>
        </tr>
        <tr>
          <td class="label">Died</td>
          <td class="separator">|</td>
          <td class="value">${person.dateOfDeath || 'N/A'}</td>
        </tr>
        <tr>
          <td class="label">Origin</td>
          <td class="separator">|</td>
          <td class="value">${originDisplay}</td>
        </tr>
      </table>
    </div>
  `;
  node.onclick = () => {
    document.getElementById('personSearch').value = `${person.name} ${person.surname}`;
    drawTree(person.id);
  };
  node.addEventListener('mousedown', e => {
    if (e.button === 2) e.stopPropagation();
  });
  node.addEventListener('wheel', e => e.stopPropagation());
  nodesContainer.appendChild(node);
}

// Draw the family tree
function drawTree(newSelectedId = null) {
  const nodesContainer = document.getElementById('treeNodes');
  canvas = document.getElementById('treeCanvas');
  ctx = canvas.getContext('2d');

  // Reset view only if a new person is selected
  if (newSelectedId !== selectedId) {
    panX = 0;
    panY = 0;
    scale = 1;
    selectedId = newSelectedId;
  }

  // Clear previous content
  nodesContainer.innerHTML = '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set canvas size to match container
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  // Apply transformations
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(scale, scale);

  // Draw grid background
  drawGrid(ctx);

  // Get the subtree (or full tree if no valid selection)
  const displayData = selectedId && familyData.find(p => p.id === selectedId) ? getSubtree(selectedId) : familyData;

  // Precalculate generations
  const generations = {};
  function computeGeneration(personId, gen = 0, visited = new Set()) {
    if (visited.has(personId)) return generations[personId] || gen;
    visited.add(personId);
    const person = displayData.find(p => p.id === personId);
    if (!person) return gen;

    generations[personId] = gen;

    let parentGen = gen - 1;
    [person.parent1Id, person.parent2Id].forEach(parentId => {
      if (parentId) {
        const parent = displayData.find(p => p.id === parentId);
        if (parent) {
          const computedGen = computeGeneration(parentId, parentGen, visited);
          generations[parentId] = Math.min(generations[parentId] || computedGen, parentGen);
        }
      }
    });

    if (person.spouseId) {
      generations[person.spouseId] = gen;
      computeGeneration(person.spouseId, gen, visited);
    }

    const children = displayData.filter(p => p.parent1Id === personId || p.parent2Id === personId);
    children.forEach(child => {
      computeGeneration(child.id, gen + 1, visited);
    });

    return gen;
  }

  displayData.forEach(person => {
    computeGeneration(person.id, 0);
  });

  // Calculate positions
  const positions = {};
  const levelHeight = 350;
  const nodeWidth = 1200;
  const spouseOffset = 500;
  const familyGap = 400;
  let maxWidth = 0, maxHeight = 0;

  // Precalculate subtree widths
  const subtreeWidths = {};
  function computeSubtreeWidth(personId, visited = new Set()) {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    const person = displayData.find(p => p.id === personId);
    if (!person) return nodeWidth;

    let width = person.spouseId ? nodeWidth + spouseOffset : nodeWidth;

    const children = displayData.filter(p => p.parent1Id === personId || p.parent2Id === personId);
    let childrenWidth = 0;
    children.forEach(child => {
      childrenWidth += computeSubtreeWidth(child.id, visited);
    });

    return Math.max(width, childrenWidth);
  }

  displayData.forEach(person => {
    subtreeWidths[person.id] = computeSubtreeWidth(person.id);
  });

  // Group nodes by generation
  const nodesByGeneration = {};
  displayData.forEach(person => {
    const gen = generations[person.id] || 0;
    if (!nodesByGeneration[gen]) nodesByGeneration[gen] = [];
    nodesByGeneration[gen].push(person);
  });

  // Assign positions
  Object.keys(nodesByGeneration).sort((a, b) => a - b).forEach(gen => {
    const nodes = nodesByGeneration[gen];
    const yPos = gen * levelHeight + 50;

    const families = {};
    nodes.forEach(person => {
      const parentKey = `${person.parent1Id || 'none'}-${person.parent2Id || 'none'}`;
      if (!families[parentKey]) families[parentKey] = [];
      families[parentKey].push(person);
    });

    let totalFamilyWidth = 0;
    const familyWidths = {};
    Object.entries(families).forEach(([parentKey, family]) => {
      let familyWidth = 0;
      family.forEach(person => {
        familyWidth += person.spouseId && displayData.find(p => p.id === person.spouseId)
          ? nodeWidth + spouseOffset
          : nodeWidth;
      });
      familyWidths[parentKey] = Math.max(familyWidth, family.reduce((sum, p) => sum + (subtreeWidths[p.id] || nodeWidth), 0));
      totalFamilyWidth += familyWidths[parentKey] + familyGap;
    });
    totalFamilyWidth -= familyGap;

    let familyXOffsets = {};
    let currentX = -(totalFamilyWidth) / 2;
    Object.entries(families).forEach(([parentKey, family]) => {
      let parentMidpoint = 0;
      const [parent1Id, parent2Id] = parentKey.split('-').map(id => id === 'none' ? null : parseInt(id));
      if (parent1Id && positions[parent1Id] && parent2Id && positions[parent2Id]) {
        parentMidpoint = (positions[parent1Id].x + positions[parent2Id].x) / 2;
      } else if (parent1Id && positions[parent1Id]) {
        parentMidpoint = (positions[parent1Id].x);
      } else if (parent2Id && positions[parent2Id]) {
        parentMidpoint = positions[parent2Id].x;
      } else {
        parentMidpoint = currentX + familyWidths[parentKey] / 2;
      }

      let familyWidth = familyWidths[parentKey];
      let familyStartX = parentMidpoint - (familyWidth - nodeWidth) / 2;
      family.forEach(person => {
        const personId = person.id;
        const spouseId = person.spouseId;

        if (spouseId && positions[spouseId]) return;

        if (spouseId && displayData.find(p => p.id === person.spouseId)) {
          positions[personId] = { x: familyStartX - spouseOffset / 2, y: yPos };
          positions[spouseId] = { x: familyStartX + spouseOffset / 2, y: yPos };
          familyStartX += nodeWidth + spouseOffset;
        } else {
          positions[personId] = { x: familyStartX, y: yPos };
          familyStartX += nodeWidth;
        }

        maxWidth = Math.max(maxWidth, Math.abs(positions[personId].x));
        maxHeight = Math.max(maxHeight, yPos);
        if (spouseId && positions[spouseId]) {
          maxWidth = Math.max(maxWidth, Math.abs(positions[spouseId].x));
        }
      });

      currentX += familyWidths[parentKey] + familyGap;
      familyXOffsets[parentKey] = currentX;
    });
  });

  // Find connected nodes
  const connectedIds = new Set();
  if (selectedId) {
    const person = displayData.find(p => p.id === selectedId);
    if (person) {
      if (person.parent1Id) connectedIds.add(person.parent1Id);
      if (person.parent2Id) connectedIds.add(person.parent2Id);
      displayData.forEach(p => {
        if (p.parent1Id === selectedId || p.parent2Id === selectedId) {
          connectedIds.add(p.id);
        }
      });
      if (person.spouseId) connectedIds.add(person.spouseId);
    }
  }

  // Collect connections
  const connections = [];
  displayData.forEach(person => {
    const pos = positions[person.id];
    if (!pos) return;

    [person.parent1Id, person.parent2Id].forEach((parentId, index) => {
      if (parentId && positions[parentId]) {
        const parentPos = positions[parentId];
        const fromX = pos.x + 150;
        const fromY = pos.y;
        const toX = parentPos.x + 150;
        const toY = parentPos.y + 160;
        const isConnected = selectedId && (person.id === selectedId || parentId === selectedId);
        connections.push({
          fromX,
          fromY,
          toX,
          toY,
          style: isConnected
            ? { color: '#ff5252', width: 4 }
            : connectionStyles[(connections.length + index) % connectionStyles.length],
          label: 'Parent'
        });
      }
    });

    if (person.spouseId && positions[person.spouseId] && person.id < person.spouseId) {
      const spousePos = positions[person.spouseId];
      const fromX = pos.x + 150;
      const fromY = pos.y + 80;
      const toX = spousePos.x + 150;
      const toY = spousePos.y + 80;
      const isConnected = selectedId && (person.id === selectedId || person.spouseId === selectedId);
      connections.push({
        fromX,
        fromY,
        toX,
        toY,
        style: isConnected
          ? { color: '#ff5252', width: 2, type: 'spouse' }
          : { type: 'spouse' },
        label: 'Spouse'
      });
    }
  });

  connections.sort((a, b) => (b.style.width || 2) - (a.style.width || 2));

  // Render connections
  connections.forEach(conn => {
    if (conn.style.type === 'spouse') {
      drawSpouseConnection(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.label);
    } else {
      drawPCBConnection(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.style, conn.label);
    }
  });

  // Render nodes (initial)
  displayData.forEach(person => {
    const pos = positions[person.id];
    if (!pos) return;
    renderNode(person, pos, selectedId, connectedIds, nodesContainer);
  });

  // Navigate to the selected node
  if (selectedId && positions[selectedId] && newSelectedId === selectedId) {
    const selectedPos = positions[selectedId];
    panX = canvas.width / 2 - selectedPos.x * scale;
    panY = canvas.height / 2 - selectedPos.y * scale;

    ctx.restore();
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    drawGrid(ctx);
    connections.forEach(conn => {
      if (conn.style.type === 'spouse') {
        drawSpouseConnection(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.label);
      } else {
        drawPCBConnection(ctx, conn.fromX, conn.fromY, conn.toX, conn.toY, conn.style, conn.label);
      }
    });

    nodesContainer.innerHTML = '';
    displayData.forEach(person => {
      const pos = positions[person.id];
      if (!pos) return;
      renderNode(person, pos, selectedId, connectedIds, nodesContainer);
    });
  }

  ctx.restore();

  nodesContainer.style.width = `${maxWidth * 2 + 600}px`;
  nodesContainer.style.height = `${maxHeight + 600}px`;
}

// Zoom functionality
function zoom(factor, mouseX, mouseY) {
  const canvas = document.getElementById('treeCanvas');
  const rect = canvas.getBoundingClientRect();

  const canvasMouseX = (mouseX - rect.left - panX) / scale;
  const canvasMouseY = (mouseY - rect.top - panY) / scale;

  panX -= canvasMouseX * (factor - 1) * scale;
  panY -= canvasMouseY * (factor - 1) * scale;
  scale *= factor;

  drawTree(selectedId);
}

// Reset view
function resetView() {
  panX = 0;
  panY = 0;
  scale = 1;
  drawTree(selectedId);
}

// Draw PCB-style connection
function drawPCBConnection(ctx, fromX, fromY, toX, toY, style, label) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  const midY = fromY - (fromY - toY) / 2;
  ctx.lineTo(fromX, midY);
  ctx.lineTo(toX, midY);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width / scale;
  ctx.lineCap = 'square';
  ctx.stroke();

  if (label) {
    ctx.font = `${12 / scale}px Roboto`;
    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelX = (fromX + toX) / 2;
    const labelY = midY - 5 / scale;
    ctx.fillText(label, labelX, labelY);
  }
}

// Draw dashed spouse connection
function drawSpouseConnection(ctx, fromX, fromY, toX, toY, label) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = '#0288d1';
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([5 / scale, 5 / scale]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (label) {
    ctx.font = `${12 / scale}px Roboto`;
    ctx.fillStyle = '#0288d1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelX = (fromX + toX) / 2;
    const labelY = fromY - 5 / scale;
    ctx.fillText(label, labelX, labelY);
  }
}

// Draw infinite grid background
function drawGrid(ctx) {
  const gridSize = 50;
  ctx.save();
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 0.5 / scale;

  const left = -panX / scale - 10000;
  const right = (-panX + canvas.width) / scale + 10000;
  const top = -panY / scale - 10000;
  const bottom = (-panY + canvas.height) / scale + 10000;

  for (let x = Math.floor(left / gridSize) * gridSize; x <= right; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  for (let y = Math.floor(top / gridSize) * gridSize; y <= bottom; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  ctx.restore();
}

// Get the subtree for a selected person
function getSubtree(personId, visited = new Set()) {
  if (!personId || visited.has(personId)) return [];
  visited.add(personId);

  const person = familyData.find(p => p.id === personId);
  if (!person) return [];

  let subtree = [person];

  [person.parent1Id, person.parent2Id].forEach(parentId => {
    if (parentId) {
      subtree = subtree.concat(getSubtree(parentId, visited));
    }
  });

  if (person.spouseId) {
    const spouse = familyData.find(p => p.id === person.spouseId);
    if (spouse && !visited.has(spouse.id)) {
      subtree.push(spouse);
      visited.add(spouse.id);
    }
  }

  const children = familyData.filter(p => p.parent1Id === personId || p.parent2Id === personId);
  children.forEach(child => {
    subtree = subtree.concat(getSubtree(child.id, visited));
  });

  return subtree;
}

// Pan and zoom controls
function setupCanvasControls() {
  const treeContainer = document.querySelector('.tree-container');

  treeContainer.addEventListener('contextmenu', e => {
    e.preventDefault();
    return false;
  });

  treeContainer.addEventListener('mousedown', e => {
    if (e.button === 2) {
      e.preventDefault();
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      treeContainer.style.cursor = 'grabbing';
    }
  });

  treeContainer.addEventListener('mousemove', e => {
    if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      panX += dx;
      panY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      drawTree(selectedId);
    }
  });

  treeContainer.addEventListener('mouseup', e => {
    if (e.button === 2) {
      isDragging = false;
      treeContainer.style.cursor = 'grab';
    }
  });

  treeContainer.addEventListener('mouseleave', () => {
    isDragging = false;
    treeContainer.style.cursor = 'grab';
  });

  treeContainer.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom(zoomFactor, e.clientX, e.clientY);
  });

  // Searchable combo box with debounce
  let searchTimeout;
  const personSearch = document.getElementById('personSearch');
  personSearch.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const searchTerm = e.target.value;
      populatePersonSearch(searchTerm);
      if (!searchTerm) {
        selectedId = null;
        drawTree(null);
      }
    }, 300);
  });

  personSearch.addEventListener('change', e => {
    const selectedOption = Array.from(document.getElementById('personList').options).find(
      option => option.value === e.target.value
    );
    if (selectedOption) {
      const newSelectedId = parseInt(selectedOption.dataset.id);
      drawTree(newSelectedId);
    } else {
      selectedId = null;
      drawTree(null);
    }
  });

  window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    drawTree(selectedId);
  });
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('treeCanvas');
  canvas.style.cursor = 'grab';
  setupCanvasControls();
});