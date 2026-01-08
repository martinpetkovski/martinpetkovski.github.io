/**
 * Generate Spotify Chart Data
 * 
 * This script fetches all Spotify data for Macedonian artists and generates
 * a chart-data.json file for use by the MMM chart and releases pages.
 * 
 * Run locally: node generate-chart-data.js
 * Environment variables:
 *   - SPOTIFY_CLIENT_ID
 *   - SPOTIFY_CLIENT_SECRET
 */

const fs = require('fs');
const path = require('path');

// Spotify API helpers
async function getSpotifyToken(clientId, clientSecret) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

function extractArtistId(spotifyUrl) {
  if (!spotifyUrl) return null;
  const match = spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function fetchWithRetry(url, options, retries = 3, timeout = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '3', 10);
        console.log(`Rate limited, waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok && i < retries - 1) {
        console.log(`Request failed (${response.status}), retrying...`);
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`Request timed out, retrying (${i + 1}/${retries})...`);
        if (i < retries - 1) continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

async function getArtistsBatch(artistIds, token) {
  const results = {};
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < artistIds.length; i += BATCH_SIZE) {
    const batch = artistIds.slice(i, i + BATCH_SIZE);
    console.log(`Fetching artist batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(artistIds.length/BATCH_SIZE)}`);
    
    const response = await fetchWithRetry(
      `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      for (const artist of (data.artists || [])) {
        if (artist) {
          results[artist.id] = artist;
        }
      }
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < artistIds.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return results;
}

async function getArtistAlbums(artistId, token, limit = 10) {
  const response = await fetchWithRetry(
    `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=MK&limit=${limit}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (!response.ok) return [];
  
  const data = await response.json();
  return data.items || [];
}

async function main() {
  console.log('Starting chart data generation...');
  
  // Get credentials from environment or local file
  let clientId = process.env.SPOTIFY_CLIENT_ID;
  let clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  // Try to load from local credentials file if not in env
  if (!clientId || !clientSecret) {
    try {
      const credPath = path.join(__dirname, '..', 'spotify-credentials.json');
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      clientId = creds.clientId;
      clientSecret = creds.clientSecret;
    } catch (e) {
      console.error('No Spotify credentials found. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars.');
      process.exit(1);
    }
  }
  
  // Get Spotify token
  console.log('Getting Spotify token...');
  const spotifyToken = await getSpotifyToken(clientId, clientSecret);
  console.log('Got Spotify token');
  
  // Load bands.json
  const bandsPath = path.join(__dirname, '..', 'bands.json');
  const bandsData = JSON.parse(fs.readFileSync(bandsPath, 'utf8'));
  const bands = bandsData.muzickaMasterLista || bandsData;
  console.log(`Loaded ${bands.length} bands`);
  
  // Filter bands with Spotify links
  const bandsWithSpotify = bands.filter(b => 
    b.links?.spotify && b.links.spotify !== 'недостигаат податоци'
  );
  console.log(`${bandsWithSpotify.length} bands have Spotify links`);
  
  // Build artist map
  const artistMap = new Map();
  for (const band of bandsWithSpotify) {
    const artistId = extractArtistId(band.links.spotify);
    if (artistId) {
      artistMap.set(artistId, band);
    }
  }
  
  const artistIds = Array.from(artistMap.keys());
  console.log(`Processing ${artistIds.length} unique artists`);
  
  // Fetch all artist info in batches
  const artistsInfo = await getArtistsBatch(artistIds, spotifyToken);
  console.log(`Got info for ${Object.keys(artistsInfo).length} artists`);
  
  // Fetch albums with rate limiting - increased batch size for speed
  const releases = [];
  const BATCH_SIZE = 20; // Process 20 artists at a time (up from 10)
  const BATCH_DELAY = 300; // 300ms between batches (down from 500ms)
  
  for (let i = 0; i < artistIds.length; i += BATCH_SIZE) {
    const batch = artistIds.slice(i, i + BATCH_SIZE);
    const pct = Math.round((i / artistIds.length) * 100);
    console.log(`Processing albums batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(artistIds.length/BATCH_SIZE)} (${pct}%)`);
    
    const batchResults = await Promise.all(
      batch.map(async (artistId) => {
        try {
          const band = artistMap.get(artistId);
          const artistInfo = artistsInfo[artistId];
          
          const albums = await getArtistAlbums(artistId, spotifyToken, 10);
          if (!albums?.length) return null;
          
          return albums.map(album => ({
            bandName: band.name,
            artistId,
            releaseId: album.id,
            releaseTitle: album.name,
            releaseType: album.album_type,
            releaseDate: album.release_date,
            releaseUrl: album.external_urls?.spotify,
            thumbnail: album.images?.[0]?.url || album.images?.[1]?.url,
            totalTracks: album.total_tracks,
            popularity: artistInfo?.popularity || 0,
            followers: artistInfo?.followers?.total || 0,
            spotifyUrl: band.links.spotify
          }));
        } catch (err) {
          console.warn(`Error for ${artistMap.get(artistId)?.name}: ${err.message}`);
          return null;
        }
      })
    );
    
    for (const result of batchResults) {
      if (result) releases.push(...result);
    }
    
    if (i + BATCH_SIZE < artistIds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }
  
  console.log(`Collected ${releases.length} releases`);
  
  // Generate chart data
  const now = new Date();
  const chartData = {
    generatedAt: now.toISOString(),
    totalReleases: releases.length,
    totalArtists: artistIds.length,
    releases: releases.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
  };
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'chart-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(chartData, null, 2));
  console.log(`Chart data written to ${outputPath}`);
  console.log(`Total releases: ${chartData.totalReleases}`);
  console.log(`Total artists: ${chartData.totalArtists}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
