/**
 * Spotify API Integration for Masterlista
 * Fetches new releases for artists based on their Spotify links in bands.json
 */

class SpotifyAPI {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.credentials = null;
        this.cache = {
            artistReleases: new Map(), // artistId -> { releases, timestamp }
            artistInfo: new Map()      // artistId -> { info, timestamp }
        };
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
        this.NEW_RELEASE_DAYS = 30; // Consider releases within last 30 days as "new"
        this.onReleaseFound = null; // Callback for progressive updates
    }

    /**
     * Load credentials from spotify-credentials.json
     */
    async loadCredentials() {
        if (this.credentials) return this.credentials;
        
        try {
            const response = await fetch('spotify-credentials.json');
            if (!response.ok) {
                console.warn('Spotify credentials not found. New releases feature disabled.');
                return null;
            }
            this.credentials = await response.json();
            
            if (!this.credentials.clientId || this.credentials.clientId === 'YOUR_SPOTIFY_CLIENT_ID_HERE') {
                console.warn('Spotify credentials not configured. Edit spotify-credentials.json with your API keys.');
                return null;
            }
            
            return this.credentials;
        } catch (error) {
            console.warn('Failed to load Spotify credentials:', error.message);
            return null;
        }
    }

    /**
     * Get access token using Client Credentials flow
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
            return this.accessToken;
        }

        const credentials = await this.loadCredentials();
        if (!credentials) return null;

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(`${credentials.clientId}:${credentials.clientSecret}`)
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Token request failed: ${errorData.error_description || response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            console.log('Spotify access token obtained');
            return this.accessToken;
        } catch (error) {
            console.error('Failed to get Spotify access token:', error);
            return null;
        }
    }

    /**
     * Extract artist ID from various Spotify URL formats
     */
    extractArtistId(spotifyUrl) {
        if (!spotifyUrl) return null;
        
        // Handle spotify:artist:ID format
        const uriMatch = spotifyUrl.match(/spotify:artist:([a-zA-Z0-9]+)/);
        if (uriMatch) return uriMatch[1];
        
        // Handle open.spotify.com/artist/ID format
        const urlMatch = spotifyUrl.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/);
        if (urlMatch) return urlMatch[1];
        
        // Handle just the ID
        if (/^[a-zA-Z0-9]{22}$/.test(spotifyUrl)) return spotifyUrl;
        
        return null;
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        const token = await this.getAccessToken();
        if (!token) return null;

        try {
            const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                }
            });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
                console.warn(`Spotify rate limited. Retry after ${retryAfter}s`);
                return null;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`Spotify API error: ${errorData.error?.message || response.statusText}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Spotify API request failed:', error);
            return null;
        }
    }

    /**
     * Get artist information
     */
    async getArtist(artistId) {
        // Check cache
        const cached = this.cache.artistInfo.get(artistId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.info;
        }

        const data = await this.apiRequest(`/artists/${artistId}`);
        if (data) {
            this.cache.artistInfo.set(artistId, { info: data, timestamp: Date.now() });
        }
        return data;
    }

    /**
     * Get artist's albums (including singles and EPs)
     */
    async getArtistAlbums(artistId, limit = 10) {
        // Check cache
        const cached = this.cache.artistReleases.get(artistId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.releases;
        }

        // Fetch albums, singles, and appears_on
        const data = await this.apiRequest(
            `/artists/${artistId}/albums?include_groups=album,single&limit=${limit}&market=US`
        );
        
        if (data?.items) {
            this.cache.artistReleases.set(artistId, { releases: data.items, timestamp: Date.now() });
            return data.items;
        }
        return [];
    }

    /**
     * Get detailed album/track information
     */
    async getAlbum(albumId) {
        return await this.apiRequest(`/albums/${albumId}`);
    }

    /**
     * Get album tracks with preview URLs
     */
    async getAlbumTracks(albumId) {
        return await this.apiRequest(`/albums/${albumId}/tracks?limit=50`);
    }

    /**
     * Get preview URL for an album (first available track preview)
     * Returns { previewUrl, trackName } or null
     */
    async getAlbumPreview(albumId) {
        const tracks = await this.getAlbumTracks(albumId);
        if (!tracks?.items) return null;
        
        // Find first track with a preview URL
        for (const track of tracks.items) {
            if (track.preview_url) {
                return {
                    previewUrl: track.preview_url,
                    trackName: track.name,
                    trackNumber: track.track_number,
                    durationMs: track.duration_ms
                };
            }
        }
        return null;
    }

    /**
     * Get artist's top tracks (most popular songs)
     * @param {string} artistId - Spotify artist ID
     * @param {string} market - Market code (default: US)
     * @returns {Array} Top tracks with preview URLs
     */
    async getArtistTopTracks(artistId, market = 'US') {
        const cacheKey = `topTracks_${artistId}`;
        const cached = this.cache.artistInfo.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.info;
        }

        const data = await this.apiRequest(`/artists/${artistId}/top-tracks?market=${market}`);
        if (data?.tracks) {
            this.cache.artistInfo.set(cacheKey, { info: data.tracks, timestamp: Date.now() });
            return data.tracks;
        }
        return [];
    }

    /**
     * Get preview URL for artist's most popular song
     * @param {string} spotifyUrl - Spotify artist URL
     * @returns {Object} { previewUrl, trackName, trackUrl } or null
     */
    async getArtistTopTrackPreview(spotifyUrl) {
        const artistId = this.extractArtistId(spotifyUrl);
        if (!artistId) return null;

        const topTracks = await this.getArtistTopTracks(artistId);
        if (!topTracks?.length) return null;

        // Find first track with a preview URL (most popular first)
        for (const track of topTracks) {
            if (track.preview_url) {
                return {
                    previewUrl: track.preview_url,
                    trackName: track.name,
                    trackUrl: track.external_urls?.spotify,
                    albumName: track.album?.name,
                    albumImage: track.album?.images?.[0]?.url,
                    durationMs: track.duration_ms,
                    popularity: track.popularity
                };
            }
        }
        return null;
    }

    /**
     * Get artist images from Spotify
     * Returns array of image objects { url, height, width }
     */
    async getArtistImages(spotifyUrl) {
        const artistId = this.extractArtistId(spotifyUrl);
        if (!artistId) return null;
        
        const artist = await this.getArtist(artistId);
        return artist?.images || null;
    }

    /**
     * Fetch artist images for multiple bands (for admin tool)
     * @param {Array} bands - Array of band objects with spotify links
     * @param {Function} onProgress - Progress callback
     * @returns {Object} Map of band name -> image URL
     */
    async fetchArtistImages(bands, onProgress = null) {
        const credentials = await this.loadCredentials();
        if (!credentials) return {};

        const bandsWithSpotify = bands.filter(b => 
            b.links?.spotify && b.links.spotify !== 'недостигаат податоци'
        );

        const results = {};
        const total = bandsWithSpotify.length;
        
        // Pre-fetch all artist info in batches
        const artistIdMap = new Map();
        for (const band of bandsWithSpotify) {
            const artistId = this.extractArtistId(band.links.spotify);
            if (artistId) {
                artistIdMap.set(artistId, band);
            }
        }
        
        const artistsInfo = await this.getArtistsBatch(Array.from(artistIdMap.keys()));
        
        let processed = 0;
        for (const [artistId, band] of artistIdMap) {
            const artist = artistsInfo[artistId];
            if (artist?.images?.length > 0) {
                // Get medium-sized image (usually 300x300)
                const image = artist.images.find(img => img.width >= 160 && img.width <= 400) 
                    || artist.images[0];
                results[band.name] = image.url;
            }
            processed++;
            if (onProgress) {
                onProgress({ processed, total, bandName: band.name, hasImage: !!results[band.name] });
            }
        }
        
        return results;
    }

    /**
     * Get multiple artists info in batch (up to 50)
     */
    async getArtistsBatch(artistIds) {
        if (!artistIds.length) return {};
        
        // Spotify allows up to 50 artists per request
        const results = {};
        const chunks = [];
        for (let i = 0; i < artistIds.length; i += 50) {
            chunks.push(artistIds.slice(i, i + 50));
        }
        
        for (const chunk of chunks) {
            const data = await this.apiRequest(`/artists?ids=${chunk.join(',')}`);
            if (data?.artists) {
                for (const artist of data.artists) {
                    if (artist) {
                        results[artist.id] = artist;
                        this.cache.artistInfo.set(artist.id, { info: artist, timestamp: Date.now() });
                    }
                }
            }
        }
        return results;
    }

    /**
     * Process a band and get their latest Spotify release
     */
    async getBandRelease(band) {
        const spotifyUrl = band.links?.spotify;
        if (!spotifyUrl || spotifyUrl === 'недостигаат податоци') {
            return null;
        }

        const artistId = this.extractArtistId(spotifyUrl);
        if (!artistId) {
            console.warn(`Could not extract Spotify artist ID from: ${spotifyUrl}`);
            return null;
        }

        try {
            const albums = await this.getArtistAlbums(artistId, 5);
            if (!albums || albums.length === 0) {
                return null;
            }

            // Find the most recent release
            const sortedAlbums = albums.sort((a, b) => 
                new Date(b.release_date) - new Date(a.release_date)
            );
            
            const latestRelease = sortedAlbums[0];
            const releaseDate = new Date(latestRelease.release_date);
            const daysSinceRelease = Math.floor((Date.now() - releaseDate) / (1000 * 60 * 60 * 24));
            const isNewRelease = daysSinceRelease <= this.NEW_RELEASE_DAYS;

            // Get best available image
            const thumbnail = latestRelease.images?.[0]?.url || 
                             latestRelease.images?.[1]?.url || null;

            // Get artist info for follower count (as popularity metric)
            const artistInfo = await this.getArtist(artistId);
            const followers = artistInfo?.followers?.total || 0;
            const popularity = artistInfo?.popularity || 0;

            return {
                bandName: band.name,
                artistId: artistId,
                releaseId: latestRelease.id,
                releaseTitle: latestRelease.name,
                releaseType: latestRelease.album_type, // album, single, compilation
                releaseDate: latestRelease.release_date,
                releaseDatePrecision: latestRelease.release_date_precision,
                releaseUrl: latestRelease.external_urls?.spotify,
                thumbnail: thumbnail,
                totalTracks: latestRelease.total_tracks,
                isNewRelease: isNewRelease,
                daysSinceRelease: daysSinceRelease,
                artistFollowers: followers,
                artistPopularity: popularity,
                // Keep original spotify URL for the artist
                artistUrl: spotifyUrl
            };
        } catch (error) {
            console.error(`Failed to get Spotify data for ${band.name}:`, error);
            return null;
        }
    }

    /**
     * Fetch new releases for all bands with Spotify links (streaming/progressive)
     * @param {Array} bands - Array of band objects
     * @param {Function} onProgress - Callback called with each batch result { release, bandName, progress }
     */
    async fetchAllNewReleases(bands, onProgress = null) {
        const credentials = await this.loadCredentials();
        if (!credentials) {
            console.log('Spotify integration disabled - no credentials');
            return { releases: [], mostViewed: null };
        }

        console.log('Fetching Spotify new releases...');
        const releases = [];
        const errors = [];

        const bandsWithSpotify = bands.filter(b => 
            b.links?.spotify && b.links.spotify !== 'недостигаат податоци'
        );

        const total = bandsWithSpotify.length;
        if (total === 0) {
            return { releases: [], allReleases: [], mostViewed: null, timestamp: new Date().toISOString() };
        }

        // Pre-fetch all artist info in batches of 50 (much faster)
        const artistIdMap = new Map(); // artistId -> band
        for (const band of bandsWithSpotify) {
            const artistId = this.extractArtistId(band.links.spotify);
            if (artistId) {
                artistIdMap.set(artistId, band);
            }
        }
        
        const allArtistIds = Array.from(artistIdMap.keys());
        console.log(`Pre-fetching ${allArtistIds.length} artists info...`);
        await this.getArtistsBatch(allArtistIds);

        // Process albums in parallel batches
        const BATCH_SIZE = 10; // Concurrent requests
        let processed = 0;

        for (let i = 0; i < bandsWithSpotify.length; i += BATCH_SIZE) {
            const batch = bandsWithSpotify.slice(i, i + BATCH_SIZE);
            
            const batchResults = await Promise.all(
                batch.map(async (band) => {
                    try {
                        const release = await this.getBandRelease(band);
                        processed++;
                        
                        // Call progress callback if provided
                        if (release && onProgress) {
                            onProgress({
                                release,
                                bandName: band.name,
                                progress: processed / total,
                                isNew: release.isNewRelease
                            });
                        }
                        
                        return release;
                    } catch (error) {
                        processed++;
                        errors.push({ band: band.name, error: error.message });
                        return null;
                    }
                })
            );

            releases.push(...batchResults.filter(r => r !== null));
        }

        // Filter to only new releases
        const newReleases = releases.filter(r => r.isNewRelease);

        // Find most popular new release (by artist followers)
        const mostViewed = newReleases.length > 0 
            ? newReleases.reduce((max, r) => 
                r.artistFollowers > (max?.artistFollowers || 0) ? r : max, null)
            : null;

        console.log(`Spotify: Found ${newReleases.length} new releases out of ${releases.length} total`);
        
        if (errors.length > 0) {
            console.warn(`Spotify: ${errors.length} bands had errors`);
        }

        return {
            releases: newReleases,
            allReleases: releases,
            mostViewed: mostViewed,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Build auto_labels-compatible structure from Spotify data
     */
    buildAutoLabels(spotifyData, bands) {
        const result = {
            generatedAt: spotifyData.timestamp,
            daysNewRelease: this.NEW_RELEASE_DAYS,
            source: 'spotify',
            mostViewedNewRelease: null,
            bands: {}
        };

        // Add most viewed/popular new release
        if (spotifyData.mostViewed) {
            const mv = spotifyData.mostViewed;
            result.mostViewedNewRelease = {
                bandName: mv.bandName,
                videoId: mv.releaseId, // Keep field name for compatibility
                videoUrl: mv.releaseUrl,
                videoTitle: mv.releaseTitle,
                viewCount: mv.artistFollowers, // Using followers as "views"
                publishedAt: mv.releaseDate,
                thumbnailUrl: mv.thumbnail
            };
        }

        // Build per-band entries
        for (const release of spotifyData.allReleases || []) {
            result.bands[release.bandName] = {
                spotify: {
                    url: release.artistUrl,
                    artistId: release.artistId,
                    isGeneralChannel: false, // Not applicable to Spotify
                    popular: release.artistPopularity >= 50 || release.artistFollowers >= 10000,
                    maxViewCount: release.artistFollowers,
                    topVideoId: release.releaseId,
                    topVideoUrl: release.releaseUrl,
                    newRelease: release.isNewRelease,
                    latestVideoId: release.releaseId,
                    latestVideoUrl: release.releaseUrl,
                    latestVideoPublishedAt: release.releaseDate,
                    latestVideoViewCount: release.artistFollowers,
                    latestVideoTitle: release.releaseTitle,
                    latestVideoThumbnail: release.thumbnail,
                    releaseType: release.releaseType,
                    totalTracks: release.totalTracks,
                    daysSinceRelease: release.daysSinceRelease,
                    newChannel: false,
                    channelCreatedAt: null
                }
            };
        }

        return result;
    }
}

// Export singleton instance
const spotifyApi = new SpotifyAPI();
