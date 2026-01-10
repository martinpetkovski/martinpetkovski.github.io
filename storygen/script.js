// State
let state = {
  layers: [], // { id, type, x, y, scale, ...props }
  selectedId: null,
  editingId: null, // ID of layer currently being edited in-place
  zoom: 0.35, // default reasonable fit
  view: 'layers',
  global: {
    bgColor: '#111827',
    bgImg: null, // dataURL
    bgType: 'color', // 'color', 'gradient', 'image'
    bgGradient: 'linear-gradient(135deg, #111827 0%, #111827 100%)'
  },
  draggingId: null,
  dragOffset: { x: 0, y: 0 }
};

// Undo/Redo History
const history = {
  stack: [],
  index: -1,
  maxSize: 50,
  ignoreNext: false
};

function pushHistory() {
  if (history.ignoreNext) {
    history.ignoreNext = false;
    return;
  }
  // Remove any redo states
  history.stack = history.stack.slice(0, history.index + 1);
  // Clone current state (only layers and global)
  const snapshot = JSON.stringify({ layers: state.layers, global: state.global });
  // Don't push if same as current
  if (history.stack.length > 0 && history.stack[history.index] === snapshot) return;
  history.stack.push(snapshot);
  if (history.stack.length > history.maxSize) history.stack.shift();
  history.index = history.stack.length - 1;
  updateUndoRedoButtons();
}

function undo() {
  if (history.index > 0) {
    history.index--;
    const snapshot = JSON.parse(history.stack[history.index]);
    history.ignoreNext = true;
    state.layers = snapshot.layers;
    state.global = snapshot.global;
    state.selectedId = null;
    saveState();
    renderAll();
    updateUndoRedoButtons();
  }
}

function redo() {
  if (history.index < history.stack.length - 1) {
    history.index++;
    const snapshot = JSON.parse(history.stack[history.index]);
    history.ignoreNext = true;
    state.layers = snapshot.layers;
    state.global = snapshot.global;
    state.selectedId = null;
    saveState();
    renderAll();
    updateUndoRedoButtons();
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = history.index <= 0;
  if (redoBtn) redoBtn.disabled = history.index >= history.stack.length - 1;
}

// Pickr instances cache
const pickrInstances = {};

const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'PT Sans', 'Merriweather', 'Nunito',
  'Playfair Display', 'Rubik', 'Ubuntu', 'Poppins', 'Kanit', 'Lobster', 'Pacifico', 'Quicksand', 'Work Sans', 
  'Fira Sans', 'Barlow', 'Bebas Neue', 'Expletus Sans', 'Comfortaa', 'Righteous', 'Cinzel', 'Anton', 
  'Dancing Script', 'Permanent Marker', 'Shadows Into Light', 'JetBrains Mono', 'System-UI', 'Serif'
].sort();

// Text Presets (20+ meaningful presets)
const TEXT_PRESETS = [
  // ==================== MARKDOWN-AWARE TEXT PRESETS (50 total) ====================
  // Each preset can have markdown-specific styling: h1Color, h1Font, h2Color, h2Font, h3Color, etc.
  // These override the base styles for markdown elements
  
  // --- EDITORIAL & BLOG STYLES (1-10) ---
  { 
    name: 'Magazine Article', category: 'text', 
    text: '# Breaking News\n\n## The Story Unfolds\n\nThis is your lead paragraph with the most important information.',
    fontFamily: 'Playfair Display', fontSize: 28, fontWeight: '400', color: '#e0e0e0', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Playfair Display', h1Color: '#ffffff', h1Size: 72, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#cccccc', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Blog Post', category: 'text', 
    text: '# My Journey\n\n## Chapter One\n\nEvery great story has a beginning. This is mine.',
    fontFamily: 'Georgia', fontSize: 26, fontWeight: '400', color: '#f5f5f5', textAlign: 'left', lineHeight: 1.75,
    h1Font: 'Merriweather', h1Color: '#ffffff', h1Size: 64, h1Weight: '700',
    h2Font: 'Georgia', h2Color: '#4fc3f7', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Tech Article', category: 'text', 
    text: '# How It Works\n\n## The Technology\n\nLet me explain the innovation behind this.',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '400', color: '#e0e0e0', textAlign: 'left', lineHeight: 1.65,
    h1Font: 'Roboto', h1Color: '#00d4ff', h1Size: 56, h1Weight: '700',
    h2Font: 'Roboto', h2Color: '#ffffff', h2Size: 32, h2Weight: '500'
  },
  { 
    name: 'News Flash', category: 'text', 
    text: '# BREAKING\n\n## Update\n\nHere\'s what you need to know right now.',
    fontFamily: 'PT Sans', fontSize: 28, fontWeight: '400', color: '#ffffff', textAlign: 'left', lineHeight: 1.6,
    h1Font: 'Bebas Neue', h1Color: '#ff4444', h1Size: 80, h1Weight: '400',
    h2Font: 'PT Sans', h2Color: '#ffcc00', h2Size: 36, h2Weight: '700'
  },
  { 
    name: 'Feature Story', category: 'text', 
    text: '# The Untold Story\n\n## Behind the Scenes\n\nDiscover what really happened.',
    fontFamily: 'Lora', fontSize: 26, fontWeight: '400', color: '#f0f0f0', textAlign: 'justify', lineHeight: 1.8,
    h1Font: 'Playfair Display', h1Color: '#ffd700', h1Size: 60, h1Weight: '700',
    h2Font: 'Lora', h2Color: '#ffffff', h2Size: 34, h2Weight: '600'
  },
  { 
    name: 'Opinion Piece', category: 'text', 
    text: '# My Take\n\n## Why It Matters\n\nHere\'s my perspective on this important topic.',
    fontFamily: 'Merriweather', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Anton', h1Color: '#ff6b6b', h1Size: 64, h1Weight: '400',
    h2Font: 'Merriweather', h2Color: '#cccccc', h2Size: 30, h2Weight: '700'
  },
  { 
    name: 'Travel Blog', category: 'text', 
    text: '# Destination: Paradise\n\n## Day One\n\nThe adventure begins with a single step.',
    fontFamily: 'Quicksand', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Dancing Script', h1Color: '#4fc3f7', h1Size: 72, h1Weight: '700',
    h2Font: 'Quicksand', h2Color: '#ffcc00', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Food Review', category: 'text', 
    text: '# Restaurant Review\n\n## The Experience\n\n⭐⭐⭐⭐⭐ An unforgettable meal.',
    fontFamily: 'Nunito', fontSize: 26, fontWeight: '400', color: '#fff5e6', textAlign: 'left', lineHeight: 1.65,
    h1Font: 'Playfair Display', h1Color: '#ff9500', h1Size: 56, h1Weight: '700',
    h2Font: 'Nunito', h2Color: '#ffffff', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Interview Style', category: 'text', 
    text: '# Exclusive Interview\n\n## Q&A Session\n\nWe sat down for a candid conversation.',
    fontFamily: 'Open Sans', fontSize: 26, fontWeight: '400', color: '#e0e0e0', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Oswald', h1Color: '#ffffff', h1Size: 60, h1Weight: '700',
    h2Font: 'Open Sans', h2Color: '#4fc3f7', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Documentary', category: 'text', 
    text: '# The Truth Revealed\n\n## Investigation\n\nFacts don\'t lie. Here\'s what we found.',
    fontFamily: 'Source Serif Pro', fontSize: 26, fontWeight: '400', color: '#f5f5f5', textAlign: 'left', lineHeight: 1.75,
    h1Font: 'Bebas Neue', h1Color: '#ffffff', h1Size: 72, h1Weight: '400',
    h2Font: 'Source Serif Pro', h2Color: '#888888', h2Size: 28, h2Weight: '600'
  },

  // --- SOCIAL MEDIA STYLES (11-20) ---
  { 
    name: 'Instagram Caption', category: 'text', 
    text: '# ✨ Mood\n\nLiving my best life. No filter needed.',
    fontFamily: 'Inter', fontSize: 28, fontWeight: '400', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Dancing Script', h1Color: '#ff6b9d', h1Size: 64, h1Weight: '700'
  },
  { 
    name: 'Story Intro', category: 'text', 
    text: '# Hey There! 👋\n\n## Swipe Up\n\nYou won\'t want to miss this!',
    fontFamily: 'Poppins', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.55,
    h1Font: 'Poppins', h1Color: '#ffffff', h1Size: 56, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#00d4ff', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Viral Post', category: 'text', 
    text: '# 🔥 TRENDING\n\n## Everyone\'s Talking About This\n\nHere\'s why it matters.',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Anton', h1Color: '#ff4444', h1Size: 72, h1Weight: '400',
    h2Font: 'Inter', h2Color: '#ffcc00', h2Size: 28, h2Weight: '600'
  },
  { 
    name: 'Engagement Post', category: 'text', 
    text: '# Question Time\n\n## What Do You Think?\n\nDrop your answer in the comments! 👇',
    fontFamily: 'Nunito', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Righteous', h1Color: '#4fc3f7', h1Size: 60, h1Weight: '400',
    h2Font: 'Nunito', h2Color: '#ffffff', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Behind Scenes', category: 'text', 
    text: '# BTS 🎬\n\n## Sneak Peek\n\nThis is what goes on behind the camera.',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '400', color: '#e0e0e0', textAlign: 'left', lineHeight: 1.65,
    h1Font: 'Bebas Neue', h1Color: '#ffffff', h1Size: 64, h1Weight: '400',
    h2Font: 'Inter', h2Color: '#ff6b6b', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Countdown', category: 'text', 
    text: '# 3 DAYS LEFT\n\n## Mark Your Calendar\n\nSomething big is coming! 🚀',
    fontFamily: 'Montserrat', fontSize: 28, fontWeight: '600', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Anton', h1Color: '#ff0066', h1Size: 80, h1Weight: '400',
    h2Font: 'Montserrat', h2Color: '#ffcc00', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Giveaway', category: 'text', 
    text: '# 🎁 GIVEAWAY\n\n## How to Enter\n\n1. Follow\n2. Like\n3. Tag 3 friends',
    fontFamily: 'Poppins', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Righteous', h1Color: '#ffd700', h1Size: 64, h1Weight: '400',
    h2Font: 'Poppins', h2Color: '#ffffff', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Poll Style', category: 'text', 
    text: '# This or That?\n\n## Vote Now!\n\n🅰️ Option A\n🅱️ Option B',
    fontFamily: 'Inter', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Oswald', h1Color: '#ff6b6b', h1Size: 56, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#4fc3f7', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Announcement', category: 'text', 
    text: '# 📢 BIG NEWS\n\n## We\'re Launching!\n\nAfter months of work, it\'s finally here.',
    fontFamily: 'Montserrat', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Anton', h1Color: '#ffffff', h1Size: 72, h1Weight: '400',
    h2Font: 'Montserrat', h2Color: '#00ff88', h2Size: 34, h2Weight: '600'
  },
  { 
    name: 'Throwback', category: 'text', 
    text: '# #TBT 📸\n\n## Remember This?\n\nTaking you back to where it all started.',
    fontFamily: 'Georgia', fontSize: 26, fontWeight: '400', color: '#f5f5dc', textAlign: 'center', lineHeight: 1.7,
    h1Font: 'Dancing Script', h1Color: '#daa520', h1Size: 64, h1Weight: '700',
    h2Font: 'Georgia', h2Color: '#ffffff', h2Size: 30, h2Weight: '600'
  },

  // --- BUSINESS & PROFESSIONAL (21-30) ---
  { 
    name: 'Corporate Brief', category: 'text', 
    text: '# Quarterly Report\n\n## Key Metrics\n\nHere are the numbers that matter.',
    fontFamily: 'Open Sans', fontSize: 26, fontWeight: '400', color: '#e0e0e0', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Montserrat', h1Color: '#ffffff', h1Size: 56, h1Weight: '700',
    h2Font: 'Open Sans', h2Color: '#4fc3f7', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Startup Pitch', category: 'text', 
    text: '# The Problem\n\n## Our Solution\n\nWe\'re changing the game.',
    fontFamily: 'Inter', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'left', lineHeight: 1.6,
    h1Font: 'Bebas Neue', h1Color: '#ff6b6b', h1Size: 72, h1Weight: '400',
    h2Font: 'Inter', h2Color: '#00d4ff', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Product Launch', category: 'text', 
    text: '# Introducing\n\n## The Future Is Here\n\nBuilt different. Designed better.',
    fontFamily: 'Roboto', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'center', lineHeight: 1.65,
    h1Font: 'Anton', h1Color: '#ffffff', h1Size: 80, h1Weight: '400',
    h2Font: 'Roboto', h2Color: '#888888', h2Size: 32, h2Weight: '500'
  },
  { 
    name: 'Sales Promo', category: 'text', 
    text: '# SALE 50% OFF\n\n## Limited Time\n\nDon\'t miss this incredible deal!',
    fontFamily: 'Poppins', fontSize: 28, fontWeight: '600', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Bebas Neue', h1Color: '#ff0066', h1Size: 96, h1Weight: '400',
    h2Font: 'Poppins', h2Color: '#ffcc00', h2Size: 36, h2Weight: '700'
  },
  { 
    name: 'Job Posting', category: 'text', 
    text: '# We\'re Hiring!\n\n## Join Our Team\n\nGreat opportunity for passionate people.',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Montserrat', h1Color: '#00ff88', h1Size: 60, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#4fc3f7', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Case Study', category: 'text', 
    text: '# Success Story\n\n## The Results\n\n📈 300% growth in 6 months',
    fontFamily: 'Source Serif Pro', fontSize: 26, fontWeight: '400', color: '#f0f0f0', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Playfair Display', h1Color: '#ffffff', h1Size: 56, h1Weight: '700',
    h2Font: 'Source Serif Pro', h2Color: '#00d4ff', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Service Menu', category: 'text', 
    text: '# Our Services\n\n## What We Offer\n\n✓ Design\n✓ Development\n✓ Strategy',
    fontFamily: 'Poppins', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'left', lineHeight: 1.65,
    h1Font: 'Oswald', h1Color: '#ffd700', h1Size: 56, h1Weight: '700',
    h2Font: 'Poppins', h2Color: '#cccccc', h2Size: 28, h2Weight: '600'
  },
  { 
    name: 'Conference', category: 'text', 
    text: '# SUMMIT 2026\n\n## Join Us\n\n📅 March 15-17 | Virtual & In-Person',
    fontFamily: 'Montserrat', fontSize: 26, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Anton', h1Color: '#4fc3f7', h1Size: 72, h1Weight: '400',
    h2Font: 'Montserrat', h2Color: '#ffffff', h2Size: 34, h2Weight: '600'
  },
  { 
    name: 'Testimonial', category: 'text', 
    text: '# What They Say\n\n## 5-Star Review\n\n"Absolutely incredible experience!"',
    fontFamily: 'Georgia', fontSize: 28, fontWeight: '400', color: '#ffffff', textAlign: 'center', lineHeight: 1.7,
    h1Font: 'Playfair Display', h1Color: '#ffd700', h1Size: 52, h1Weight: '700',
    h2Font: 'Georgia', h2Color: '#ffffff', h2Size: 28, h2Weight: '600'
  },
  { 
    name: 'Partnership', category: 'text', 
    text: '# New Partnership\n\n## Better Together\n\nExcited to announce our collaboration.',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'center', lineHeight: 1.65,
    h1Font: 'Montserrat', h1Color: '#ffffff', h1Size: 56, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#00ff88', h2Size: 32, h2Weight: '600'
  },

  // --- CREATIVE & ARTISTIC (31-40) ---
  { 
    name: 'Neon Dreams', category: 'text', 
    text: '# NEON\n\n## Nights\n\nWhere the lights never fade.',
    fontFamily: 'Righteous', fontSize: 28, fontWeight: '400', color: '#ff00ff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Righteous', h1Color: '#00ffff', h1Size: 96, h1Weight: '400', textShadow: '0 0 30px #00ffff, 0 0 60px #00ffff',
    h2Font: 'Righteous', h2Color: '#ff00ff', h2Size: 40, h2Weight: '400'
  },
  { 
    name: 'Retro Vibes', category: 'text', 
    text: '# RETRO\n\n## Classic Style\n\nBringing back the golden era.',
    fontFamily: 'Bebas Neue', fontSize: 28, fontWeight: '400', color: '#ffcc00', textAlign: 'center', lineHeight: 1.4,
    h1Font: 'Bebas Neue', h1Color: '#ff6b6b', h1Size: 100, h1Weight: '400', textStroke: '3px #000000',
    h2Font: 'Bebas Neue', h2Color: '#ffcc00', h2Size: 40, h2Weight: '400'
  },
  { 
    name: 'Elegant Script', category: 'text', 
    text: '# Elegance\n\n## Refined Beauty\n\nWhere sophistication meets art.',
    fontFamily: 'Playfair Display', fontSize: 26, fontWeight: '400', color: '#f5f5f5', textAlign: 'center', lineHeight: 1.7,
    h1Font: 'Dancing Script', h1Color: '#ffd700', h1Size: 80, h1Weight: '700',
    h2Font: 'Playfair Display', h2Color: '#ffffff', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Bold Statement', category: 'text', 
    text: '# MAKE\n\n## A Statement\n\nBe bold. Be different. Be you.',
    fontFamily: 'Montserrat', fontSize: 28, fontWeight: '600', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Anton', h1Color: '#ffffff', h1Size: 120, h1Weight: '400',
    h2Font: 'Montserrat', h2Color: '#ff6b6b', h2Size: 36, h2Weight: '700'
  },
  { 
    name: 'Minimalist', category: 'text', 
    text: '# less\n\n## is more\n\nSimplicity at its finest.',
    fontFamily: 'Inter', fontSize: 24, fontWeight: '300', color: '#cccccc', textAlign: 'center', lineHeight: 1.8,
    h1Font: 'Inter', h1Color: '#ffffff', h1Size: 64, h1Weight: '200',
    h2Font: 'Inter', h2Color: '#888888', h2Size: 32, h2Weight: '300'
  },
  { 
    name: 'Graffiti', category: 'text', 
    text: '# URBAN\n\n## Street Art\n\nThe city is our canvas.',
    fontFamily: 'Permanent Marker', fontSize: 28, fontWeight: '400', color: '#00ff88', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Permanent Marker', h1Color: '#ff00ff', h1Size: 80, h1Weight: '400',
    h2Font: 'Permanent Marker', h2Color: '#ffcc00', h2Size: 40, h2Weight: '400'
  },
  { 
    name: 'Handwritten', category: 'text', 
    text: '# dear diary\n\n## today was special\n\nSome moments are worth remembering.',
    fontFamily: 'Shadows Into Light', fontSize: 28, fontWeight: '400', color: '#ffffff', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Shadows Into Light', h1Color: '#ffb6c1', h1Size: 64, h1Weight: '400',
    h2Font: 'Shadows Into Light', h2Color: '#ffffff', h2Size: 36, h2Weight: '400'
  },
  { 
    name: 'Gradient Pop', category: 'text', 
    text: '# Gradient\n\n## Colors\n\nBlending beauty seamlessly.',
    fontFamily: 'Poppins', fontSize: 28, fontWeight: '700', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Poppins', h1Color: '#ffffff', h1Size: 80, h1Weight: '800', textGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    h2Font: 'Poppins', h2Color: '#ffffff', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Comic Style', category: 'text', 
    text: '# POW!\n\n## Action Time\n\nSuperhero energy activated!',
    fontFamily: 'Bangers', fontSize: 28, fontWeight: '400', color: '#ffcc00', textAlign: 'center', lineHeight: 1.4,
    h1Font: 'Bangers', h1Color: '#ff0000', h1Size: 96, h1Weight: '400', textStroke: '4px #000000',
    h2Font: 'Bangers', h2Color: '#00d4ff', h2Size: 40, h2Weight: '400'
  },
  { 
    name: 'Vintage Poster', category: 'text', 
    text: '# VINTAGE\n\n## Since 1920\n\nTimeless classics never go out of style.',
    fontFamily: 'Abril Fatface', fontSize: 26, fontWeight: '400', color: '#f5e6d3', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Abril Fatface', h1Color: '#8b0000', h1Size: 72, h1Weight: '400',
    h2Font: 'Lora', h2Color: '#daa520', h2Size: 28, h2Weight: '600'
  },

  // --- LIFESTYLE & INSPIRATION (41-50) ---
  { 
    name: 'Motivation', category: 'text', 
    text: '# Dream Big\n\n## Start Small\n\nEvery journey begins with a single step. 💪',
    fontFamily: 'Montserrat', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Anton', h1Color: '#ff6b6b', h1Size: 72, h1Weight: '400',
    h2Font: 'Montserrat', h2Color: '#4fc3f7', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Wellness', category: 'text', 
    text: '# Breathe\n\n## Find Your Peace\n\nMindfulness begins with a single breath. 🧘',
    fontFamily: 'Quicksand', fontSize: 26, fontWeight: '400', color: '#e0f7fa', textAlign: 'center', lineHeight: 1.75,
    h1Font: 'Dancing Script', h1Color: '#80deea', h1Size: 80, h1Weight: '700',
    h2Font: 'Quicksand', h2Color: '#ffffff', h2Size: 32, h2Weight: '500'
  },
  { 
    name: 'Fitness', category: 'text', 
    text: '# NO EXCUSES\n\n## Workout Time\n\nPush harder than yesterday. 🏋️',
    fontFamily: 'Oswald', fontSize: 28, fontWeight: '600', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Bebas Neue', h1Color: '#ff4444', h1Size: 80, h1Weight: '400',
    h2Font: 'Oswald', h2Color: '#00ff88', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Recipe Card', category: 'text', 
    text: '# Today\'s Recipe\n\n## Ingredients\n\n• 2 cups love\n• 1 tbsp patience\n• A pinch of magic',
    fontFamily: 'Nunito', fontSize: 26, fontWeight: '400', color: '#fff5e6', textAlign: 'left', lineHeight: 1.7,
    h1Font: 'Dancing Script', h1Color: '#ff9500', h1Size: 64, h1Weight: '700',
    h2Font: 'Nunito', h2Color: '#ffffff', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Fashion', category: 'text', 
    text: '# STYLE\n\n## New Collection\n\nElevate your wardrobe. ✨',
    fontFamily: 'Playfair Display', fontSize: 26, fontWeight: '400', color: '#ffffff', textAlign: 'center', lineHeight: 1.6,
    h1Font: 'Bebas Neue', h1Color: '#ffffff', h1Size: 96, h1Weight: '400',
    h2Font: 'Playfair Display', h2Color: '#ffd700', h2Size: 32, h2Weight: '600'
  },
  { 
    name: 'Quote Card', category: 'text', 
    text: '# "Be the change"\n\n## — Gandhi\n\nWords that inspire generations.',
    fontFamily: 'Merriweather', fontSize: 28, fontWeight: '400', color: '#f5f5f5', textAlign: 'center', lineHeight: 1.7,
    h1Font: 'Playfair Display', h1Color: '#ffffff', h1Size: 56, h1Weight: '600',
    h2Font: 'Inter', h2Color: '#888888', h2Size: 24, h2Weight: '500'
  },
  { 
    name: 'Music Promo', category: 'text', 
    text: '# NEW SINGLE\n\n## Out Now\n\n🎵 Stream on all platforms',
    fontFamily: 'Oswald', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.5,
    h1Font: 'Anton', h1Color: '#ff00ff', h1Size: 80, h1Weight: '400', textShadow: '0 0 20px #ff00ff',
    h2Font: 'Oswald', h2Color: '#00ffff', h2Size: 36, h2Weight: '600'
  },
  { 
    name: 'Event Invite', category: 'text', 
    text: '# You\'re Invited\n\n## Special Event\n\n📅 Date: TBD\n📍 Location: TBD',
    fontFamily: 'Georgia', fontSize: 26, fontWeight: '400', color: '#f5f5dc', textAlign: 'center', lineHeight: 1.7,
    h1Font: 'Dancing Script', h1Color: '#ffd700', h1Size: 72, h1Weight: '700',
    h2Font: 'Georgia', h2Color: '#ffffff', h2Size: 30, h2Weight: '600'
  },
  { 
    name: 'Photography', category: 'text', 
    text: '# Shot by Me\n\n## Portfolio\n\nCapturing moments, creating memories. 📷',
    fontFamily: 'Inter', fontSize: 26, fontWeight: '400', color: '#e0e0e0', textAlign: 'center', lineHeight: 1.65,
    h1Font: 'Playfair Display', h1Color: '#ffffff', h1Size: 60, h1Weight: '700',
    h2Font: 'Inter', h2Color: '#4fc3f7', h2Size: 28, h2Weight: '500'
  },
  { 
    name: 'Thank You', category: 'text', 
    text: '# Thank You\n\n## For Everything\n\nYour support means the world. ❤️',
    fontFamily: 'Nunito', fontSize: 28, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 1.65,
    h1Font: 'Dancing Script', h1Color: '#ff6b9d', h1Size: 80, h1Weight: '700',
    h2Font: 'Nunito', h2Color: '#ffffff', h2Size: 32, h2Weight: '600'
  }
];

// Animation Presets (CSS animation classes)
const ANIMATION_PRESETS = [
  { name: 'Fade In', category: 'animation', icon: '🌅', animation: 'fadeIn 0.8s ease-out forwards' },
  { name: 'Fade Out', category: 'animation', icon: '🌆', animation: 'fadeOut 0.8s ease-out forwards' },
  { name: 'Slide In Left', category: 'animation', icon: '⬅️', animation: 'slideInLeft 0.6s ease-out forwards' },
  { name: 'Slide In Right', category: 'animation', icon: '➡️', animation: 'slideInRight 0.6s ease-out forwards' },
  { name: 'Slide In Up', category: 'animation', icon: '⬆️', animation: 'slideInUp 0.6s ease-out forwards' },
  { name: 'Slide In Down', category: 'animation', icon: '⬇️', animation: 'slideInDown 0.6s ease-out forwards' },
  { name: 'Zoom In', category: 'animation', icon: '🔍', animation: 'zoomIn 0.5s ease-out forwards' },
  { name: 'Zoom Out', category: 'animation', icon: '🔎', animation: 'zoomOut 0.5s ease-out forwards' },
  { name: 'Pop In', category: 'animation', icon: '💥', animation: 'popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards' },
  { name: 'Bounce In', category: 'animation', icon: '🏀', animation: 'bounceIn 0.8s ease-out forwards' },
  { name: 'Spin In', category: 'animation', icon: '🌀', animation: 'spinIn 0.6s ease-out forwards' },
  { name: 'Flip In', category: 'animation', icon: '🔄', animation: 'flipIn 0.6s ease-out forwards' },
  { name: 'Pulse', category: 'animation', icon: '💓', animation: 'pulse 1.5s ease-in-out infinite' },
  { name: 'Bounce', category: 'animation', icon: '⚡', animation: 'bounce 1s ease-in-out infinite' },
  { name: 'Float', category: 'animation', icon: '🎈', animation: 'float 3s ease-in-out infinite' },
  { name: 'Shake', category: 'animation', icon: '📳', animation: 'shake 0.5s ease-in-out' },
  { name: 'Wobble', category: 'animation', icon: '🎭', animation: 'wobble 1s ease-in-out infinite' },
  { name: 'Spin', category: 'animation', icon: '🔁', animation: 'spin 2s linear infinite' },
  { name: 'Breathe', category: 'animation', icon: '🌬️', animation: 'breathe 3s ease-in-out infinite' },
  { name: 'Swing', category: 'animation', icon: '🎪', animation: 'swing 1.5s ease-in-out infinite' },
  { name: 'Rubber Band', category: 'animation', icon: '🪀', animation: 'rubberBand 0.8s ease-out' },
  { name: 'Jello', category: 'animation', icon: '🍮', animation: 'jello 1s ease-in-out' },
  { name: 'Heart Beat', category: 'animation', icon: '❤️', animation: 'heartBeat 1.3s ease-in-out infinite' },
  { name: 'Flash', category: 'animation', icon: '⚡', animation: 'flash 1s ease-in-out' },
  { name: 'Tada', category: 'animation', icon: '🎉', animation: 'tada 1s ease-in-out' },
  { name: 'Wiggle', category: 'animation', icon: '〰️', animation: 'wiggle 0.5s ease-in-out infinite' },
  { name: 'Glow', category: 'animation', icon: '✨', animation: 'glow 2s ease-in-out infinite' },
  { name: 'Typewriter', category: 'animation', icon: '⌨️', animation: 'typewriter 2s steps(20) forwards' },
  { name: 'Blur In', category: 'animation', icon: '🌫️', animation: 'blurIn 0.6s ease-out forwards' },
  { name: 'Drop In', category: 'animation', icon: '💧', animation: 'dropIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards' },
  { name: 'None', category: 'animation', icon: '⏹️', animation: 'none' }
];

// Image Effect Presets (CSS filters)
const IMAGE_PRESETS = [
  { name: 'Normal', category: 'image', filter: 'none' },
  { name: 'Grayscale', category: 'image', filter: 'grayscale(100%)' },
  { name: 'Sepia', category: 'image', filter: 'sepia(100%)' },
  { name: 'Vintage', category: 'image', filter: 'sepia(50%) contrast(85%) brightness(95%)' },
  { name: 'High Contrast', category: 'image', filter: 'contrast(150%)' },
  { name: 'Brightness', category: 'image', filter: 'brightness(120%)' },
  { name: 'Dim', category: 'image', filter: 'brightness(70%)' },
  { name: 'Saturated', category: 'image', filter: 'saturate(200%)' },
  { name: 'Desaturated', category: 'image', filter: 'saturate(50%)' },
  { name: 'Warm', category: 'image', filter: 'sepia(30%) saturate(120%) brightness(105%)' },
  { name: 'Cool', category: 'image', filter: 'hue-rotate(180deg) saturate(80%)' },
  { name: 'Invert', category: 'image', filter: 'invert(100%)' },
  { name: 'Blur Light', category: 'image', filter: 'blur(2px)' },
  { name: 'Blur Heavy', category: 'image', filter: 'blur(8px)' },
  { name: 'Sharp', category: 'image', filter: 'contrast(110%) brightness(105%)' },
  { name: 'Drama', category: 'image', filter: 'contrast(130%) brightness(90%) saturate(120%)' },
  { name: 'Fade', category: 'image', filter: 'brightness(110%) contrast(80%) saturate(80%)' },
  { name: 'Pop', category: 'image', filter: 'contrast(120%) saturate(130%) brightness(105%)' }
];

// Common Emojis for quick insert
const EMOJI_LIST = ['😀','😍','🥳','🔥','✨','💯','❤️','🎉','👍','🙌','😎','🤩','💪','🌟','⭐','🎊','🎁','🏆','💎','🌈','☀️','🌙','💫','🚀','💥','🎵','🎶','💕','💖','💗','😊','🤗','😇','🥰','😘','📍','📸','🎬','💬','👀','🙏','💡','⚡','🔔','📌','✅','❌','➡️','⬆️'];

const STAGE_W = 1080;
const STAGE_H = 1920;

// Nodes
const els = {
  app: document.querySelector('.app'),
  sidebar: document.querySelector('.sidebar'),
  resizer: document.getElementById('sidebar-resizer'),
  viewport: document.getElementById('viewport'),
  stage: document.getElementById('stage'),
  scaler: document.getElementById('stage-scaler'),
  layerList: document.getElementById('layer-list'),
  presetSlots: document.getElementById('element-preset-slots'),
  navBtns: document.querySelectorAll('.tool-btn'),
  views: document.querySelectorAll('.panel-view'),
  uploadHidden: document.getElementById('file-upload-hidden'),
  
  // Background Settings
  globalBgColor: document.getElementById('global-bg-color'),
  globalBgImg: document.getElementById('global-bg-img'),
  globalBgVideo: document.getElementById('global-bg-video'),
  clearGlobalBg: document.getElementById('clear-global-bg'),
  clearGlobalBgVideo: document.getElementById('clear-global-bg-video'),
  bgType: document.getElementById('bg-type'),
  bgControls: {
    color: document.getElementById('bg-controls-color'),
    gradient: document.getElementById('bg-controls-gradient'),
    image: document.getElementById('bg-controls-image'),
    video: document.getElementById('bg-controls-video')
  },
  bgGradType: document.getElementById('bg-grad-type'),
  gradAngle: document.getElementById('bg-grad-angle'),
  gradStart: document.getElementById('bg-grad-start'),
  gradEnd: document.getElementById('bg-grad-end'),
  applyGrad: document.getElementById('apply-gradient'),
  gradPresets: document.querySelectorAll('.grad-preset'),
  bgImageFit: document.getElementById('bg-image-fit'),
  bgImagePosition: document.getElementById('bg-image-position'),
  bgOverlayEnabled: document.getElementById('bg-overlay-enabled'),
  bgOverlayColor: document.getElementById('bg-overlay-color'),
  bgOverlayOpacity: document.getElementById('bg-overlay-opacity'),
  bgOverlayControls: document.getElementById('bg-overlay-controls'),

  zoomLevel: document.getElementById('zoom-level')
};

/* --- PERSISTENCE --- */
function saveState() {
  localStorage.setItem('storygen_state_v2', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('storygen_state_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge to ensure new fields (like bgType) exist
      state = { ...state, ...parsed, global: { ...state.global, ...parsed.global } };
      // Reset transient
      state.selectedId = null;
      state.editingId = null;
      state.draggingId = null;
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }
}

/* --- CORE: Render --- */

function renderStage() {
  // Styles for stage
  // BG Handling
  const g = state.global;
  els.stage.style.background = 'none';
  els.stage.style.backgroundColor = 'transparent';
  els.stage.style.backgroundImage = 'none';
  
  // Remove any existing background video element
  const existingBgVideo = els.stage.querySelector('.bg-video');
  if (existingBgVideo) existingBgVideo.remove();
  
  // Remove any existing overlay element
  const existingOverlay = els.stage.querySelector('.bg-overlay');
  if (existingOverlay) existingOverlay.remove();

  if (g.bgType === 'color' || !g.bgType) {
      els.stage.style.backgroundColor = g.bgColor;
  } else if (g.bgType === 'gradient') {
      els.stage.style.backgroundImage = g.bgGradient;
  } else if (g.bgType === 'image') {
      if (g.bgImg) {
        els.stage.style.backgroundImage = `url("${g.bgImg}")`;
        els.stage.style.backgroundSize = g.bgImageFit || 'cover';
        els.stage.style.backgroundPosition = g.bgImagePosition || 'center';
        els.stage.style.backgroundRepeat = g.bgImageFit === 'tile' ? 'repeat' : 'no-repeat';
      } else {
        els.stage.style.backgroundColor = '#111'; // fallback
      }
  } else if (g.bgType === 'video') {
      if (g.bgVideo) {
        // Create video element as background
        const vid = document.createElement('video');
        vid.className = 'bg-video';
        vid.src = g.bgVideo;
        vid.muted = true;
        vid.loop = true;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.style.cssText = `
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          object-fit: ${g.bgVideoFit || 'cover'};
          z-index: 0;
          pointer-events: none;
        `;
        els.stage.appendChild(vid);
      } else {
        els.stage.style.backgroundColor = '#111';
      }
  }
  
  // Add overlay if enabled
  if (g.bgOverlay && (g.bgType === 'image' || g.bgType === 'video')) {
    const overlay = document.createElement('div');
    overlay.className = 'bg-overlay';
    const opacity = (g.bgOverlayOpacity ?? 50) / 100;
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: ${g.bgOverlayColor || '#000000'};
      opacity: ${opacity};
      z-index: 1;
      pointer-events: none;
    `;
    els.stage.appendChild(overlay);
  }

  // Render Layers (clear existing non-bg elements)
  const elementsToRemove = els.stage.querySelectorAll('.el, .guide');
  elementsToRemove.forEach(el => el.remove());
  state.layers.forEach(layer => {
    if (layer.type === 'group') return; // Groups are virtual folders
    const el = document.createElement('div');
    el.className = `el el-${layer.type}`;
    if (layer.id === state.selectedId && state.editingId !== layer.id) {
        el.classList.add('selected');
        // Add Resize Handles (corners)
        ['nw', 'ne', 'sw', 'se'].forEach(pos => {
            const h = document.createElement('div');
            h.className = `resize-handle rh-${pos}`;
            h.dataset.id = layer.id;
            h.dataset.pos = pos;
            h.addEventListener('mousedown', onResizeMouseDown);
            h.addEventListener('touchstart', onResizeTouchStart, { passive: false });
            el.appendChild(h);
        });
        // Add Rotation Handle (top center)
        const rotHandle = document.createElement('div');
        rotHandle.className = 'rotate-handle';
        rotHandle.dataset.id = layer.id;
        rotHandle.addEventListener('mousedown', onRotateMouseDown);
        rotHandle.addEventListener('touchstart', onRotateTouchStart, { passive: false });
        el.appendChild(rotHandle);
    }

    // Position & Scale (Instagram style: use transform scale instead of width/height)
    el.style.left = layer.x + 'px';
    el.style.top = layer.y + 'px';
    
    // Apply scale transform for Instagram-like resizing
    const scale = layer.scale || 1;
    const rotation = layer.rotation || 0;
    el.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    
    // Base dimensions (used before scaling)
    if (layer.width) el.style.width = layer.width + 'px';
    if (layer.height && layer.type !== 'text') el.style.height = layer.height + 'px';

    if (layer.type === 'text') {
      // In-place editing mode
      if (state.editingId === layer.id) {
         el.innerHTML = ''; // clear
         el.classList.add('editing');
         const area = document.createElement('textarea');
         area.className = 'el-edit-area';
         area.value = layer.text;
         // Stop propagation to prevent drag on both mouse and touch
         area.addEventListener('mousedown', e => e.stopPropagation());
         area.addEventListener('touchstart', e => e.stopPropagation());
         area.addEventListener('blur', () => {
             updateLayer(layer.id, { text: area.value });
             state.editingId = null;
             renderAll();
         });
         // Auto expand or fixed size? Let's fill the box or min size
         el.appendChild(area);
         setTimeout(() => area.focus(), 50);
      } else {
        // Styles
        el.style.color = layer.color;
        el.style.fontSize = layer.fontSize + 'px';
        el.style.fontFamily = layer.fontFamily;
        el.style.fontWeight = layer.fontWeight;
        el.style.lineHeight = layer.lineHeight;
        el.style.textAlign = layer.textAlign;
        el.style.opacity = layer.opacity;
        
        // Text shadow
        if (layer.textShadow) {
          el.style.textShadow = layer.textShadow;
        }
        
        // Text stroke (webkit)
        if (layer.textStroke) {
          el.style.webkitTextStroke = layer.textStroke;
        }
        
        if (layer.bgColor) {
          el.style.backgroundColor = layer.bgColor;
          el.style.padding = layer.padding + 'px';
          el.style.borderRadius = layer.borderRadius + 'px';
        }
        
        // Text gradient background
        if (layer.textGradient) {
          el.style.background = layer.textGradient;
          el.style.webkitBackgroundClip = 'text';
          el.style.webkitTextFillColor = 'transparent';
          el.style.backgroundClip = 'text';
        }

        // Markdown
        const content = document.createElement('div');
        content.className = 'el-text-content';
        content.innerHTML = marked.parse(layer.text);
        
        // Apply markdown-specific styles via CSS custom properties
        if (layer.h1Font) content.style.setProperty('--h1-font', layer.h1Font);
        if (layer.h1Color) content.style.setProperty('--h1-color', layer.h1Color);
        if (layer.h1Size) content.style.setProperty('--h1-size', layer.h1Size + 'px');
        if (layer.h1Weight) content.style.setProperty('--h1-weight', layer.h1Weight);
        if (layer.h2Font) content.style.setProperty('--h2-font', layer.h2Font);
        if (layer.h2Color) content.style.setProperty('--h2-color', layer.h2Color);
        if (layer.h2Size) content.style.setProperty('--h2-size', layer.h2Size + 'px');
        if (layer.h2Weight) content.style.setProperty('--h2-weight', layer.h2Weight);
        if (layer.h3Font) content.style.setProperty('--h3-font', layer.h3Font);
        if (layer.h3Color) content.style.setProperty('--h3-color', layer.h3Color);
        if (layer.h3Size) content.style.setProperty('--h3-size', layer.h3Size + 'px');
        if (layer.h3Weight) content.style.setProperty('--h3-weight', layer.h3Weight);
        
        el.appendChild(content);
      }
      
      // Double click to edit (desktop) - attach to element itself
      el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (state.editingId !== layer.id) {
              state.editingId = layer.id;
              renderStage();
          }
      });
      
      // Double tap to edit (mobile)
      let lastTapTime = 0;
      el.addEventListener('touchend', (e) => {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTapTime;
          if (tapLength < 300 && tapLength > 0) {
              e.preventDefault();
              e.stopPropagation();
              if (state.editingId !== layer.id) {
                  state.editingId = layer.id;
                  renderStage();
              }
          }
          lastTapTime = currentTime;
      });

    } else if (layer.type === 'image') {
      el.style.opacity = layer.opacity;
      const img = document.createElement('img');
      img.src = layer.src;
      img.style.objectFit = layer.mode || 'cover';
      img.style.width = '100%';
      img.style.height = '100%';
      if (layer.filter && layer.filter !== 'none') {
        img.style.filter = layer.filter;
      }
      el.appendChild(img);
    } else if (layer.type === 'video') {
      el.style.opacity = layer.opacity;
      const vid = document.createElement('video');
      vid.src = layer.src;
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.style.objectFit = layer.mode || 'cover';
      vid.style.width = '100%';
      vid.style.height = '100%';
      vid.style.pointerEvents = 'none';
      if (layer.filter && layer.filter !== 'none') {
        vid.style.filter = layer.filter;
      }
      el.appendChild(vid);
    } else if (layer.type === 'audio') {
      // Audio layers are hidden but still part of the project
      el.style.display = 'none';
      const audio = document.createElement('audio');
      audio.src = layer.src;
      audio.loop = true;
      audio.id = `audio-${layer.id}`;
      el.appendChild(audio);
    }

    // Drag handlers (only if not editing)
    if (state.editingId !== layer.id) {
        el.dataset.id = layer.id;
        el.dataset.layerId = layer.id;
        el.addEventListener('mousedown', onMouseDownLayer);
    }
    
    // Apply CSS animation if set - use wrapper to preserve rotation
    if (layer.animation && layer.animation !== 'none') {
      // Wrap all content in an animation container
      const animWrapper = document.createElement('div');
      animWrapper.className = 'anim-wrapper';
      animWrapper.style.animation = layer.animation;
      animWrapper.style.width = '100%';
      animWrapper.style.height = '100%';
      
      // Move all children (except handles) into the wrapper
      const children = Array.from(el.children).filter(child => 
        !child.classList.contains('resize-handle') && 
        !child.classList.contains('rotate-handle')
      );
      children.forEach(child => animWrapper.appendChild(child));
      
      // Insert wrapper before handles
      const firstHandle = el.querySelector('.resize-handle, .rotate-handle');
      if (firstHandle) {
        el.insertBefore(animWrapper, firstHandle);
      } else {
        el.appendChild(animWrapper);
      }
    }

    els.stage.appendChild(el);
  });
}

function renderSidebar(skipInputs = false) {
  // 1. Layer List
  els.layerList.innerHTML = '';
  
  // Build Tree
  // We want to render in Reverse Order (Top visual layer first)
  // But we need to handle hierarchy. 
  // Map layers by ID
  const map = {};
  state.layers.forEach(l => { 
      map[l.id] = { ...l, children: [] }; 
  });
  
  const roots = [];
  // Populate children
  state.layers.forEach(l => {
      if (l.parentId && map[l.parentId]) {
          map[l.parentId].children.push(map[l.id]);
      } else {
          roots.push(map[l.id]);
      }
  });

  // Helper to render a node
  function renderNode(layer, container) {
      const node = document.createElement('div');
      node.className = 'layer-tree-node';
      
      const item = document.createElement('div');
      item.className = `layer-item ${layer.id === state.selectedId ? 'selected' : ''}`;
      if (layer.type === 'group') item.classList.add('layer-group-header');
      
      item.draggable = true;
      item.dataset.id = layer.id;

      let icon = '';
      if (layer.type === 'image') icon = '📷 ';
      if (layer.type === 'text') icon = 'T ';
      if (layer.type === 'video') icon = '🎥 ';
      if (layer.type === 'audio') icon = '🎵 ';
      if (layer.type === 'group') icon = '📁 ';

      const displayName = layer.type === 'text' 
          ? (layer.text?.slice(0, 15) || 'Text') 
          : (layer.type === 'audio' ? (layer.name || 'Audio') : (layer.name || layer.type));

      item.innerHTML = `
        <span class="name" data-act="name">${icon} ${displayName}</span>
        <span class="del" data-act="delete" data-id="${layer.id}">×</span>
      `;
      
      // Events
      item.onclick = (e) => {
        if (e.target.dataset.act === 'delete') {
          e.stopPropagation();
          removeLayer(layer.id);
        } else {
          selectLayer(layer.id);
        }
      };
      
      // Double click to rename (for groups)
      if (layer.type === 'group') {
          item.ondblclick = (e) => {
              e.stopPropagation();
              const nameSpan = item.querySelector('.name');
              const input = document.createElement('input');
              input.className = 'layer-rename-input';
              input.value = layer.name || 'Folder';
              nameSpan.innerHTML = '';
              nameSpan.appendChild(input);
              input.focus();
              input.select();
              
              const finish = () => {
                  updateLayer(layer.id, { name: input.value || 'Folder' });
              };
              input.onblur = finish;
              input.onkeydown = (ev) => {
                  if (ev.key === 'Enter') { input.blur(); }
                  if (ev.key === 'Escape') { renderSidebar(); }
              };
          };
      }
      
      // DnD
      setupDnD(item, layer.id);

      node.appendChild(item);

      // Children
      if (layer.children.length > 0) {
          const childrenCont = document.createElement('div');
          childrenCont.className = 'layer-children';
          // Render children reversed (top first)
          [...layer.children].reverse().forEach(child => renderNode(child, childrenCont));
          node.appendChild(childrenCont);
      }
      container.appendChild(node);
  }

  // Render Roots Reversed
  [...roots].reverse().forEach(root => renderNode(root, els.layerList));


  // 2. Preset Slots Panel - show when element selected
  renderPresetSlots();

  // 3. Background UI
  if (state.view === 'background') {
     els.bgType.value = state.global.bgType || 'color';
     // Hide all bg control groups first
     Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
     // Show the active one
     const activeBgControl = els.bgControls[state.global.bgType || 'color'];
     if (activeBgControl) activeBgControl.style.display = 'block';
  }
}

function renderPresetSlots() {
  const selLayer = state.layers.find(l => l.id === state.selectedId);
  if (!selLayer || selLayer.type === 'group') {
    if (els.presetSlots) els.presetSlots.style.display = 'none';
    return;
  }
  
  if (els.presetSlots) {
    els.presetSlots.style.display = 'block';
    
    // Update slot contents and visibility based on layer's type and applied presets
    const slots = els.presetSlots.querySelectorAll('.slot-row');
    slots.forEach(slotRow => {
      const slot = slotRow.querySelector('.slot-box');
      if (!slot) return;
      
      const slotType = slot.dataset.slot;
      const appliedPreset = selLayer[`appliedPreset_${slotType}`];
      
      // Show/hide slots based on element type
      if (slotType === 'style') {
        // Style slot only for text elements
        slotRow.style.display = selLayer.type === 'text' ? 'flex' : 'none';
      } else if (slotType === 'filter') {
        // Filter slot only for image/video elements
        slotRow.style.display = (selLayer.type === 'image' || selLayer.type === 'video') ? 'flex' : 'none';
      } else if (slotType === 'animation') {
        // Animation slot for all non-group elements
        slotRow.style.display = 'flex';
      }
      
      if (appliedPreset) {
        slot.classList.add('slot-filled');
        slot.classList.remove('slot-empty');
        slot.innerHTML = `<span class="slot-name">${appliedPreset}</span><span class="slot-clear" data-slot="${slotType}">×</span>`;
      } else {
        slot.classList.remove('slot-filled');
        slot.classList.add('slot-empty');
        const labels = { style: 'Style', filter: 'Filter', animation: 'Animation' };
        slot.innerHTML = `<span class="slot-empty-text">+ ${labels[slotType]}</span>`;
      }
    });
  }
}

function setupDnD(item, id) {
    item.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', id);
      item.classList.add('dragging');
      state.draggingLayerId = id;
    };
    item.ondragend = () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-middle').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
        });
        state.draggingLayerId = null;
    };
    item.ondragover = (e) => {
       e.preventDefault();
       if (state.draggingLayerId === id) return; // ignore self
       
       const rect = item.getBoundingClientRect();
       const relY = e.clientY - rect.top;
       const height = rect.height;
       
       item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
       
       // Top 25%, Bottom 25%, Middle 50%
       if (relY < height * 0.25) {
           item.classList.add('drag-over-top');
           item.dataset.dropPos = 'before';
       } else if (relY > height * 0.75) {
           item.classList.add('drag-over-bottom');
           item.dataset.dropPos = 'after';
       } else {
           item.classList.add('drag-over-middle'); // Grouping
           item.dataset.dropPos = 'inside';
       }
    };
    item.ondragleave = () => {
       item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
    };
    item.ondrop = (e) => {
       e.preventDefault();
       const fromId = e.dataTransfer.getData('text/plain');
       if (!fromId || fromId === id) return;
       
       const action = item.dataset.dropPos; // before, after, inside
       performDrop(fromId, id, action);
    };
}

function performDrop(fromId, toId, action) {
    // Logic to move layers
    if (fromId === toId) return;
    
    // Find objects
    const fromL = state.layers.find(l => l.id === fromId);
    const toL = state.layers.find(l => l.id === toId);
    if (!fromL || !toL) return;

    if (action === 'inside') {
        // Grouping
        if (toL.type === 'group') {
            // Add to existing group
            fromL.parentId = toL.id;
        } else {
            // Create new group containing both
            // Remove 'from' temporarily? No need, just update state.
            // Create Group at 'to' position
            const groupId = Date.now().toString(36) + '_grp';
            const group = {
                id: groupId,
                type: 'group',
                name: 'Folder',
                x: 0, y: 0, // virtual
                parentId: toL.parentId, // sibling to target
                expanded: true
            };
            
            // Insert Group where ToL is
            const idx = state.layers.indexOf(toL);
            state.layers.splice(idx, 0, group);
            
            // Move items into group
            toL.parentId = groupId;
            fromL.parentId = groupId;
            
            // Fix: ensure 'from' is removed from its old location? 
            // state.layers structure is flat list. Order matters for rendering.
            // We should ensure 'from' comes AFTER 'group' in the flat list if it's a child?
            // Actually for "Folder" logic, flat list order is Z-index.
            // Children should probably be physically near parent in list?
            // Sidebar visualizes hierarchy, Stage renders flat list Z-index.
            // So simpler: just set parentId. Sidebar handles visuals.
        }
    } else {
        // Reordering
        // Remove 'from'
        const fromIdx = state.layers.indexOf(fromL);
        state.layers.splice(fromIdx, 1);
        
        // Find 'to' new index (it might have shifted)
        let toIdx = state.layers.indexOf(toL);
        
        // logic: 'before' in sidebar (Top visual) means 'after' in array (Higher Z-index)?
        // Sidebar renders Reversed array. Top of sidebar = End of array.
        // So 'before' sidebar = 'after' array.
        
        if (action === 'before') {
             // Place visually above -> Higher Index
             state.layers.splice(toIdx + 1, 0, fromL);
        } else {
             // Place visually below -> Lower Index
             state.layers.splice(toIdx, 0, fromL);
        }
        
        // If we move to root, clear parent
        if (toL.parentId) {
            fromL.parentId = toL.parentId;
        } else {
            fromL.parentId = null;
        }
    }
    
    saveState();
    renderAll();
}

function renderProps(layer) {
  // Destroy existing Pickr instances
  Object.values(pickrInstances).forEach(p => p && p.destroyAndRemove && p.destroyAndRemove());
  Object.keys(pickrInstances).forEach(k => delete pickrInstances[k]);
  
  let html = `<div class="prop-group">
    <label>Position & Transform</label>
    <div class="row">
      <label>X <input type="number" data-prop="x" value="${Math.round(layer.x)}"></label>
      <label>Y <input type="number" data-prop="y" value="${Math.round(layer.y)}"></label>
    </div>
    <div class="row" style="margin-top:8px">
      <label>Scale <input type="number" step="0.1" min="0.1" max="5" data-prop="scale" value="${layer.scale || 1}"></label>
      <label>Rotate <span class="input-unit"><input type="number" step="1" data-prop="rotation" value="${layer.rotation || 0}"><span class="unit">°</span></span></label>
    </div>
    <div style="margin-top:8px">
      <label style="display:block; margin-bottom:4px">Snap to Center</label>
      <div class="align-buttons">
        <button class="align-btn" data-align="h-center" title="Center Horizontally">↔</button>
        <button class="align-btn" data-align="v-center" title="Center Vertically">↕</button>
        <button class="align-btn" data-align="center" title="Center Both">⊕</button>
        <button class="align-btn" data-align="left" title="Align Left">⇤</button>
        <button class="align-btn" data-align="right" title="Align Right">⇥</button>
        <button class="align-btn" data-align="top" title="Align Top">⤒</button>
        <button class="align-btn" data-align="bottom" title="Align Bottom">⤓</button>
      </div>
    </div>
  </div>`;

  if (layer.type === 'text') {
    const fontOptions = FONTS.map(f => `<option value="${f}" ${layer.fontFamily === f ? 'selected' : ''}>${f}</option>`).join('');
    const emojiButtons = EMOJI_LIST.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
    
    html += `
      <div class="prop-group">
        <label>Content (Markdown)</label>
        <textarea rows="4" data-prop="text">${layer.text}</textarea>
        <div style="font-size:10px; color:#666; margin-top:4px">Tip: Double-click text on stage to edit. Use emojis! 😊🎉</div>
      </div>
      <div class="prop-group">
        <label>Font</label>
        <div class="row">
          <label>Size <input type="number" data-prop="fontSize" value="${layer.fontSize}"></label>
          <label>Family
             <select data-prop="fontFamily">
               ${fontOptions}
             </select>
          </label>
        </div>
        <div class="row" style="margin-top:8px">
          <label>Weight
             <select data-prop="fontWeight">
               <option value="400" ${layer.fontWeight === '400' ? 'selected' : ''}>Regular</option>
               <option value="600" ${layer.fontWeight === '600' ? 'selected' : ''}>SemiBold</option>
               <option value="700" ${layer.fontWeight === '700' ? 'selected' : ''}>Bold</option>
               <option value="900" ${layer.fontWeight === '900' ? 'selected' : ''}>Black</option>
             </select>
          </label>
          <label>Align 
            <select data-prop="textAlign">
              <option value="left" ${layer.textAlign === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${layer.textAlign === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${layer.textAlign === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </label>
        </div>
        <div class="row" style="margin-top:8px">
          <label>Line H <input type="number" step="0.1" data-prop="lineHeight" value="${layer.lineHeight}"></label>
          <label>Opacity <input type="number" step="0.1" min="0" max="1" data-prop="opacity" value="${layer.opacity}"></label>
        </div>
      </div>
      <div class="prop-group">
        <label>Text Color</label>
        <div class="color-picker-row">
          <div id="pickr-text-color"></div>
        </div>
      </div>
      <div class="prop-group">
        <label>Text Effects</label>
        <div class="row">
          <label>Shadow
            <select data-prop="textShadow">
              <option value="" ${!layer.textShadow ? 'selected' : ''}>None</option>
              <option value="2px 2px 4px rgba(0,0,0,0.5)" ${layer.textShadow === '2px 2px 4px rgba(0,0,0,0.5)' ? 'selected' : ''}>Soft</option>
              <option value="3px 3px 0px #000" ${layer.textShadow === '3px 3px 0px #000' ? 'selected' : ''}>Hard</option>
              <option value="0 0 10px currentColor" ${layer.textShadow === '0 0 10px currentColor' ? 'selected' : ''}>Glow</option>
              <option value="4px 4px 8px rgba(0,0,0,0.8)" ${layer.textShadow === '4px 4px 8px rgba(0,0,0,0.8)' ? 'selected' : ''}>Deep</option>
            </select>
          </label>
          <label>Stroke
            <select data-prop="textStroke">
              <option value="" ${!layer.textStroke ? 'selected' : ''}>None</option>
              <option value="1px black" ${layer.textStroke === '1px black' ? 'selected' : ''}>Thin Black</option>
              <option value="2px black" ${layer.textStroke === '2px black' ? 'selected' : ''}>Medium Black</option>
              <option value="1px white" ${layer.textStroke === '1px white' ? 'selected' : ''}>Thin White</option>
              <option value="2px white" ${layer.textStroke === '2px white' ? 'selected' : ''}>Medium White</option>
            </select>
          </label>
        </div>
      </div>
      <div class="prop-group">
        <label>Background Box</label>
        <div class="color-picker-row">
          <div id="pickr-bg-color"></div>
          <input type="checkbox" id="bg-enabled" ${layer.bgColor ? 'checked' : ''}> Enable
        </div>
        <div class="row" style="margin-top:8px">
           <label>Pad <input type="number" data-prop="padding" value="${layer.padding || 16}"></label>
           <label>Radius <input type="number" data-prop="borderRadius" value="${layer.borderRadius || 12}"></label>
        </div>
      </div>
      <div class="prop-group">
        <label>Text Gradient</label>
        <select id="text-gradient-preset">
          <option value="" ${!layer.textGradient ? 'selected' : ''}>None (Use solid color)</option>
          <option value="linear-gradient(45deg, #f3ec78, #af4261)" ${layer.textGradient?.includes('#f3ec78') ? 'selected' : ''}>Sunset</option>
          <option value="linear-gradient(to right, #00c6ff, #0072ff)" ${layer.textGradient?.includes('#00c6ff') ? 'selected' : ''}>Ocean</option>
          <option value="linear-gradient(to right, #f857a6, #ff5858)" ${layer.textGradient?.includes('#f857a6') ? 'selected' : ''}>Pink</option>
          <option value="linear-gradient(to right, #11998e, #38ef7d)" ${layer.textGradient?.includes('#11998e') ? 'selected' : ''}>Mint</option>
          <option value="linear-gradient(to right, #fc466b, #3f5efb)" ${layer.textGradient?.includes('#fc466b') ? 'selected' : ''}>Vivid</option>
          <option value="custom">Custom...</option>
        </select>
        <div id="custom-gradient-editor" class="gradient-editor" style="display:${layer.textGradient && !['', 'linear-gradient(45deg, #f3ec78, #af4261)', 'linear-gradient(to right, #00c6ff, #0072ff)', 'linear-gradient(to right, #f857a6, #ff5858)', 'linear-gradient(to right, #11998e, #38ef7d)', 'linear-gradient(to right, #fc466b, #3f5efb)'].includes(layer.textGradient) ? 'block' : 'none'}">
          <div id="grad-preview" class="gradient-preview" style="background: ${layer.textGradient || 'linear-gradient(90deg, #ff0000, #0000ff)'}"></div>
          <div class="row">
            <label>Angle <span class="input-unit"><input type="number" id="grad-angle" value="${layer.gradAngle || 90}" min="0" max="360"><span class="unit">°</span></span></label>
          </div>
          <div class="gradient-stops">
            <div class="gradient-stop">
              <span>Start</span>
              <input type="color" id="grad-color1" value="${layer.gradColor1 || '#ff0000'}">
            </div>
            <div class="gradient-stop">
              <span>End</span>
              <input type="color" id="grad-color2" value="${layer.gradColor2 || '#0000ff'}">
            </div>
          </div>
          <button id="apply-text-gradient" class="btn-sm" style="width:100%; margin-top:8px">Apply Gradient</button>
        </div>
      </div>
      <div class="prop-group">
        <label>Quick Emoji Insert</label>
        <div class="emoji-picker-inline" id="emoji-picker">
          ${emojiButtons}
        </div>
      </div>
    `;
  } else if (layer.type === 'image' || layer.type === 'video') {
    html += `
      <div class="prop-group">
        <label>Dimensions</label>
        <div class="row">
          <label>W <input type="number" data-prop="width" value="${layer.width || 400}"></label>
          <label>H <input type="number" data-prop="height" value="${layer.height || 400}"></label>
        </div>
      </div>
      <div class="prop-group">
        <label>Fit Mode</label>
        <select data-prop="mode">
          <option value="cover" ${layer.mode === 'cover' ? 'selected' : ''}>Cover (fill, crop)</option>
          <option value="contain" ${layer.mode === 'contain' ? 'selected' : ''}>Contain (fit inside)</option>
          <option value="fill" ${layer.mode === 'fill' ? 'selected' : ''}>Fill (stretch)</option>
          <option value="none" ${layer.mode === 'none' ? 'selected' : ''}>None (original size)</option>
        </select>
      </div>
      <div class="prop-group">
         <label>Opacity <input type="number" step="0.1" min="0" max="1" data-prop="opacity" value="${layer.opacity}"></label>
      </div>
      <div class="prop-group">
        <label>Filter Effect</label>
        <select data-prop="filter">
          ${IMAGE_PRESETS.map(p => `<option value="${p.filter}" ${layer.filter === p.filter ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      ${layer.type === 'video' ? `<div class="prop-group" style="font-size:11px; color:#888">Video loops automatically. Export captures current frame for images.</div>` : ''}
    `;
  } else if (layer.type === 'audio') {
    html += `
      <div class="prop-group">
        <label>Audio File</label>
        <div style="font-size:12px; color:var(--text-muted); word-break:break-all;">${layer.name || 'Audio Track'}</div>
      </div>
      <div class="prop-group">
        <label>Playback Controls</label>
        <div style="display:flex; gap:8px;">
          <button type="button" id="audio-play" class="btn-sm" style="flex:1">▶️ Play</button>
          <button type="button" id="audio-stop" class="btn-sm" style="flex:1">⏹️ Stop</button>
        </div>
      </div>
      <div class="prop-group">
        <label>Volume <input type="range" id="audio-volume" min="0" max="1" step="0.1" value="${layer.volume || 1}" style="width:100%"></label>
      </div>
      <div class="prop-group" style="font-size:11px; color:#888">
        Audio will be included when exporting as video. For image export, audio is not included.
      </div>
    `;
  } else if (layer.type === 'group') {
    html += `
      <div class="prop-group">
        <label>Folder Name</label>
        <input type="text" data-prop="name" value="${layer.name || 'Folder'}">
      </div>
      <div class="prop-group" style="font-size:11px; color:#888">
        Double-click in the layer list to rename. Drag other layers onto this folder to add them.
      </div>
    `;
  }

  // Add animation section for all layers (except groups)
  if (layer.type !== 'group') {
    const currentAnim = layer.animation || 'none';
    const animOptions = ANIMATION_PRESETS.map(p => 
      `<option value="${p.animation}" ${currentAnim === p.animation ? 'selected' : ''}>${p.icon} ${p.name}</option>`
    ).join('');
    
    html += `
      <div class="prop-group" style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
        <label>Animation</label>
        <select data-prop="animation">
          ${animOptions}
        </select>
        <button type="button" id="replay-animation" class="btn-sm" style="width:100%; margin-top:8px">
          ▶️ Replay Animation
        </button>
      </div>
    `;
  }

  els.propsForm.innerHTML = html;
  
  // Initialize Pickr color pickers for text
  if (layer.type === 'text') {
    setTimeout(() => {
      // Text color picker
      const textColorEl = document.getElementById('pickr-text-color');
      if (textColorEl && typeof Pickr !== 'undefined') {
        pickrInstances.textColor = Pickr.create({
          el: textColorEl,
          theme: 'nano',
          default: layer.color || '#ffffff',
          components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: { hex: true, rgba: true, input: true, save: true }
          }
        });
        pickrInstances.textColor.on('save', (color) => {
          if (color) {
            updateLayer(layer.id, { color: color.toHEXA().toString() }, true);
          }
          pickrInstances.textColor.hide();
        });
      }
      
      // Background color picker
      const bgColorEl = document.getElementById('pickr-bg-color');
      if (bgColorEl && typeof Pickr !== 'undefined') {
        pickrInstances.bgColor = Pickr.create({
          el: bgColorEl,
          theme: 'nano',
          default: layer.bgColor || '#000000',
          components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: { hex: true, rgba: true, input: true, save: true }
          }
        });
        pickrInstances.bgColor.on('save', (color) => {
          if (color && document.getElementById('bg-enabled')?.checked) {
            updateLayer(layer.id, { bgColor: color.toRGBA().toString() }, true);
          }
          pickrInstances.bgColor.hide();
        });
      }
      
      // BG enable checkbox
      const bgEnabledEl = document.getElementById('bg-enabled');
      if (bgEnabledEl) {
        bgEnabledEl.onchange = () => {
          if (!bgEnabledEl.checked) {
            updateLayer(layer.id, { bgColor: '' }, true);
          } else {
            const color = pickrInstances.bgColor?.getColor()?.toRGBA()?.toString() || 'rgba(0,0,0,0.5)';
            updateLayer(layer.id, { bgColor: color }, true);
          }
        };
      }
      
      // Emoji picker buttons
      const emojiPicker = document.getElementById('emoji-picker');
      if (emojiPicker) {
        emojiPicker.querySelectorAll('button').forEach(btn => {
          btn.onclick = () => {
            const emoji = btn.dataset.emoji;
            const textarea = els.propsForm.querySelector('textarea[data-prop="text"]');
            if (textarea) {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const text = textarea.value;
              textarea.value = text.slice(0, start) + emoji + text.slice(end);
              textarea.focus();
              textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
              updateLayer(layer.id, { text: textarea.value }, true);
            }
          };
        });
      }
      
      // Custom gradient editor
      const gradPreset = document.getElementById('text-gradient-preset');
      const gradEditor = document.getElementById('custom-gradient-editor');
      if (gradPreset && gradEditor) {
        gradPreset.onchange = () => {
          if (gradPreset.value === 'custom') {
            gradEditor.style.display = 'block';
          } else {
            gradEditor.style.display = 'none';
            updateLayer(layer.id, { textGradient: gradPreset.value }, true);
          }
        };
        
        const applyGrad = document.getElementById('apply-text-gradient');
        if (applyGrad) {
          applyGrad.onclick = () => {
            const angle = document.getElementById('grad-angle')?.value || 90;
            const c1 = document.getElementById('grad-color1')?.value || '#ff0000';
            const c2 = document.getElementById('grad-color2')?.value || '#0000ff';
            const grad = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
            document.getElementById('grad-preview').style.background = grad;
            updateLayer(layer.id, { 
              textGradient: grad,
              gradAngle: angle,
              gradColor1: c1,
              gradColor2: c2
            }, true);
          };
        }
        
        // Live preview
        ['grad-angle', 'grad-color1', 'grad-color2'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.oninput = () => {
              const angle = document.getElementById('grad-angle')?.value || 90;
              const c1 = document.getElementById('grad-color1')?.value || '#ff0000';
              const c2 = document.getElementById('grad-color2')?.value || '#0000ff';
              document.getElementById('grad-preview').style.background = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
            };
          }
        });
      }
    }, 50);
  }
  
  // Alignment buttons
  els.propsForm.querySelectorAll('.align-btn').forEach(btn => {
    btn.onclick = () => {
      const align = btn.dataset.align;
      const w = (layer.width || 400) * (layer.scale || 1);
      const h = (layer.height || (layer.type === 'text' ? 100 : 400)) * (layer.scale || 1);
      
      let updates = {};
      switch(align) {
        case 'h-center': updates.x = (STAGE_W - w) / 2; break;
        case 'v-center': updates.y = (STAGE_H - h) / 2; break;
        case 'center': updates = { x: (STAGE_W - w) / 2, y: (STAGE_H - h) / 2 }; break;
        case 'left': updates.x = 40; break;
        case 'right': updates.x = STAGE_W - w - 40; break;
        case 'top': updates.y = 40; break;
        case 'bottom': updates.y = STAGE_H - h - 40; break;
      }
      updateLayer(layer.id, updates, false);
      pushHistory();
    };
  });
  
  // Replay Animation button
  const replayBtn = document.getElementById('replay-animation');
  if (replayBtn) {
    replayBtn.onclick = () => {
      const wrapper = document.querySelector(`[data-layer-id="${layer.id}"] .anim-wrapper`);
      if (wrapper && layer.animation && layer.animation !== 'none') {
        wrapper.style.animation = 'none';
        wrapper.offsetHeight; // Force reflow
        wrapper.style.animation = layer.animation;
      }
    };
  }
  
  // Audio controls
  const audioPlay = document.getElementById('audio-play');
  const audioStop = document.getElementById('audio-stop');
  const audioVolume = document.getElementById('audio-volume');
  
  if (audioPlay) {
    audioPlay.onclick = () => {
      const audioEl = document.querySelector(`#audio-${layer.id}`);
      if (audioEl) {
        audioEl.play();
        updateLayer(layer.id, { playing: true }, true);
      }
    };
  }
  
  if (audioStop) {
    audioStop.onclick = () => {
      const audioEl = document.querySelector(`#audio-${layer.id}`);
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        updateLayer(layer.id, { playing: false }, true);
      }
    };
  }
  
  if (audioVolume) {
    audioVolume.oninput = (e) => {
      const audioEl = document.querySelector(`#audio-${layer.id}`);
      if (audioEl) {
        audioEl.volume = parseFloat(e.target.value);
        updateLayer(layer.id, { volume: parseFloat(e.target.value) }, true);
      }
    };
  }
  
  // Debounced history push for property changes
  let propChangeTimeout = null;
  function debouncedHistoryPush() {
    clearTimeout(propChangeTimeout);
    propChangeTimeout = setTimeout(() => pushHistory(), 500);
  }
  
  // Bind inputs
  els.propsForm.querySelectorAll('input, select, textarea').forEach(input => {
    if (input.id?.startsWith('pickr') || input.id === 'bg-enabled' || input.id?.startsWith('grad-') || input.id === 'text-gradient-preset') return;
    
    input.oninput = (e) => {
      const key = e.target.dataset.prop;
      if (!key) return;
      let val = e.target.value;
      if (e.target.type === 'number') val = parseFloat(val);
      
      updateLayer(layer.id, { [key]: val }, true);
      debouncedHistoryPush();
    };
  });
}

function renderAll(skipSidebar = false) {
  renderStage();
  renderSidebar(skipSidebar);
  renderPresets(); // Update preset info based on selection
  
  // Sync tab active states with current view
  els.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
  els.views.forEach(v => v.classList.toggle('active', v.id === `view-${state.view}`));
}


/* --- CORE: Logic --- */

function addLayer(type, extra = {}) {
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const base = {
    id,
    type,
    x: 100,
    y: 300,
    opacity: 1,
    parentId: null, // New: support nesting
    ...extra
  };
  
  // ... rest of logic
  // Update: Ensure we don't break existing logic
  if (type === 'group') {
     state.layers.push({
         ...base,
         name: 'Group',
         expanded: true
     });
  } else if (type === 'text') {
    state.layers.push({
      ...base,
      text: 'Double click to edit',
      fontSize: 64,
      fontFamily: 'Inter',
      fontWeight: '600',
      lineHeight: 1.2,
      color: '#ffffff',
      textAlign: 'left',
      bgColor: '', // transparent
      padding: 16,
      borderRadius: 12
    });
  } else if (type === 'image') {
    state.layers.push({
      ...base,
      width: 400,
      height: 400,
      mode: 'cover'
    });
  } else if (type === 'video') {
    state.layers.push({
      ...base,
      width: 400,
      height: 700,
      mode: 'cover'
    });
  } else if (type === 'audio') {
    state.layers.push({
      ...base,
      // Audio doesn't have dimensions, just metadata
      width: 0,
      height: 0,
      playing: false
    });
  }

  pushHistory();
  saveState();
  selectLayer(id);
}

function updateLayer(id, updates, skipSidebar = false) {
  const idx = state.layers.findIndex(l => l.id === id);
  if (idx > -1) {
    state.layers[idx] = { ...state.layers[idx], ...updates };
    saveState();
    renderAll(skipSidebar);
  }
}

function removeLayer(id) {
  state.layers = state.layers.filter(l => l.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  pushHistory();
  saveState();
  renderAll();
}

// removed reorderLayers since it is replaced by performDrop
// const reorderLayers = ... deleted

function selectLayer(id) {
  state.selectedId = id;
  // When selecting a layer, switch to presets view to show preset slots and relevant presets
  if (state.view !== 'presets') {
     state.view = 'presets';
  }
  renderAll();
  
  // On mobile, open presets panel when selecting an element
  if (typeof openMobilePanel === 'function' && window.innerWidth <= 768) {
    openMobilePanel('presets');
    // Update toolbar active state
    document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.mobile-tool-btn[data-action="presets"]')?.classList.add('active');
  }
}


/* --- INTERACTION --- */

// Tabs
els.navBtns.forEach(btn => {
  btn.onclick = () => {
    els.navBtns.forEach(b => b.classList.remove('active'));
    els.views.forEach(v => v.classList.remove('active'));
    
    btn.classList.add('active');
    state.view = btn.dataset.view;
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    renderSidebar();
  };
});

// Drag
let resizeState = null;

let dragDelayTimer = null;
let pendingDragId = null;
let pendingDragStart = null;

function onMouseDownLayer(e) {
  if (resizeState) return; // resizing active

  // If clicked, select it
  const id = e.currentTarget.dataset.id;
  selectLayer(id);
  
  if (e.button !== 0) return; // only left click
  
  // Store pending drag info - delay actual drag start to allow double-click
  pendingDragId = id;
  pendingDragStart = { x: e.clientX, y: e.clientY };
  const layer = state.layers.find(l => l.id === id);
  
  state.dragStartMouse = { x: e.clientX, y: e.clientY };
  state.dragStartLayer = { x: layer.x, y: layer.y };
  
  // If it's a group, store children start positions
  if (layer.type === 'group') {
      state.dragStartChildren = {};
      state.layers.filter(l => l.parentId === id).forEach(child => {
          state.dragStartChildren[child.id] = { x: child.x, y: child.y };
      });
  }
  
  document.addEventListener('mousemove', onMouseMoveStart);
  document.addEventListener('mouseup', onMouseUpStart);
}

// Start drag only after mouse moves a few pixels (allows double-click)
function onMouseMoveStart(e) {
  if (!pendingDragId) return;
  
  const dx = Math.abs(e.clientX - pendingDragStart.x);
  const dy = Math.abs(e.clientY - pendingDragStart.y);
  
  // Only start drag if moved more than 3 pixels
  if (dx > 3 || dy > 3) {
    state.draggingId = pendingDragId;
    document.removeEventListener('mousemove', onMouseMoveStart);
    document.removeEventListener('mouseup', onMouseUpStart);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}

function onMouseUpStart() {
  pendingDragId = null;
  pendingDragStart = null;
  document.removeEventListener('mousemove', onMouseMoveStart);
  document.removeEventListener('mouseup', onMouseUpStart);
}

// Snapping constants
const SNAP_THRESHOLD = 10;

function getSnapPoints(layer) {
  const w = (layer.width || 400) * (layer.scale || 1);
  const h = (layer.height || 100) * (layer.scale || 1);
  return {
    left: 0, right: w, centerX: w / 2,
    top: 0, bottom: h, centerY: h / 2,
    width: w, height: h
  };
}

function snapToGuides(x, y, layer) {
  const lp = getSnapPoints(layer);
  const stageCenterX = STAGE_W / 2;
  const stageCenterY = STAGE_H / 2;
  
  let snappedX = x;
  let snappedY = y;
  let snapInfoX = null;
  let snapInfoY = null;
  
  // Element edges and center
  const elemLeft = x;
  const elemRight = x + lp.width;
  const elemCenterX = x + lp.centerX;
  const elemTop = y;
  const elemBottom = y + lp.height;
  const elemCenterY = y + lp.centerY;
  
  // Snap X: left edge to stage left
  if (Math.abs(elemLeft) < SNAP_THRESHOLD) {
    snappedX = 0;
    snapInfoX = { pos: 0, type: 'left' };
  }
  // Snap X: right edge to stage right
  else if (Math.abs(elemRight - STAGE_W) < SNAP_THRESHOLD) {
    snappedX = STAGE_W - lp.width;
    snapInfoX = { pos: STAGE_W, type: 'right' };
  }
  // Snap X: center to stage center
  else if (Math.abs(elemCenterX - stageCenterX) < SNAP_THRESHOLD) {
    snappedX = stageCenterX - lp.centerX;
    snapInfoX = { pos: stageCenterX, type: 'center' };
  }
  
  // Snap Y: top edge to stage top
  if (Math.abs(elemTop) < SNAP_THRESHOLD) {
    snappedY = 0;
    snapInfoY = { pos: 0, type: 'top' };
  }
  // Snap Y: bottom edge to stage bottom
  else if (Math.abs(elemBottom - STAGE_H) < SNAP_THRESHOLD) {
    snappedY = STAGE_H - lp.height;
    snapInfoY = { pos: STAGE_H, type: 'bottom' };
  }
  // Snap Y: center to stage center
  else if (Math.abs(elemCenterY - stageCenterY) < SNAP_THRESHOLD) {
    snappedY = stageCenterY - lp.centerY;
    snapInfoY = { pos: stageCenterY, type: 'center' };
  }
  
  return { x: snappedX, y: snappedY, snapInfoX, snapInfoY };
}

function onMouseMove(e) {
  if (state.draggingId) {
      const dx = (e.clientX - state.dragStartMouse.x) / state.zoom;
      const dy = (e.clientY - state.dragStartMouse.y) / state.zoom;
      
      const layer = state.layers.find(l => l.id === state.draggingId);
      let newX = state.dragStartLayer.x + dx;
      let newY = state.dragStartLayer.y + dy;
      
      // Apply snapping
      const snapped = snapToGuides(newX, newY, layer);
      newX = snapped.x;
      newY = snapped.y;
      
      // Direct DOM update for smooth dragging (avoids video recreation)
      const el = els.stage.querySelector(`[data-id="${state.draggingId}"]`);
      if (el) {
          el.style.left = newX + 'px';
          el.style.top = newY + 'px';
          
          // Show snap guides
          showSnapGuides(snapped.snapInfoX, snapped.snapInfoY, newX, newY, layer);
      }
      
      // If dragging a folder, move all children too (direct DOM update)
      if (layer && layer.type === 'group') {
          const children = state.layers.filter(l => l.parentId === layer.id);
          children.forEach(child => {
              const childStart = state.dragStartChildren?.[child.id];
              if (childStart) {
                  const childEl = els.stage.querySelector(`[data-id="${child.id}"]`);
                  if (childEl) {
                      childEl.style.left = (childStart.x + dx) + 'px';
                      childEl.style.top = (childStart.y + dy) + 'px';
                  }
                  // Update state silently
                  const idx = state.layers.findIndex(l => l.id === child.id);
                  if (idx > -1) {
                      state.layers[idx].x = childStart.x + dx;
                      state.layers[idx].y = childStart.y + dy;
                  }
              }
          });
      }
      
      // Update state directly without re-render
      const idx = state.layers.findIndex(l => l.id === state.draggingId);
      if (idx > -1) {
          state.layers[idx].x = newX;
          state.layers[idx].y = newY;
      }
  }
}

// Snap guides (Photoshop-style)
function showSnapGuides(snapInfoX, snapInfoY, x, y, layer) {
    const guideH = document.getElementById('guide-h');
    const guideV = document.getElementById('guide-v');
    if (!guideH || !guideV) return;
    
    // Vertical guide (for X snapping)
    if (snapInfoX) {
        guideV.style.display = 'block';
        guideV.style.left = snapInfoX.pos + 'px';
        guideV.style.background = snapInfoX.type === 'center' ? 'var(--blue)' : 'var(--green)';
    } else {
        guideV.style.display = 'none';
    }
    
    // Horizontal guide (for Y snapping)
    if (snapInfoY) {
        guideH.style.display = 'block';
        guideH.style.top = snapInfoY.pos + 'px';
        guideH.style.background = snapInfoY.type === 'center' ? 'var(--blue)' : 'var(--green)';
    } else {
        guideH.style.display = 'none';
    }
}

function hideGuides() {
    const guideH = document.getElementById('guide-h');
    const guideV = document.getElementById('guide-v');
    if (guideH) guideH.style.display = 'none';
    if (guideV) guideV.style.display = 'none';
}

function onMouseUp() {
  if (state.draggingId) {
      state.draggingId = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      hideGuides();
      pushHistory();
      saveState();
  }
}

/* --- RE-SIZE LOGIC (Instagram-like: Scale Transform) --- */
function onResizeMouseDown(e) {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const pos = e.target.dataset.pos; // nw, ne, sw, se
    
    resizeState = {
        id,
        pos,
        startX: e.clientX,
        startY: e.clientY
    };
    
    const layer = state.layers.find(l => l.id === id);
    resizeState.startLayer = { ...layer };
    resizeState.startScale = layer.scale || 1;

    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
}

function onResizeMouseMove(e) {
    if (!resizeState) return;
    
    const dx = (e.clientX - resizeState.startX) / state.zoom;
    const dy = (e.clientY - resizeState.startY) / state.zoom;
    const l = resizeState.startLayer;
    const pos = resizeState.pos;

    // Instagram-style: Calculate scale change based on distance from center
    // Use the diagonal drag distance to determine scale
    let scaleDelta = 0;
    
    if (pos === 'se') {
        scaleDelta = (dx + dy) / 200; // Positive = grow
    } else if (pos === 'sw') {
        scaleDelta = (-dx + dy) / 200;
    } else if (pos === 'ne') {
        scaleDelta = (dx - dy) / 200;
    } else if (pos === 'nw') {
        scaleDelta = (-dx - dy) / 200;
    }
    
    const newScale = Math.max(0.1, Math.min(5, resizeState.startScale + scaleDelta));
    
    updateLayer(resizeState.id, { scale: newScale }, true /* skipSidebar */);
}

function onResizeMouseUp() {
    if (resizeState) {
        pushHistory();
        saveState();
        renderSidebar(); // refresh props
        resizeState = null;
        document.removeEventListener('mousemove', onResizeMouseMove);
        document.removeEventListener('mouseup', onResizeMouseUp);
    }
}

// Touch support for resize handles
function onResizeTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const id = e.target.dataset.id;
    const pos = e.target.dataset.pos;
    
    resizeState = {
        id,
        pos,
        startX: touch.clientX,
        startY: touch.clientY
    };
    
    const layer = state.layers.find(l => l.id === id);
    resizeState.startLayer = { ...layer };
    resizeState.startScale = layer.scale || 1;

    document.addEventListener('touchmove', onResizeTouchMove, { passive: false });
    document.addEventListener('touchend', onResizeTouchEnd);
}

function onResizeTouchMove(e) {
    if (!resizeState) return;
    e.preventDefault();
    const touch = e.touches[0];
    
    const dx = (touch.clientX - resizeState.startX) / state.zoom;
    const dy = (touch.clientY - resizeState.startY) / state.zoom;
    const pos = resizeState.pos;

    let scaleDelta = 0;
    if (pos === 'se') {
        scaleDelta = (dx + dy) / 200;
    } else if (pos === 'sw') {
        scaleDelta = (-dx + dy) / 200;
    } else if (pos === 'ne') {
        scaleDelta = (dx - dy) / 200;
    } else if (pos === 'nw') {
        scaleDelta = (-dx - dy) / 200;
    }
    
    const newScale = Math.max(0.1, Math.min(5, resizeState.startScale + scaleDelta));
    updateLayer(resizeState.id, { scale: newScale }, true);
}

function onResizeTouchEnd() {
    if (resizeState) {
        pushHistory();
        saveState();
        renderSidebar();
        resizeState = null;
        document.removeEventListener('touchmove', onResizeTouchMove);
        document.removeEventListener('touchend', onResizeTouchEnd);
    }
}

/* --- ROTATION LOGIC --- */
let rotateState = null;

function onRotateMouseDown(e) {
    e.stopPropagation();
    const id = e.target.dataset.id;
    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    
    // Get element center for rotation calculations
    const elDOM = els.stage.querySelector(`[data-layer-id="${id}"]`);
    if (!elDOM) return;
    
    const rect = elDOM.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotateState = {
        id,
        centerX,
        centerY,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI),
        startRotation: layer.rotation || 0
    };
    
    document.addEventListener('mousemove', onRotateMouseMove);
    document.addEventListener('mouseup', onRotateMouseUp);
}

function onRotateMouseMove(e) {
    if (!rotateState) return;
    
    const currentAngle = Math.atan2(e.clientY - rotateState.centerY, e.clientX - rotateState.centerX) * (180 / Math.PI);
    let deltaAngle = currentAngle - rotateState.startAngle;
    
    // Calculate new rotation
    let newRotation = rotateState.startRotation + deltaAngle;
    
    // Snap to 0, 90, 180, 270 if within 5 degrees
    const snapAngles = [0, 90, 180, 270, -90, -180, -270, 360];
    for (const snap of snapAngles) {
        if (Math.abs(newRotation - snap) < 5) {
            newRotation = snap;
            break;
        }
    }
    
    // Normalize to -180 to 180
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;
    
    updateLayer(rotateState.id, { rotation: Math.round(newRotation) }, true);
}

function onRotateMouseUp() {
    if (rotateState) {
        pushHistory();
        saveState();
        renderSidebar();
        rotateState = null;
        document.removeEventListener('mousemove', onRotateMouseMove);
        document.removeEventListener('mouseup', onRotateMouseUp);
    }
}

// Touch support for rotation
function onRotateTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const id = e.target.dataset.id;
    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    
    const elDOM = els.stage.querySelector(`[data-layer-id="${id}"]`);
    if (!elDOM) return;
    
    const rect = elDOM.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotateState = {
        id,
        centerX,
        centerY,
        startAngle: Math.atan2(touch.clientY - centerY, touch.clientX - centerX) * (180 / Math.PI),
        startRotation: layer.rotation || 0
    };
    
    document.addEventListener('touchmove', onRotateTouchMove, { passive: false });
    document.addEventListener('touchend', onRotateTouchEnd);
}

function onRotateTouchMove(e) {
    if (!rotateState) return;
    e.preventDefault();
    const touch = e.touches[0];
    
    const currentAngle = Math.atan2(touch.clientY - rotateState.centerY, touch.clientX - rotateState.centerX) * (180 / Math.PI);
    let deltaAngle = currentAngle - rotateState.startAngle;
    let newRotation = rotateState.startRotation + deltaAngle;
    
    // Snap to cardinal angles
    const snapAngles = [0, 90, 180, 270, -90, -180, -270, 360];
    for (const snap of snapAngles) {
        if (Math.abs(newRotation - snap) < 8) {
            newRotation = snap;
            break;
        }
    }
    
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;
    
    updateLayer(rotateState.id, { rotation: Math.round(newRotation) }, true);
}

function onRotateTouchEnd() {
    if (rotateState) {
        pushHistory();
        saveState();
        renderSidebar();
        rotateState = null;
        document.removeEventListener('touchmove', onRotateTouchMove);
        document.removeEventListener('touchend', onRotateTouchEnd);
    }
}


/* --- ACTIONS --- */

// Add Text
document.getElementById('add-text').onclick = () => {
  addLayer('text', { text: '# Hello\nWrite markdown here.' });
};

// Add Image
document.getElementById('add-image').onclick = () => {
  els.uploadHidden.accept = "image/*";
  els.uploadHidden.click();
};

// Add Video
document.getElementById('add-video').onclick = () => {
    els.uploadHidden.accept = "video/*";
    els.uploadHidden.click();
  };

// Add Audio
const audioUploadHidden = document.getElementById('audio-upload-hidden');
document.getElementById('add-audio')?.addEventListener('click', () => {
  audioUploadHidden?.click();
});

audioUploadHidden?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const src = await fileToDataURL(file);
  addLayer('audio', { src, name: file.name });
  
  audioUploadHidden.value = ''; // reset
  state.view = 'layers';
  renderAll();
});

els.uploadHidden.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const src = await fileToDataURL(file);

  if (file.type.startsWith('video/')) {
    addLayer('video', { src });
  } else {
    // assume image
    addLayer('image', { src });
  }
  
  els.uploadHidden.value = ''; // reset
  // Stay in layers view to show preset slots
  state.view = 'layers';
  renderAll();
};

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Global BG - Use Pickr for settings color picker
const pickrBgColorEl = document.getElementById('pickr-bg-color');
if (pickrBgColorEl && typeof Pickr !== 'undefined') {
  pickrInstances.bgColor = Pickr.create({
    el: pickrBgColorEl,
    theme: 'nano',
    default: state.global.bgColor || '#111827',
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: { hex: true, rgba: true, input: true, save: true }
    }
  });
  pickrInstances.bgColor.on('save', (color) => {
    if (color) {
      state.global.bgColor = color.toHEXA().toString();
      state.global.bgType = 'color';
      pushHistory();
      saveState();
      renderAll();
    }
    pickrInstances.bgColor.hide();
  });
}

// Legacy fallback (if no Pickr)
if (els.globalBgColor) {
  els.globalBgColor.oninput = (e) => {
    state.global.bgColor = e.target.value;
    state.global.bgType = 'color';
    pushHistory();
    saveState();
    renderAll();
  };
}

els.globalBgImg.onchange = async (e) => {
  const file = e.target.files[0];
  if (file) {
    state.global.bgImg = await fileToDataURL(file);
    state.global.bgType = 'image';
  } else {
    state.global.bgImg = null;
  }
  saveState();
  renderAll();
};

els.clearGlobalBg.onclick = () => {
  state.global.bgImg = null;
  els.globalBgImg.value = '';
  state.global.bgType = 'color';
  saveState();
  renderAll();
};

/* --- NEW SETTINGS LOGIC --- */

if (els.bgType) {
    els.bgType.onchange = () => {
        state.global.bgType = els.bgType.value;
        // Hide all bg control groups first
        Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
        // Show the active one
        const activeBgControl = els.bgControls[state.global.bgType];
        if (activeBgControl) activeBgControl.style.display = 'block';
        saveState();
        renderAll();
    };

    els.gradPresets.forEach(btn => {
        btn.onclick = () => {
        state.global.bgType = 'gradient';
        state.global.bgGradient = btn.dataset.g;
        els.bgType.value = 'gradient';
        Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
        if (els.bgControls.gradient) els.bgControls.gradient.style.display = 'block';
        saveState();
        renderAll();
        };
    });

    // Gradient type selector
    if (els.bgGradType) {
        els.bgGradType.onchange = () => {
            // Regenerate gradient with new type
            const deg = els.gradAngle?.value || 135;
            const c1 = els.gradStart?.value || '#667eea';
            const c2 = els.gradEnd?.value || '#764ba2';
            const gradType = els.bgGradType.value;
            
            let grad;
            if (gradType === 'linear') {
                grad = `linear-gradient(${deg}deg, ${c1} 0%, ${c2} 100%)`;
            } else if (gradType === 'radial') {
                grad = `radial-gradient(circle, ${c1} 0%, ${c2} 100%)`;
            } else if (gradType === 'conic') {
                grad = `conic-gradient(from ${deg}deg, ${c1}, ${c2}, ${c1})`;
            }
            
            state.global.bgType = 'gradient';
            state.global.bgGradient = grad;
            saveState();
            renderAll();
        };
    }

    function updateCustomGrad() {
        if (!els.applyGrad) return;
        const deg = els.gradAngle?.value || 135;
        els.applyGrad.textContent = `Apply (${deg}°)`;
    }
    [els.gradAngle, els.gradStart, els.gradEnd].forEach(el => {
        if(el) el.oninput = updateCustomGrad;
    });

    if (els.applyGrad) {
        els.applyGrad.onclick = () => {
            const deg = els.gradAngle?.value || 135;
            const c1 = els.gradStart?.value || '#667eea';
            const c2 = els.gradEnd?.value || '#764ba2';
            const gradType = els.bgGradType?.value || 'linear';
            
            let grad;
            if (gradType === 'linear') {
                grad = `linear-gradient(${deg}deg, ${c1} 0%, ${c2} 100%)`;
            } else if (gradType === 'radial') {
                grad = `radial-gradient(circle, ${c1} 0%, ${c2} 100%)`;
            } else if (gradType === 'conic') {
                grad = `conic-gradient(from ${deg}deg, ${c1}, ${c2}, ${c1})`;
            }
            
            state.global.bgType = 'gradient';
            state.global.bgGradient = grad;
            saveState();
            renderAll();
        };
    }
    
    // Background image
    if (els.globalBgImg) {
        els.globalBgImg.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                state.global.bgImg = ev.target.result;
                state.global.bgType = 'image';
                els.bgType.value = 'image';
                Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
                if (els.bgControls.image) els.bgControls.image.style.display = 'block';
                
                // Show preview
                const preview = document.getElementById('bg-image-preview');
                const thumb = document.getElementById('bg-image-thumb');
                if (preview && thumb) {
                    preview.style.display = 'block';
                    thumb.src = ev.target.result;
                }
                
                saveState();
                renderAll();
            };
            reader.readAsDataURL(file);
        };
    }
    
    // Image fit and position
    if (els.bgImageFit) {
        els.bgImageFit.onchange = () => {
            state.global.bgImageFit = els.bgImageFit.value;
            saveState();
            renderAll();
        };
    }
    
    if (els.bgImagePosition) {
        els.bgImagePosition.onchange = () => {
            state.global.bgImagePosition = els.bgImagePosition.value;
            saveState();
            renderAll();
        };
    }
    
    // Overlay controls
    if (els.bgOverlayEnabled) {
        els.bgOverlayEnabled.onchange = () => {
            state.global.bgOverlay = els.bgOverlayEnabled.checked;
            if (els.bgOverlayControls) {
                els.bgOverlayControls.style.display = els.bgOverlayEnabled.checked ? 'block' : 'none';
            }
            saveState();
            renderAll();
        };
    }
    
    if (els.bgOverlayColor) {
        els.bgOverlayColor.onchange = () => {
            state.global.bgOverlayColor = els.bgOverlayColor.value;
            saveState();
            renderAll();
        };
    }
    
    if (els.bgOverlayOpacity) {
        els.bgOverlayOpacity.oninput = () => {
            state.global.bgOverlayOpacity = parseInt(els.bgOverlayOpacity.value);
            saveState();
            renderAll();
        };
    }
    
    // Video background
    if (els.globalBgVideo) {
        els.globalBgVideo.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                state.global.bgVideo = ev.target.result;
                state.global.bgType = 'video';
                els.bgType.value = 'video';
                Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
                if (els.bgControls.video) els.bgControls.video.style.display = 'block';
                
                // Show preview
                const preview = document.getElementById('bg-video-preview');
                const thumb = document.getElementById('bg-video-thumb');
                if (preview && thumb) {
                    preview.style.display = 'block';
                    thumb.src = ev.target.result;
                }
                
                saveState();
                renderAll();
            };
            reader.readAsDataURL(file);
        };
    }
    
    // Clear buttons
    if (els.clearGlobalBg) {
        els.clearGlobalBg.onclick = () => {
            state.global.bgImg = null;
            state.global.bgType = 'color';
            els.bgType.value = 'color';
            Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
            if (els.bgControls.color) els.bgControls.color.style.display = 'block';
            
            const preview = document.getElementById('bg-image-preview');
            if (preview) preview.style.display = 'none';
            
            saveState();
            renderAll();
        };
    }
    
    if (els.clearGlobalBgVideo) {
        els.clearGlobalBgVideo.onclick = () => {
            state.global.bgVideo = null;
            state.global.bgType = 'color';
            els.bgType.value = 'color';
            Object.values(els.bgControls).forEach(el => { if (el) el.style.display = 'none'; });
            if (els.bgControls.color) els.bgControls.color.style.display = 'block';
            
            const preview = document.getElementById('bg-video-preview');
            if (preview) preview.style.display = 'none';
            
            saveState();
            renderAll();
        };
    }
}

/* --- SIDEBAR RESIZE --- */
let isResizingSidebar = false;
if (els.resizer) {
    els.resizer.addEventListener('mousedown', (e) => {
    isResizingSidebar = true;
    els.resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
    if (!isResizingSidebar) return;
    const w = e.clientX;
    if (w > 200 && w < 600) {
        els.sidebar.style.width = `${w}px`;
        els.sidebar.style.flexBasis = `${w}px`;
    }
    });
    document.addEventListener('mouseup', () => {
    if(isResizingSidebar) {
        isResizingSidebar = false;
        els.resizer.classList.remove('resizing');
        document.body.style.cursor = '';
    }
    });
}

// Init
loadState();

// Preset filtering state
let presetFilter = 'all';
let presetSearch = '';

// Render Unified Presets
function renderPresets() {
  const presetList = document.getElementById('unified-preset-list');
  const presetInfo = document.getElementById('preset-info');
  const presetFiltersEl = document.getElementById('preset-filters');
  if (!presetList) return;
  
  const selectedLayer = state.layers.find(l => l.id === state.selectedId);
  const searchLower = presetSearch.toLowerCase();
  const isMobile = window.innerWidth <= 768;
  
  // Update info text based on selection
  if (presetInfo) {
    if (!selectedLayer) {
      presetInfo.textContent = 'Select an element to see relevant presets.';
      presetInfo.style.display = 'block';
    } else {
      presetInfo.textContent = isMobile 
        ? `Tap to apply, or hold & drag to a slot.`
        : `Showing presets for ${selectedLayer.type}. Click to apply or drag to slots.`;
      presetInfo.style.display = 'block';
    }
  }
  
  // Build combined preset list with all types
  let allPresets = [];
  
  // Add text presets (only if text element selected or no selection)
  if (!selectedLayer || selectedLayer.type === 'text') {
    TEXT_PRESETS.forEach((preset, idx) => {
      allPresets.push({
        type: 'text',
        category: preset.category || 'text',
        index: idx,
        name: preset.name,
        preset
      });
    });
  }
  
  // Add image/filter presets (only if image/video selected or no selection)
  if (!selectedLayer || selectedLayer.type === 'image' || selectedLayer.type === 'video') {
    IMAGE_PRESETS.forEach((preset, idx) => {
      allPresets.push({
        type: 'image',
        category: 'image',
        index: idx,
        name: preset.name,
        preset
      });
    });
  }
  
  // Add animation presets (for any non-group element)
  if (!selectedLayer || (selectedLayer && selectedLayer.type !== 'group')) {
    ANIMATION_PRESETS.forEach((preset, idx) => {
      allPresets.push({
        type: 'animation',
        category: 'animation',
        index: idx,
        name: preset.name,
        preset
      });
    });
  }
  
  // Update filter buttons visibility based on what presets are available
  if (presetFiltersEl) {
    const availableCategories = new Set(allPresets.map(p => p.category));
    availableCategories.add('all');
    presetFiltersEl.querySelectorAll('.preset-filter').forEach(btn => {
      const filter = btn.dataset.filter;
      if (filter === 'all') {
        btn.style.display = '';
      } else if (filter === 'text' || filter === 'paragraph') {
        btn.style.display = (!selectedLayer || selectedLayer.type === 'text') ? '' : 'none';
      } else if (filter === 'image') {
        btn.style.display = (!selectedLayer || selectedLayer.type === 'image' || selectedLayer.type === 'video') ? '' : 'none';
      } else if (filter === 'animation') {
        btn.style.display = (!selectedLayer || selectedLayer.type !== 'group') ? '' : 'none';
      }
    });
    
    // Reset filter to 'all' if current filter is hidden
    const activeFilter = presetFiltersEl.querySelector('.preset-filter.active');
    if (activeFilter && activeFilter.style.display === 'none') {
      presetFilter = 'all';
      presetFiltersEl.querySelectorAll('.preset-filter').forEach(b => b.classList.remove('active'));
      presetFiltersEl.querySelector('[data-filter="all"]')?.classList.add('active');
    }
  }
  
  // Apply filters
  let filtered = allPresets;
  
  // Filter by type/category
  if (presetFilter !== 'all') {
    filtered = filtered.filter(p => p.category === presetFilter);
  }
  
  // Filter by search
  if (searchLower) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchLower));
  }
  
  // Render
  presetList.innerHTML = filtered.map(item => {
    if (item.type === 'text') {
      const preset = item.preset;
      const categoryBadge = preset.category === 'paragraph' ? '<span class="preset-badge paragraph">¶</span>' : '<span class="preset-badge text">T</span>';
      return `
        <div class="preset-item text-preset" draggable="true" data-type="text" data-index="${item.index}" data-preset-name="${preset.name}">
          ${categoryBadge}
          <div class="preview" style="font-family: ${preset.fontFamily}; font-size: 12px; font-weight: ${preset.fontWeight}; color: ${preset.color}; ${preset.textGradient ? `background: ${preset.textGradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent;` : ''}">${preset.text.replace(/^#+\s*/, '').slice(0, 12)}</div>
          <div class="name">${preset.name}</div>
        </div>
      `;
    } else if (item.type === 'image') {
      const preset = item.preset;
      return `
        <div class="preset-item image-preset" draggable="true" data-type="image" data-index="${item.index}" data-preset-name="${preset.name}">
          <span class="preset-badge image">🖼</span>
          <div class="preview" style="width:100%; height:32px; background: linear-gradient(135deg, #666, #999); ${preset.filter !== 'none' ? `filter: ${preset.filter};` : ''}"></div>
          <div class="name">${preset.name}</div>
        </div>
      `;
    } else if (item.type === 'animation') {
      const preset = item.preset;
      return `
        <div class="preset-item anim-preset" draggable="true" data-type="animation" data-index="${item.index}" data-preset-name="${preset.name}">
          <span class="preset-badge anim">▶</span>
          <div class="preview" style="font-size: 20px; text-align: center; line-height: 32px;">${preset.icon}</div>
          <div class="name">${preset.name}</div>
        </div>
      `;
    }
    return '';
  }).join('');
  
  // Bind click handlers
  presetList.querySelectorAll('.preset-item').forEach(item => {
    item.onclick = () => {
      const type = item.dataset.type;
      const index = parseInt(item.dataset.index);
      
      if (type === 'text') {
        const preset = TEXT_PRESETS[index];
        const selectedLayer = state.layers.find(l => l.id === state.selectedId);
        
        if (selectedLayer && selectedLayer.type === 'text') {
          // Apply preset to selected text layer (keep position and content)
          const updates = {
            fontFamily: preset.fontFamily,
            fontSize: preset.fontSize,
            fontWeight: preset.fontWeight,
            color: preset.color,
            textAlign: preset.textAlign,
            lineHeight: preset.lineHeight,
            textShadow: preset.textShadow || '',
            textStroke: preset.textStroke || '',
            textGradient: preset.textGradient || '',
            bgColor: preset.bgColor || '',
            padding: preset.padding || 16,
            borderRadius: preset.borderRadius || 12,
            // Markdown-specific properties
            h1Font: preset.h1Font || '',
            h1Color: preset.h1Color || '',
            h1Size: preset.h1Size || 0,
            h1Weight: preset.h1Weight || '',
            h2Font: preset.h2Font || '',
            h2Color: preset.h2Color || '',
            h2Size: preset.h2Size || 0,
            h2Weight: preset.h2Weight || '',
            h3Font: preset.h3Font || '',
            h3Color: preset.h3Color || '',
            h3Size: preset.h3Size || 0,
            h3Weight: preset.h3Weight || ''
          };
          updateLayer(selectedLayer.id, updates);
          pushHistory();
          // Track applied preset in slot
          updateLayer(selectedLayer.id, { appliedPreset_style: preset.name });
        } else {
          // Create new text layer with preset
          addLayer('text', {
            ...preset,
            x: STAGE_W / 2 - 200,
            y: STAGE_H / 2 - 50,
            appliedPreset_style: preset.name
          });
        }
        // Stay in presets view
        renderAll();
        
      } else if (type === 'image') {
        const preset = IMAGE_PRESETS[index];
        const selectedLayer = state.layers.find(l => l.id === state.selectedId);
        
        if (selectedLayer && (selectedLayer.type === 'image' || selectedLayer.type === 'video')) {
          updateLayer(selectedLayer.id, { filter: preset.filter, appliedPreset_filter: preset.name });
          pushHistory();
        }
        
      } else if (type === 'animation') {
        const preset = ANIMATION_PRESETS[index];
        const selectedLayer = state.layers.find(l => l.id === state.selectedId);
        
        if (selectedLayer && selectedLayer.type !== 'group') {
          // Apply CSS animation to element
          updateLayer(selectedLayer.id, { animation: preset.animation, appliedPreset_animation: preset.name });
          pushHistory();
          
          // Re-render to apply animation via wrapper, then reset to trigger animation
          renderStage();
          setTimeout(() => {
            const wrapper = document.querySelector(`[data-layer-id="${selectedLayer.id}"] .anim-wrapper`);
            if (wrapper) {
              wrapper.style.animation = 'none';
              wrapper.offsetHeight; // Force reflow
              wrapper.style.animation = preset.animation;
            }
          }, 10);
        }
      }
    };
    
    // Drag start for presets (desktop)
    item.ondragstart = (e) => {
      e.dataTransfer.setData('presetType', item.dataset.type);
      e.dataTransfer.setData('presetIndex', item.dataset.index);
      e.dataTransfer.setData('presetName', item.dataset.presetName || '');
      item.style.opacity = '0.5';
    };
    item.ondragend = () => {
      item.style.opacity = '1';
    };
    
    // Touch drag support (long press to initiate)
    let touchTimer = null;
    let touchDragging = false;
    let touchClone = null;
    
    item.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => {
        touchDragging = true;
        item.style.opacity = '0.5';
        
        // Create visual clone for dragging
        touchClone = item.cloneNode(true);
        touchClone.style.position = 'fixed';
        touchClone.style.zIndex = '10000';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.opacity = '0.8';
        touchClone.style.transform = 'scale(1.1)';
        touchClone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        document.body.appendChild(touchClone);
        
        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - 40) + 'px';
        touchClone.style.top = (touch.clientY - 40) + 'px';
        
        // Vibration feedback
        if (navigator.vibrate) navigator.vibrate(50);
      }, 400); // 400ms long press
    }, { passive: true });
    
    item.addEventListener('touchmove', (e) => {
      if (touchDragging && touchClone) {
        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - 40) + 'px';
        touchClone.style.top = (touch.clientY - 40) + 'px';
        
        // Check if over a slot
        document.querySelectorAll('.slot-box').forEach(slot => {
          const rect = slot.getBoundingClientRect();
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            slot.classList.add('drag-over');
          } else {
            slot.classList.remove('drag-over');
          }
        });
      } else {
        clearTimeout(touchTimer);
      }
    }, { passive: true });
    
    item.addEventListener('touchend', (e) => {
      clearTimeout(touchTimer);
      
      if (touchDragging) {
        const touch = e.changedTouches[0];
        
        // Check which slot we dropped on
        document.querySelectorAll('.slot-box').forEach(slot => {
          const rect = slot.getBoundingClientRect();
          if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
              touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            // Trigger the drop
            applyPresetToSlot(
              item.dataset.type,
              parseInt(item.dataset.index),
              item.dataset.presetName || '',
              slot.dataset.slot
            );
          }
          slot.classList.remove('drag-over');
        });
        
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }
        item.style.opacity = '1';
        touchDragging = false;
      }
    });
    
    item.addEventListener('touchcancel', () => {
      clearTimeout(touchTimer);
      if (touchClone) {
        touchClone.remove();
        touchClone = null;
      }
      item.style.opacity = '1';
      touchDragging = false;
      document.querySelectorAll('.slot-box').forEach(slot => slot.classList.remove('drag-over'));
    });
  });
  
  // Setup drag-drop on slots
  setupSlotDropZones();
}

function setupSlotDropZones() {
  const slots = document.querySelectorAll('.slot-box');
  slots.forEach(slot => {
    slot.ondragover = (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    };
    slot.ondragleave = () => {
      slot.classList.remove('drag-over');
    };
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      
      const presetType = e.dataTransfer.getData('presetType');
      const presetIndex = parseInt(e.dataTransfer.getData('presetIndex'));
      const presetName = e.dataTransfer.getData('presetName');
      const slotType = slot.dataset.slot;
      
      applyPresetToSlot(presetType, presetIndex, presetName, slotType);
    };
  });
}

// Helper function to apply preset to a slot (used by both drag-drop and touch)
function applyPresetToSlot(presetType, presetIndex, presetName, slotType) {
  if (!presetType || isNaN(presetIndex)) return;
  
  const selectedLayer = state.layers.find(l => l.id === state.selectedId);
  if (!selectedLayer) return;
  
  let isValidDrop = false;
  
  if (slotType === 'style' && presetType === 'text' && selectedLayer.type === 'text') {
    // Apply text preset to style slot
    const preset = TEXT_PRESETS[presetIndex];
    const updates = {
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      color: preset.color,
      textAlign: preset.textAlign,
      lineHeight: preset.lineHeight,
      textShadow: preset.textShadow || '',
      textStroke: preset.textStroke || '',
      textGradient: preset.textGradient || '',
      bgColor: preset.bgColor || '',
      padding: preset.padding || 16,
      borderRadius: preset.borderRadius || 12,
      // Markdown-specific properties
      h1Font: preset.h1Font || '',
      h1Color: preset.h1Color || '',
      h1Size: preset.h1Size || 0,
      h1Weight: preset.h1Weight || '',
      h2Font: preset.h2Font || '',
      h2Color: preset.h2Color || '',
      h2Size: preset.h2Size || 0,
      h2Weight: preset.h2Weight || '',
      h3Font: preset.h3Font || '',
      h3Color: preset.h3Color || '',
      h3Size: preset.h3Size || 0,
      h3Weight: preset.h3Weight || '',
      appliedPreset_style: presetName
    };
    updateLayer(selectedLayer.id, updates);
    isValidDrop = true;
    
  } else if (slotType === 'filter' && presetType === 'image' && (selectedLayer.type === 'image' || selectedLayer.type === 'video')) {
    // Apply image filter preset
    const preset = IMAGE_PRESETS[presetIndex];
    updateLayer(selectedLayer.id, { filter: preset.filter, appliedPreset_filter: presetName });
    isValidDrop = true;
    
  } else if (slotType === 'animation' && presetType === 'animation' && selectedLayer.type !== 'group') {
    // Apply animation preset
    const preset = ANIMATION_PRESETS[presetIndex];
    updateLayer(selectedLayer.id, { animation: preset.animation, appliedPreset_animation: presetName });
    
    // Re-render to apply animation via wrapper, then reset to trigger animation
    renderStage();
    setTimeout(() => {
      const wrapper = document.querySelector(`[data-layer-id="${selectedLayer.id}"] .anim-wrapper`);
      if (wrapper) {
        wrapper.style.animation = 'none';
        wrapper.offsetHeight;
        wrapper.style.animation = preset.animation;
      }
    }, 10);
    isValidDrop = true;
  }
  
  if (isValidDrop) {
    pushHistory();
    renderPresetSlots();
    // Vibration feedback on successful drop
    if (navigator.vibrate) navigator.vibrate(30);
  }
}

// Preset search and filter event listeners
document.getElementById('preset-search')?.addEventListener('input', (e) => {
  presetSearch = e.target.value;
  renderPresets();
});

document.querySelectorAll('.preset-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    presetFilter = btn.dataset.filter;
    renderPresets();
  });
});

renderPresets();

// Preset Slots Event Handlers
if (els.presetSlots) {
  // Click to clear slot
  els.presetSlots.addEventListener('click', (e) => {
    const clearBtn = e.target.closest('.slot-clear');
    if (clearBtn) {
      const slotType = clearBtn.dataset.slot;
      const selLayer = state.layers.find(l => l.id === state.selectedId);
      if (selLayer) {
        const updates = { [`appliedPreset_${slotType}`]: '' };
        // Also clear the actual property
        if (slotType === 'style') {
          // Reset to default text styles
          if (selLayer.type === 'text') {
            updates.fontFamily = 'Inter';
            updates.fontSize = 64;
            updates.fontWeight = '600';
            updates.color = '#ffffff';
            updates.textAlign = 'left';
            updates.lineHeight = 1.2;
            updates.textShadow = '';
            updates.textStroke = '';
            updates.textGradient = '';
            updates.bgColor = '';
          }
        } else if (slotType === 'filter') {
          updates.filter = 'none';
        } else if (slotType === 'animation') {
          updates.animation = 'none';
        }
        updateLayer(selLayer.id, updates);
        pushHistory();
      }
      return;
    }
    
    // Click on empty slot to filter presets to that type
    const slotBox = e.target.closest('.slot-box');
    if (slotBox && !slotBox.classList.contains('slot-filled')) {
      const slotType = slotBox.dataset.slot;
      // Set filter to match slot type
      if (slotType === 'style') {
        presetFilter = 'text';
      } else if (slotType === 'filter') {
        presetFilter = 'image';
      } else if (slotType === 'animation') {
        presetFilter = 'animation';
      }
      document.querySelectorAll('.preset-filter').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === presetFilter);
      });
      renderPresets();
    }
  });
  
  // Clear all slots button
  document.getElementById('clear-all-slots')?.addEventListener('click', () => {
    const selLayer = state.layers.find(l => l.id === state.selectedId);
    if (selLayer) {
      const updates = {
        appliedPreset_style: '',
        appliedPreset_filter: '',
        appliedPreset_animation: '',
        filter: 'none',
        animation: 'none'
      };
      if (selLayer.type === 'text') {
        updates.fontFamily = 'Inter';
        updates.fontSize = 64;
        updates.fontWeight = '600';
        updates.color = '#ffffff';
        updates.textAlign = 'left';
        updates.lineHeight = 1.2;
        updates.textShadow = '';
        updates.textStroke = '';
        updates.textGradient = '';
        updates.bgColor = '';
      }
      updateLayer(selLayer.id, updates);
      pushHistory();
    }
  });
}

// Initial State only if empty
if (state.layers.length === 0) {
    addLayer('text', {
    text: '## New Story\n\nDouble-click to edit text.',
    x: 100,
    y: 400
    });
}
renderAll();


// Zoom
function setZoom(z) {
  state.zoom = z;
  if (els.scaler) {
    els.scaler.style.transform = `scale(${z})`;
  }
  if (els.zoomLevel) {
    els.zoomLevel.textContent = Math.round(z * 100) + '%';
  }
  // Set CSS variable for handle scaling
  if (els.stage) {
    els.stage.style.setProperty('--stage-zoom', z);
  }
}

function fitStage() {
    if (!els.viewport) return;
    const pad = 40;
    const w = els.viewport.clientWidth - pad;
    const h = els.viewport.clientHeight - pad;
    if (w <= 0 || h <= 0) return;
    
    const scale = Math.min(w / STAGE_W, h / STAGE_H);
    setZoom(Math.max(0.1, Math.min(scale, 1.0)));
}

// Click on empty viewport area to deselect
if (els.viewport) {
  els.viewport.addEventListener('click', (e) => {
    // Only deselect if clicking directly on viewport or stage-scaler (not on elements)
    if (e.target === els.viewport || e.target === els.scaler || e.target === els.stage) {
      if (state.selectedId) {
        state.selectedId = null;
        renderAll();
      }
    }
  });
}

window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', () => setTimeout(fitStage, 100));
// Fit on init - use longer delay to ensure DOM is ready
setTimeout(fitStage, 200);

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomFitBtn = document.getElementById('zoom-fit');
if (zoomInBtn) zoomInBtn.onclick = () => setZoom(Math.min(state.zoom + 0.05, 1.0));
if (zoomOutBtn) zoomOutBtn.onclick = () => setZoom(Math.max(state.zoom - 0.05, 0.1));
if (zoomFitBtn) zoomFitBtn.onclick = fitStage;

// Export Dialog
const exportDialog = document.getElementById('export-dialog');
const exportCancel = document.getElementById('export-cancel');
const exportDesktop = document.getElementById('export-desktop');
const exportMobile = document.getElementById('export-mobile');
const exportPng = document.getElementById('export-png');
const exportJpg = document.getElementById('export-jpg');
const exportCopy = document.getElementById('export-copy');
const exportInstagram = document.getElementById('export-instagram');

// Detect mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

document.getElementById('btn-export')?.addEventListener('click', () => {
  if (exportDialog) {
    exportDialog.style.display = 'flex';
    // Show appropriate options based on device
    if (exportDesktop) exportDesktop.style.display = isMobile ? 'none' : 'flex';
    if (exportMobile) exportMobile.style.display = isMobile ? 'flex' : 'none';
  }
});

if (exportCancel) {
  exportCancel.onclick = () => {
    exportDialog.style.display = 'none';
  };
}

async function captureStage() {
  // Deselect to remove outline
  const prevSel = state.selectedId;
  state.selectedId = null;
  renderStage();
  
  await new Promise(r => setTimeout(r, 100));
  
  try {
    const canvas = await html2canvas(els.stage, {
      scale: 1,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
    return { canvas, prevSel };
  } catch (err) {
    state.selectedId = prevSel;
    renderStage();
    throw err;
  }
}

async function doExport(format) {
  exportDialog.style.display = 'none';
  
  try {
    const { canvas, prevSel } = await captureStage();
    
    const link = document.createElement('a');
    
    if (format === 'png') {
      link.download = 'story-' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
    } else if (format === 'jpg') {
      link.download = 'story-' + Date.now() + '.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.95);
    }
    
    link.click();
    
    state.selectedId = prevSel;
    renderStage();
  } catch (err) {
    console.error(err);
    alert('Export failed. See console.');
  }
}

async function copyToClipboard() {
  exportDialog.style.display = 'none';
  
  try {
    const { canvas, prevSel } = await captureStage();
    
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        // Show brief success feedback
        const msg = document.createElement('div');
        msg.textContent = '✓ Copied to clipboard!';
        msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:10000;';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
      } catch (clipErr) {
        console.error('Clipboard write failed:', clipErr);
        alert('Failed to copy. Try downloading instead.');
      }
      
      state.selectedId = prevSel;
      renderStage();
    }, 'image/png');
  } catch (err) {
    console.error(err);
    alert('Export failed. See console.');
  }
}

async function shareToInstagram() {
  exportDialog.style.display = 'none';
  
  try {
    const { canvas, prevSel } = await captureStage();
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'story.png', { type: 'image/png' });
      
      // Use Web Share API for Instagram
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Instagram Story',
          });
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.error('Share failed:', shareErr);
            // Fallback: download the file
            const link = document.createElement('a');
            link.download = 'story-' + Date.now() + '.png';
            link.href = URL.createObjectURL(blob);
            link.click();
            alert('Share not available. Image downloaded - open Instagram and add from gallery.');
          }
        }
      } else {
        // Fallback: download and prompt user
        const link = document.createElement('a');
        link.download = 'story-' + Date.now() + '.png';
        link.href = URL.createObjectURL(blob);
        link.click();
        alert('Image saved! Open Instagram → Story → Select from gallery.');
      }
      
      state.selectedId = prevSel;
      renderStage();
    }, 'image/png');
  } catch (err) {
    console.error(err);
    alert('Export failed. See console.');
  }
}

if (exportPng) exportPng.onclick = () => doExport('png');
if (exportJpg) exportJpg.onclick = () => doExport('jpg');
if (exportCopy) exportCopy.onclick = copyToClipboard;
if (exportInstagram) exportInstagram.onclick = shareToInstagram;

// Mobile panel handling
const isMobileDevice = () => window.innerWidth <= 768;
const sidebar = document.querySelector('.sidebar');
const mobileBackdrop = document.getElementById('mobile-backdrop');

function openMobilePanel(view) {
  if (!isMobileDevice()) return;
  
  // Show the panel
  sidebar?.classList.add('panel-open');
  mobileBackdrop?.classList.add('visible');
  
  // Switch to the correct view
  if (view) {
    document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
  }
}

function closeMobilePanel() {
  sidebar?.classList.remove('panel-open');
  mobileBackdrop?.classList.remove('visible');
  document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.remove('active'));
}

// Close panel when tapping backdrop
mobileBackdrop?.addEventListener('click', closeMobilePanel);

// Mobile toolbar handling
document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const action = this.dataset.action;
    const wasActive = this.classList.contains('active');
    
    // Update active state
    document.querySelectorAll('.mobile-tool-btn').forEach(b => b.classList.remove('active'));
    
    switch(action) {
      case 'elements':
        if (wasActive) {
          closeMobilePanel();
        } else {
          this.classList.add('active');
          openMobilePanel('layers');
        }
        break;
      case 'presets':
        if (wasActive) {
          closeMobilePanel();
        } else {
          this.classList.add('active');
          openMobilePanel('presets');
        }
        break;
      case 'background':
        if (wasActive) {
          closeMobilePanel();
        } else {
          this.classList.add('active');
          openMobilePanel('background');
        }
        break;
      case 'share':
        closeMobilePanel();
        // On mobile, directly trigger export dialog
        const exportDialog = document.getElementById('export-dialog');
        const exportMobile = document.getElementById('export-mobile');
        const exportDesktop = document.getElementById('export-desktop');
        if (exportDialog) {
          exportDialog.style.display = 'flex';
          if (exportDesktop) exportDesktop.style.display = 'none';
          if (exportMobile) exportMobile.style.display = 'flex';
        }
        break;
    }
  });
});

// Initial State
// Removed unconditional addLayer, logic moved to init block above.

// Undo/Redo Buttons
document.getElementById('btn-undo')?.addEventListener('click', undo);
document.getElementById('btn-redo')?.addEventListener('click', redo);

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
  // Ignore if typing in an input
  if (e.target.matches('input, textarea, [contenteditable]')) return;
  
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
});

// Initialize history with current state
pushHistory();
