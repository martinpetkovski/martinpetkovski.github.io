const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const app = express();
const port = 3000;

// Set up WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve images from the output directory
let outputDir;
app.get('/images/:filename', async (req, res) => {
  try {
    const filePath = path.join(outputDir, req.params.filename);
    if (!filePath.startsWith(path.resolve(outputDir))) {
      return res.status(403).send('Access denied');
    }
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).send('Image not found');
      }
    });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Default config in case config.json is invalid or missing
const defaultConfig = {
  unreal_engine_exe: "C:/Program Files/Epic Games/UE_5.4/Engine/Binaries/Win64/UnrealEditor-Cmd.exe",
  project_path: "D:/Unreal Projects/SequencerTestBed/SequencerTestBed.uproject",
  map_name: "/Game/TestRender/TestRender_Map",
  default_output_dir: "D:/Unreal Projects/SequencerTestBed/Saved/Screenshots",
  level_sequence: "/Game/Test_Render/Test_Render_SQ",
  movie_pipeline_config: "/Game/Cinematics/Presets/HighQualityPreset",
  log_enabled: true,
  no_texture_streaming: true
};

// Load config
async function loadConfig() {
  try {
    const data = await fs.readFile('config.json', 'utf8');
    if (!data.trim()) {
      console.warn('config.json is empty. Using default config.');
      return defaultConfig;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error.message);
    console.warn('Using default config.');
    return defaultConfig;
  }
}

// Save config
async function saveConfig(newConfig) {
  try {
    await fs.writeFile('config.json', JSON.stringify(newConfig, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save config: ${error.message}`);
  }
}

// Sanitize input
function sanitizeInput(value, isPath = false) {
  const allowedChars = isPath ? /^[a-zA-Z0-9\/._-]*$/ : /^[0-9]*$/;
  if (!allowedChars.test(value)) {
    throw new Error(`Invalid characters in input: ${value}`);
  }
  return value;
}

// Get config settings
app.get('/config', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      level_sequence: config.level_sequence,
      movie_pipeline_config: config.movie_pipeline_config,
      default_output_dir: config.default_output_dir,
      map_name: config.map_name
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to load config: ${error.message}` });
  }
});

// Update config settings
app.post('/config', async (req, res) => {
  try {
    const { level_sequence, movie_pipeline_config, default_output_dir, map_name } = req.body;
    const config = await loadConfig();
    config.level_sequence = sanitizeInput(level_sequence, true);
    config.movie_pipeline_config = sanitizeInput(movie_pipeline_config, true);
    config.default_output_dir = sanitizeInput(default_output_dir, true);
    config.map_name = sanitizeInput(map_name, true);
    await saveConfig(config);
    res.json({ status: 'success', message: 'Configuration updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle render request
app.post('/render', async (req, res) => {
  try {
    const config = await loadConfig();
    outputDir = config.default_output_dir;
    const { res_x, res_y, start_frame, end_frame } = req.body;

    // Validate inputs
    const resX = parseInt(sanitizeInput(res_x), 10);
    const resY = parseInt(sanitizeInput(res_y), 10);
    const startFrame = parseInt(sanitizeInput(start_frame), 10);
    const endFrame = parseInt(sanitizeInput(end_frame), 10);

    if (!Number.isInteger(resX) || !Number.isInteger(resY) || resX < 1 || resX > 7680 || resY < 1 || resY > 4320) {
      return res.status(400).json({ error: 'Resolution must be between 1x1 and 7680x4320.' });
    }
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame < 0 || endFrame < startFrame) {
      return res.status(400).json({ error: 'Invalid frame range: Start frame must be non-negative and less than or equal to end frame.' });
    }

    // Calculate total frames for progress
    const totalFrames = endFrame - startFrame + 1;

    // Build command
    let cmd = [
      `"${config.unreal_engine_exe}"`,
      `"${config.project_path}"`,
      config.map_name,
      '-game',
      `-LevelSequence="${config.level_sequence}"`,
      `-MoviePipelineConfig="${config.movie_pipeline_config}"`,
      `-windowed`,
      `-resx=${resX}`,
      `-resy=${resY}`,
      `-MovieFrameRange=${startFrame}-${endFrame}`
    ];
    if (config.log_enabled) cmd.push('-log');
    if (config.no_texture_streaming) cmd.push('-notexturestreaming');

    const cmdString = cmd.join(' ');

    // Initialize file watcher
    const watcher = chokidar.watch(outputDir, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: true
    });

    let imageCount = 0;
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp'];
    let images = [];

    // Count initial images
    try {
      const files = await fs.readdir(outputDir);
      images = files.filter(file => imageExtensions.includes(path.extname(file).toLowerCase())).map(file => `/images/${file}`);
      imageCount = images.length;
    } catch (error) {
      console.warn(`Error reading output directory: ${error.message}`);
    }

    // Broadcast initial progress and images
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ imageCount, totalFrames, progress: (imageCount / totalFrames) * 100, images }));
      }
    });

    // Watch for new files
    watcher.on('add', async (filePath) => {
      if (imageExtensions.includes(path.extname(filePath).toLowerCase())) {
        imageCount++;
        const imageUrl = `/images/${path.basename(filePath)}`;
        images.push(imageUrl);
        const progress = Math.min((imageCount / totalFrames) * 100, 100).toFixed(2);
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ imageCount, totalFrames, progress, images }));
          }
        });
      }
    });

    // Execute command
    exec(cmdString, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
      watcher.close();
      if (error) {
        console.error(`Render error: ${stderr}`);
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ error: 'Render command failed. Check server logs for details.' }));
          }
        });
        return res.status(500).json({ error: 'Render command failed. Check server logs for details.' });
      }
      res.json({
        status: 'success',
        message: `Rendering started for ${config.level_sequence} at ${resX}x${resY}, frames ${startFrame} to ${endFrame}`,
        output_dir: config.default_output_dir
      });
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`WebSocket server running at ws://localhost:8080`);
});