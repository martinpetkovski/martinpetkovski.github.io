const renderForm = document.getElementById('render-form');
const configForm = document.getElementById('config-form');
const responseDiv = document.getElementById('response');
const progressDiv = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const galleryDiv = document.getElementById('gallery');
const galleryImages = document.getElementById('gallery-images');
const configDisplay = document.getElementById('config-display');
const configResponse = document.getElementById('config-response');
const editConfigBtn = document.getElementById('edit-config-btn');
const cancelConfigBtn = document.getElementById('cancel-config-btn');

// WebSocket connection
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.error) {
    responseDiv.innerHTML = `<span class="text-red-600">Error: ${data.error}</span>`;
    progressDiv.classList.add('hidden');
    galleryDiv.classList.add('hidden');
  } else {
    progressDiv.classList.remove('hidden');
    progressBar.style.width = `${data.progress}%`;
    progressText.innerHTML = `Rendered ${data.imageCount} of ${data.totalFrames} frames (${data.progress}%)`;
    if (data.images && data.images.length > 0) {
      galleryDiv.classList.remove('hidden');
      galleryImages.innerHTML = '';
      data.images.forEach(imageUrl => {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'w-full h-32 object-cover rounded-md';
        galleryImages.appendChild(img);
      });
    }
  }
};

ws.onclose = () => {
  responseDiv.innerHTML = `<span class="text-gray-600">Render complete or WebSocket connection closed.</span>`;
};

// Fetch and display config settings
async function loadConfig() {
  try {
    const response = await fetch('/config');
    const config = await response.json();
    document.getElementById('config-level_sequence').textContent = config.level_sequence || 'Not set';
    document.getElementById('config-movie_pipeline_config').textContent = config.movie_pipeline_config || 'Not set';
    document.getElementById('config-default_output_dir').textContent = config.default_output_dir || 'Not set';
    document.getElementById('config-map_name').textContent = config.map_name || 'Not set';
    
    // Pre-fill edit form
    document.getElementById('edit-level_sequence').value = config.level_sequence || '';
    document.getElementById('edit-movie_pipeline_config').value = config.movie_pipeline_config || '';
    document.getElementById('edit-default_output_dir').value = config.default_output_dir || '';
    document.getElementById('edit-map_name').value = config.map_name || '';
  } catch (error) {
    configResponse.innerHTML = `<span class="text-red-600">Error loading config: ${error.message}</span>`;
  }
}

// Initial config load
loadConfig();

// Toggle edit form
editConfigBtn.addEventListener('click', () => {
  configDisplay.classList.toggle('hidden');
  configForm.classList.toggle('hidden');
  configResponse.innerHTML = '';
});

cancelConfigBtn.addEventListener('click', () => {
  configDisplay.classList.remove('hidden');
  configForm.classList.add('hidden');
  configResponse.innerHTML = '';
  loadConfig();
});

// Handle config form submission
configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  configResponse.innerHTML = '<span class="text-blue-600">Saving settings...</span>';
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch('/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    });
    const result = await response.json();
    if (result.status === 'success') {
      configResponse.innerHTML = `<span class="text-green-600">${result.message}</span>`;
      configDisplay.classList.remove('hidden');
      configForm.classList.add('hidden');
      loadConfig();
    } else {
      configResponse.innerHTML = `<span class="text-red-600">Error: ${result.error}</span>`;
    }
  } catch (error) {
    configResponse.innerHTML = `<span class="text-red-600">Error: ${error.message}</span>`;
  }
});

// Handle render form submission
renderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  responseDiv.innerHTML = '<span class="text-blue-600">Starting render...</span>';
  progressDiv.classList.add('hidden');
  galleryDiv.classList.add('hidden');

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch('/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString()
    });
    const result = await response.json();
    if (result.status === 'success') {
      responseDiv.innerHTML = `<span class="text-green-600">${result.message}</span><br>Output will be saved to: ${result.output_dir}`;
      progressDiv.classList.remove('hidden');
    } else {
      responseDiv.innerHTML = `<span class="text-red-600">Error: ${result.error}</span>`;
      progressDiv.classList.add('hidden');
      galleryDiv.classList.add('hidden');
    }
  } catch (error) {
    responseDiv.innerHTML = `<span class="text-red-600">Error: ${error.message}</span>`;
    progressDiv.classList.add('hidden');
    galleryDiv.classList.add('hidden');
  }
});