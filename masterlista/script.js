document.addEventListener('DOMContentLoaded', () => {
    // Silence console output in production; enable with ?debug=1
    try {
        const debugEnabled = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
        if (!debugEnabled && typeof window !== 'undefined' && window.console) {
            ['log','debug','info','warn','error'].forEach(m => { try { window.console[m] = function(){} } catch(_){} });
        }
    } catch (_) {}

    let bandsData = [];
    let originalBandsData = [];
    let hasUnsavedChanges = false;
    let isEditMode = false;
    let cachedAutoLabels = null; // Store auto_labels.json data globally
    let cachedChartData = null; // Store chart-data.json for releases data
    // Optional: set window.MMM_PR_ENDPOINT globally to override the button data-endpoint/localStorage

    console.log('Script loaded, initializing...');

    const cyrillicToLatinMap = {
        'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
        'Д': 'D', 'д': 'd', 'Ѓ': 'Gj', 'ѓ': 'gj', 'Е': 'E', 'е': 'e', 'Ж': 'Zh', 'ж': 'zh',
        'З': 'Z', 'з': 'z', 'Ѕ': 'Dz', 'ѕ': 'dz', 'И': 'I', 'и': 'i', 'Ј': 'J', 'ј': 'j',
        'К': 'K', 'к': 'k', 'Л': 'L', 'л': 'l', 'Љ': 'Lj', 'љ': 'lj', 'М': 'M', 'м': 'm',
        'Н': 'N', 'н': 'n', 'Њ': 'Nj', 'њ': 'nj', 'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p',
        'Р': 'R', 'р': 'r', 'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'Ќ': 'Kj', 'ќ': 'kj',
        'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'H', 'х': 'h', 'Ц': 'C', 'ц': 'c',
        'Ч': 'Ch', 'ч': 'ch', 'Џ': 'Dz', 'џ': 'dz', 'Ш': 'Sh', 'ш': 'sh'
    };

    const cyrillicToLatinShorthandMap = {
        'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v', 'Г': 'G', 'г': 'g',
        'Д': 'D', 'д': 'd', 'Ѓ': 'G', 'ѓ': 'g', 'Е': 'E', 'е': 'e', 'Ж': 'Z', 'ж': 'z',
        'З': 'Z', 'з': 'z', 'Ѕ': 'D', 'ѕ': 'd', 'И': 'I', 'и': 'i', 'Ј': 'J', 'ј': 'j',
        'К': 'K', 'к': 'k', 'Л': 'L', 'л': 'l', 'Љ': 'L', 'љ': 'l', 'М': 'M', 'м': 'm',
        'Н': 'N', 'н': 'n', 'Њ': 'N', 'њ': 'n', 'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p',
        'Р': 'R', 'р': 'r', 'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'Ќ': 'K', 'ќ': 'k',
        'У': 'U', 'у': 'u', 'Ф': 'F', 'ф': 'f', 'Х': 'H', 'х': 'h', 'Ц': 'C', 'ц': 'c',
        'Ч': 'C', 'ч': 'c', 'Џ': 'D', 'џ': 'd', 'Ш': 'S', 'ш': 's'
    };

    function transliterateCyrillicToLatin(text) {
        return text.split('')
            .map(char => cyrillicToLatinMap[char] || char)
            .join('');
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function computeChangesSummary(orig, curr) {
        const byName = (arr) => {
            const map = new Map();
            arr.forEach(b => map.set(b.name, b));
            return map;
        };
        const o = byName(orig);
        const c = byName(curr);
        const added = [];
        const removed = [];
        const modified = [];
        c.forEach((band, name) => {
            if (!o.has(name)) {
                added.push(name);
            } else {
                const prev = o.get(name);
                const fields = ['city','genre','soundsLike','isActive','label','contact'];
                const linkChanged = JSON.stringify(prev.links) !== JSON.stringify(band.links);
                const fieldChanges = [];
                fields.forEach(f => { if (prev[f] !== band[f]) fieldChanges.push({ field: f, from: prev[f], to: band[f] }); });
                if (linkChanged) fieldChanges.push({ field: 'links', from: prev.links, to: band.links });
                if (fieldChanges.length > 0) modified.push({ name, changes: fieldChanges });
            }
        });
        o.forEach((band, name) => { if (!c.has(name)) removed.push(name); });
        return { added, removed, modified };
    }

    function summarizeChangesText(diff) {
        const lines = [];
        if (diff.added.length) lines.push(`Додадени (${diff.added.length}): ${diff.added.join(', ')}`);
        if (diff.removed.length) lines.push(`Избришани (${diff.removed.length}): ${diff.removed.join(', ')}`);
        if (diff.modified.length) {
            const mods = diff.modified.map(m => `${m.name} [${m.changes.map(ch => ch.field).join(', ')}]`);
            lines.push(`Изменети (${diff.modified.length}): ${mods.join('; ')}`);
        }
        return lines.join('\n');
    }

    function updateSubmitButtonState() {
        const btn = document.getElementById('submit-pr-btn');
        if (!btn) return;
        btn.disabled = !hasUnsavedChanges;
        btn.title = hasUnsavedChanges ? 'Испрати барање за промена' : 'Нема промени за поднесување';
    }
    function transliterateCyrillicToLatinShorthand(text) {
        return text.split('')
            .map(char => cyrillicToLatinShorthandMap[char] || char)
            .join('');
    }

    function convertSpotifyUrlToAppUri(webUrl) {
        const match = webUrl.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return `spotify:artist:${match[1]}`;
        }
        return webUrl;
    }

    // Custom dialog and notification functions
    function showCustomDialog(title, message, inputPlaceholder = '', defaultValue = '', isPRForm = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog-modal');
            const titleEl = document.getElementById('dialog-title');
            const messageEl = document.getElementById('dialog-message');
            const inputContainer = document.getElementById('dialog-input-container');
            const prFormContainer = document.getElementById('pr-form-container');
            const inputEl = document.getElementById('dialog-input');
            const cancelBtn = document.getElementById('dialog-cancel-btn');
            const confirmBtn = document.getElementById('dialog-confirm-btn');
            const submitBtn = document.getElementById('dialog-submit-btn');

            titleEl.textContent = title;
            messageEl.textContent = message;

            if (isPRForm) {
                // Show PR form
                messageEl.style.display = 'none';
                inputContainer.style.display = 'none';
                prFormContainer.style.display = 'block';
                confirmBtn.style.display = 'none';
                submitBtn.style.display = 'inline-block';

                // Focus on contributor field
                const contributorInput = document.getElementById('pr-contributor');
                contributorInput.focus();

            } else {
                // Show simple dialog
                messageEl.style.display = 'block';
                prFormContainer.style.display = 'none';
                confirmBtn.style.display = 'inline-block';
                submitBtn.style.display = 'none';

                if (inputPlaceholder) {
                    inputContainer.style.display = 'block';
                    inputEl.placeholder = inputPlaceholder;
                    inputEl.value = defaultValue;
                    inputEl.focus();
                } else {
                    inputContainer.style.display = 'none';
                }
            }

            modal.style.display = 'block';

            const closeModal = () => {
                modal.style.display = 'none';
                // Clean up event listeners
                cancelBtn.removeEventListener('click', cancelHandler);
                confirmBtn.removeEventListener('click', confirmHandler);
                submitBtn.removeEventListener('click', submitHandler);
                modal.removeEventListener('click', outsideClickHandler);
                if (inputEl) inputEl.removeEventListener('keydown', enterHandler);
            };

            const cancelHandler = (e) => {
                e.stopPropagation();
                closeModal();
                resolve(null);
            };

            const confirmHandler = (e) => {
                e.stopPropagation();
                const value = inputPlaceholder ? inputEl.value : true;
                closeModal();
                resolve(value);
            };

            const submitHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Validate form
                const contributorInput = document.getElementById('pr-contributor');
                const descriptionInput = document.getElementById('pr-description');

                if (!descriptionInput.value.trim()) {
                    showNotification('Внесете опис на промените.', 'error');
                    descriptionInput.focus();
                    return;
                }

                const formData = {
                    contributor: contributorInput.value.trim(),
                    description: descriptionInput.value.trim()
                };

                closeModal();
                resolve(formData);
            };

            const outsideClickHandler = (e) => {
                if (e.target === modal) {
                    closeModal();
                    resolve(null);
                }
            };

            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    confirmHandler(e);
                }
            };

            cancelBtn.addEventListener('click', cancelHandler);
            confirmBtn.addEventListener('click', confirmHandler);
            submitBtn.addEventListener('click', submitHandler);
            modal.addEventListener('click', outsideClickHandler);

            if (!isPRForm && inputPlaceholder) {
                inputEl.addEventListener('keydown', enterHandler);
            }
        });
    }

    function showNotification(message, type = 'info', duration = 5000) {
        const notificationArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notificationArea.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);

        // Click to dismiss
        notification.onclick = () => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };
    }

    function generateCityColor(city) {
        const asciiSum = city.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const colorPalette = [
            { start: '#4a2c6d', end: '#2a4d8f' },
            { start: '#5e35b1', end: '#3949ab' },
            { start: '#6b3e99', end: '#8e4ec6' },
            { start: '#0288d1', end: '#03a9f4' },
            { start: '#2e7d32', end: '#4caf50' },
            { start: '#d32f2f', end: '#f44336' },
            { start: '#f57c00', end: '#ff9800' },
            { start: '#00695c', end: '#26a69a' },
            { start: '#0277bd', end: '#4fc3f7' },
            { start: '#b71c1c', end: '#d81b60' },
            { start: '#ff5722', end: '#ff8a65' },
            { start: '#00838f', end: '#4dd0e1' }
        ];
        const paletteIndex = asciiSum % colorPalette.length;
        const selectedGradient = colorPalette[paletteIndex];
        return `linear-gradient(135deg, ${selectedGradient.start} 0%, ${selectedGradient.end} 100%)`;
    }

    // Initialize scroll shadows for scrollable containers
    function initScrollShadows() {
        // Table wrapper (vertical scroll)
        const tableWrapper = document.querySelector('.table-wrapper');
        const scrollContainer = document.querySelector('.table-scroll-container');

        if (tableWrapper && scrollContainer) {
            // Create shadow overlay elements
            // IMPORTANT: Shadows appended to wrapper (fixed), listener attached to container (scrolling)
            const shadowTop = document.createElement('div');
            shadowTop.className = 'scroll-shadow-top';
            const shadowBottom = document.createElement('div');
            shadowBottom.className = 'scroll-shadow-bottom';
            tableWrapper.appendChild(shadowTop);
            tableWrapper.appendChild(shadowBottom);
            
            const updateTableShadows = () => {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                shadowTop.classList.toggle('visible', scrollTop > 5);
                shadowBottom.classList.toggle('visible', scrollTop < scrollHeight - clientHeight - 5);
            };
            scrollContainer.addEventListener('scroll', updateTableShadows);
            // Initial check and recheck after content loads
            updateTableShadows();
            setTimeout(updateTableShadows, 500);
        }

        // New release artists container (horizontal scroll via grid)
        const releaseContainer = document.getElementById('new-release-artists');
        if (releaseContainer) {
            // We need to observe when the grid is added and attach scroll listener
            const observer = new MutationObserver(() => {
                const releaseGrid = releaseContainer.querySelector('.new-release-grid');
                if (releaseGrid && !releaseGrid.dataset.shadowsInit) {
                    releaseGrid.dataset.shadowsInit = 'true';
                    
                    // Create shadow overlay elements for horizontal scroll
                    let shadowLeft = releaseContainer.querySelector('.scroll-shadow-left');
                    let shadowRight = releaseContainer.querySelector('.scroll-shadow-right');
                    if (!shadowLeft) {
                        shadowLeft = document.createElement('div');
                        shadowLeft.className = 'scroll-shadow-left';
                        releaseContainer.appendChild(shadowLeft);
                    }
                    if (!shadowRight) {
                        shadowRight = document.createElement('div');
                        shadowRight.className = 'scroll-shadow-right';
                        releaseContainer.appendChild(shadowRight);
                    }
                    
                    const updateReleaseShadows = () => {
                        const { scrollLeft, scrollWidth, clientWidth } = releaseGrid;
                        shadowLeft.classList.toggle('visible', scrollLeft > 5);
                        shadowRight.classList.toggle('visible', scrollLeft < scrollWidth - clientWidth - 5);
                    };
                    releaseGrid.addEventListener('scroll', updateReleaseShadows);
                    // Initial check
                    setTimeout(updateReleaseShadows, 100);
                }
            });
            observer.observe(releaseContainer, { childList: true, subtree: true });
        }
    }

    function validateEmail(email) {
        if (!email) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function validateName(name) {
        return name && name.trim().length >= 2;
    }

    function validateLinks(linksContainer) {
        const linkSelects = linksContainer.querySelectorAll('select');
        const linkInputs = linksContainer.querySelectorAll('input[type="url"]');
        const platforms = new Set();
        for (let i = 0; i < linkSelects.length; i++) {
            const platform = linkSelects[i].value;
            const url = linkInputs[i].value.trim();
            if (platform !== 'none' && url) {
                if (platforms.has(platform)) {
                    return { valid: false, message: `Дупликат платформа: ${platform}` };
                }
                platforms.add(platform);
            }
        }
        return { valid: true };
    }

    function getPreferredLink(band) {
        const linkPriority = ['youtube', 'spotify'];
        for (const platform of linkPriority) {
            if (band.links[platform] && band.links[platform] !== 'недостигаат податоци') {
                return { platform, url: platform === 'spotify' ? convertSpotifyUrlToAppUri(band.links[platform]) : band.links[platform] };
            }
        }
        const firstPlatform = Object.keys(band.links).find(p => p !== 'none' && band.links[p] !== 'недостигаат податоци');
        if (firstPlatform) {
            return { platform: firstPlatform, url: band.links[firstPlatform] };
        }
        return { platform: 'none', url: null };
    }

    /**
     * Load Spotify releases from static chart-data.json file
     * (Generated daily by GitHub Action)
     */
    async function loadChartDataReleases(rawBands, processedBands) {
        try {
            console.log('Loading releases from chart-data.json...');
            
            const response = await fetch('chart-data.json');
            if (!response.ok) {
                throw new Error(`Failed to load chart-data.json: ${response.status}`);
            }
            
            const chartData = await response.json();
            const releases = chartData.releases || [];
            
            if (releases.length === 0) {
                console.log('No releases found in chart-data.json');
                return;
            }
            
            // Find most viewed release
            let mostViewed = null;
            
            // Process each release - only keep the most recent release per artist
            releases.forEach(release => {
                const bandName = release.bandName;
                
                // Update mostViewed (now based on popularity)
                if (!mostViewed || (release.popularity || 0) > (mostViewed.popularity || 0)) {
                    mostViewed = release;
                }
                
                // Update cachedAutoLabels - only if this release is newer than existing
                if (!cachedAutoLabels.bands[bandName]) {
                    cachedAutoLabels.bands[bandName] = {};
                }
                
                const existingDate = cachedAutoLabels.bands[bandName]?.spotify?.latestVideoPublishedAt;
                const newDate = release.releaseDate;
                
                // Only update if no existing data or this release is newer
                if (!existingDate || newDate > existingDate) {
                    cachedAutoLabels.bands[bandName].spotify = {
                        url: release.releaseUrl,
                        artistId: release.releaseId,
                        isGeneralChannel: false,
                        popular: (release.popularity || 0) >= 30 || release.followers >= 10000,
                        maxViewCount: release.popularity || release.followers,
                        newRelease: true,
                        latestVideoId: release.releaseId,
                        latestVideoUrl: release.topTrackUrl || release.releaseUrl,
                        latestVideoPublishedAt: release.releaseDate,
                        latestVideoViewCount: release.popularity || 0, // Use track popularity
                        latestVideoTitle: release.releaseTitle,
                        latestVideoThumbnail: release.thumbnail,
                        releaseType: release.releaseType,
                        topTrackName: release.topTrackName
                    };
                }
                
                // Update band's label in bandsData
                const band = processedBands.find(b => b.name === bandName);
                if (band) {
                    const existingLabels = (band.label || '').split(',').map(l => l.trim()).filter(Boolean);
                    if (!existingLabels.includes('Ново Издание')) {
                        existingLabels.push('Ново Издание');
                        band.label = existingLabels.join(', ');
                    }
                }
            });
            
            // Update source and most viewed
            cachedAutoLabels.source = 'spotify';
            if (mostViewed) {
                cachedAutoLabels.mostViewedNewRelease = {
                    bandName: mostViewed.bandName,
                    videoId: mostViewed.releaseId,
                    videoUrl: mostViewed.topTrackUrl || mostViewed.releaseUrl,
                    videoTitle: mostViewed.releaseTitle,
                    viewCount: mostViewed.popularity || 0,
                    publishedAt: mostViewed.releaseDate,
                    thumbnailUrl: mostViewed.thumbnail
                };
            }
            
            // Re-render new releases section
            renderNewReleaseArtists(processedBands);
            
            console.log(`Loaded ${releases.length} releases from chart-data.json`);
        } catch (err) {
            console.warn('Failed to load chart-data.json:', err);
            // Fall back to Spotify API if available
            if (typeof spotifyApi !== 'undefined') {
                console.log('Falling back to Spotify API...');
                fetchSpotifyReleasesInBackground(rawBands, processedBands);
            }
        }
    }

    /**
     * Fetch Spotify releases in background and update UI progressively
     */
    async function fetchSpotifyReleasesInBackground(rawBands, processedBands) {
        try {
            console.log('Background: Fetching Spotify releases...');
            
            const newReleases = [];
            let mostViewed = null;
            
            // Progress callback - updates UI as releases are found
            const onProgress = ({ release, bandName, progress, isNew }) => {
                if (isNew) {
                    newReleases.push(release);
                    
                    // Update mostViewed
                    if (!mostViewed || release.artistFollowers > mostViewed.artistFollowers) {
                        mostViewed = release;
                    }
                    
                    // Update cachedAutoLabels
                    if (!cachedAutoLabels.bands[bandName]) {
                        cachedAutoLabels.bands[bandName] = {};
                    }
                    cachedAutoLabels.bands[bandName].spotify = {
                        url: release.artistUrl,
                        artistId: release.artistId,
                        isGeneralChannel: false,
                        popular: release.artistPopularity >= 50 || release.artistFollowers >= 10000,
                        maxViewCount: release.artistFollowers,
                        newRelease: release.isNewRelease,
                        latestVideoId: release.releaseId,
                        latestVideoUrl: release.releaseUrl,
                        latestVideoPublishedAt: release.releaseDate,
                        latestVideoViewCount: release.artistFollowers,
                        latestVideoTitle: release.releaseTitle,
                        latestVideoThumbnail: release.thumbnail,
                        releaseType: release.releaseType,
                        totalTracks: release.totalTracks,
                        daysSinceRelease: release.daysSinceRelease
                    };
                    
                    // Update band's label in bandsData
                    const band = processedBands.find(b => b.name === bandName);
                    if (band) {
                        const existingLabels = (band.label || '').split(',').map(l => l.trim()).filter(Boolean);
                        if (!existingLabels.includes('Ново Издание')) {
                            existingLabels.push('Ново Издание');
                            band.label = existingLabels.join(', ');
                        }
                    }
                    
                    // Re-render new releases section with updated data
                    cachedAutoLabels.source = 'spotify';
                    if (mostViewed) {
                        cachedAutoLabels.mostViewedNewRelease = {
                            bandName: mostViewed.bandName,
                            videoId: mostViewed.releaseId,
                            videoUrl: mostViewed.releaseUrl,
                            videoTitle: mostViewed.releaseTitle,
                            viewCount: mostViewed.artistFollowers,
                            publishedAt: mostViewed.releaseDate,
                            thumbnailUrl: mostViewed.thumbnail
                        };
                    }
                    
                    renderNewReleaseArtists(processedBands);
                }
            };
            
            await spotifyApi.fetchAllNewReleases(rawBands, onProgress);
            
            console.log(`Background: Spotify fetch complete. Found ${newReleases.length} new releases.`);
        } catch (err) {
            console.warn('Background Spotify fetch error:', err);
        }
    }

    function renderNewReleaseArtists(bands) {
        console.log('Rendering Ново Издание artists');
        const newReleaseContainer = document.getElementById('new-release-artists');
        
        // Clear container - no header, just show releases directly
        newReleaseContainer.innerHTML = '';

        // Calculate date one month ago
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        oneMonthAgo.setHours(0, 0, 0, 0); // Start of day for fair comparison

        // Filter by "Ново Издание" label and release date within past month
        let newReleaseBands = bands.filter(band => {
            if (!band.label || band.label === 'недостигаат податоци') return false;
            const labels = String(band.label).split(',').map(l => l.trim()).filter(Boolean);
            if (!labels.includes('Ново Издание')) return false;
            
            // Filter by release date - only show releases from the past month
            const bandData = cachedAutoLabels?.bands?.[band.name];
            const releaseDate = bandData?.spotify?.latestVideoPublishedAt || bandData?.youtube?.latestVideoPublishedAt;
            
            // If no release date available, exclude from new releases bar
            if (!releaseDate) return false;
            
            const releaseDateObj = new Date(releaseDate);
            return releaseDateObj >= oneMonthAgo;
        });
        
        // Sort by release date (newest first)
        newReleaseBands.sort((a, b) => {
            const aData = cachedAutoLabels?.bands?.[a.name];
            const bData = cachedAutoLabels?.bands?.[b.name];
            const aDate = aData?.spotify?.latestVideoPublishedAt || aData?.youtube?.latestVideoPublishedAt || '';
            const bDate = bData?.spotify?.latestVideoPublishedAt || bData?.youtube?.latestVideoPublishedAt || '';
            return bDate.localeCompare(aDate); // Descending order (newest first)
        });
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'new-release-content';
        
        if (newReleaseBands.length === 0) {
            // Show loading if Spotify is loading
            const isLoading = cachedAutoLabels?.source === 'none' && typeof spotifyApi !== 'undefined';
            contentWrapper.innerHTML = isLoading
                ? '<p class="loading-releases"><i class="fas fa-spinner fa-spin"></i> Се вчитуваат нови изданија...</p>'
                : '<p>Нема нови изданија во последните 30 дена.</p>';
            newReleaseContainer.appendChild(contentWrapper);
            return;
        }

        const streamingOrder = ['youtube', 'spotify', 'itunes', 'deezer', 'bandcamp', 'soundcloud'];

        // Create a grid/list container for release cards
        const releaseGrid = document.createElement('div');
        releaseGrid.className = 'new-release-grid';
        
        // Add horizontal scroll wheel support
        releaseGrid.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                releaseGrid.scrollLeft += e.deltaY;
            }
        }, { passive: false });

        newReleaseBands.forEach(band => {
            // Get auto_labels data for this band (supports both YouTube and Spotify)
            const bandData = cachedAutoLabels?.bands?.[band.name];
            const autoData = bandData?.youtube || bandData?.spotify || null;
            const hasReleaseData = autoData?.latestVideoId && autoData?.latestVideoTitle;
            const isSpotify = !!bandData?.spotify;
            
            // Filter: skip if band name is not in title for general channels (YouTube only)
            if (hasReleaseData && !isSpotify) {
                const releaseTitle = (autoData.latestVideoTitle || '').toLowerCase();
                const bandNameLower = band.name.toLowerCase();
                const isGeneralChannel = autoData.isGeneralChannel === true;
                
                // Skip if general channel and band name not in title
                if (isGeneralChannel && !releaseTitle.includes(bandNameLower)) {
                    return;
                }
            }
            
            const releaseCard = document.createElement('div');
            releaseCard.className = 'new-release-card';

            // Collect available streaming links in preferred order
            const streamingLinks = streamingOrder
                .filter(p => band.links && band.links[p] && band.links[p] !== 'недостигаат податоци')
                .map(p => ({
                    platform: p,
                    url: p === 'spotify' ? convertSpotifyUrlToAppUri(band.links[p]) : band.links[p]
                }));

            // Build icons for all available streaming services
            const iconsHtml = streamingLinks
                .map(({ platform, url }) => {
                    const platformMeta = socialPlatforms.find(p => p.id === platform);
                    const icon = platformMeta?.icon || 'fa-solid fa-link';
                    const title = platformMeta?.name || platform;
                    return `<a href="${url}" target="_blank" title="${title}" class="streaming-icon"><i class="${icon}"></i></a>`;
                })
                .join('');

            if (hasReleaseData) {
                // Show thumbnail and release info
                const releaseUrl = autoData.latestVideoUrl || '#';
                const thumbnail = autoData.latestVideoThumbnail || 
                    (autoData.latestVideoId && !isSpotify ? `https://img.youtube.com/vi/${autoData.latestVideoId}/mqdefault.jpg` : null);
                const releaseTitle = autoData.latestVideoTitle;
                const viewCount = autoData.latestVideoViewCount || 0;
                
                // Format view/follower count
                const countLabel = isSpotify ? '' : ' ';
                const formattedViews = viewCount >= 1000000 
                    ? (viewCount / 1000000).toFixed(1) + 'М'
                    : viewCount >= 1000 
                        ? (viewCount / 1000).toFixed(1) + 'К'
                        : viewCount.toString();
                
                // Format release date
                let releaseDateHtml = '';
                if (autoData.latestVideoPublishedAt) {
                    const pubDate = new Date(autoData.latestVideoPublishedAt);
                    const day = pubDate.getDate();
                    const monthNames = ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек'];
                    const month = monthNames[pubDate.getMonth()];
                    releaseDateHtml = `<span class="release-date"><i class="fas fa-calendar-alt"></i> ${day} ${month}</span>`;
                }
                
                // Play overlay icon (different for YouTube vs Spotify)
                const playIcon = isSpotify ? 'fab fa-spotify' : 'fas fa-play-circle';
                // Preview button for Spotify releases (plays embed)
                const spotifyButtonHtml = isSpotify && autoData.latestVideoId 
                    ? `<button class="preview-btn" data-album-id="${autoData.latestVideoId}" title="Преслушај на Spotify"><i class="fas fa-play"></i></button>`
                    : '';
                
                releaseCard.innerHTML = `
                    <a href="${releaseUrl}" target="_blank" class="release-thumbnail-link">
                        <div class="release-thumbnail ${!thumbnail ? 'no-thumb' : ''}">
                            ${thumbnail ? `<img src="${thumbnail}" alt="${releaseTitle}" loading="lazy" onerror="this.onerror=null; this.style.display='none'; this.parentElement.classList.add('no-thumb'); this.insertAdjacentHTML('afterend', '<i class=\\'fab fa-spotify spotify-placeholder\\'></i>');">` : `<i class="fab fa-spotify spotify-placeholder"></i>`}
                            <div class="play-overlay"><i class="${playIcon}"></i></div>
                        </div>
                    </a>
                    <div class="release-info">
                        <div class="release-artist">${band.name}</div>
                        <a href="${releaseUrl}" target="_blank" class="release-title" title="${releaseTitle}">${releaseTitle}</a>
                        <div class="release-meta">
                            ${releaseDateHtml}
                            ${!isSpotify ? `<span class="release-views"><i class="fas fa-eye"></i> ${formattedViews}</span>` : ''}
                            ${isSpotify && viewCount > 0 ? `<span class="release-views" title="Популарност"><i class="fas fa-fire"></i> ${viewCount}</span>` : ''}
                            <span class="release-links">${iconsHtml}${spotifyButtonHtml}</span>
                        </div>
                    </div>
                `;
            } else {
                // Fallback: show simple list item style without thumbnail
                const { url: anyUrl } = getPreferredLink(band);
                const nameAnchorHtml = anyUrl 
                    ? `<a href="${anyUrl}" target="_blank">${band.name}</a>` 
                    : band.name;
                
                releaseCard.innerHTML = `
                    <div class="release-info release-info-compact">
                        <div class="release-artist">${nameAnchorHtml}</div>
                        <div class="release-links">${iconsHtml || '<span class="missing-data"><i class="fas fa-question-circle"></i></span>'}</div>
                    </div>
                `;
                releaseCard.classList.add('no-thumbnail');
            }

            releaseGrid.appendChild(releaseCard);
        });
        contentWrapper.appendChild(releaseGrid);
        newReleaseContainer.appendChild(contentWrapper);
        
        // Add event listeners for preview buttons (lazy-loaded previews)
        newReleaseContainer.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handlePreviewClick(btn);
            });
        });
    }
    
    // Handle preview button clicks - shows Spotify embed player
    async function handlePreviewClick(btn) {
        const albumId = btn.dataset.albumId;
        const releaseCard = btn.closest('.new-release-card');
        const releaseUrl = releaseCard?.querySelector('.release-thumbnail-link')?.href;
        
        // Extract Spotify ID and type from URL
        let spotifyId = albumId;
        let spotifyType = 'artist'; // default
        
        if (releaseUrl && releaseUrl.includes('spotify.com')) {
            // Parse the URL to get type and ID
            // Format: https://open.spotify.com/artist/XXXX or /album/XXXX or /track/XXXX
            const match = releaseUrl.match(/spotify\.com\/(artist|album|track)\/([a-zA-Z0-9]+)/);
            if (match) {
                spotifyType = match[1];
                spotifyId = match[2];
            }
        }
        
        showSpotifyEmbed(spotifyId, spotifyType);
    }
    
    // Show Spotify embed player in modal
    function showSpotifyEmbed(spotifyId, type = 'artist') {
        const modal = document.getElementById('spotify-embed-modal');
        const container = document.getElementById('spotify-embed-container');
        
        if (!modal || !container) return;
        
        // Create embed iframe
        // Spotify embed URL format: https://open.spotify.com/embed/{type}/{id}
        const embedUrl = `https://open.spotify.com/embed/${type}/${spotifyId}?utm_source=generator&theme=0`;
        
        container.innerHTML = `
            <iframe 
                src="${embedUrl}" 
                width="100%" 
                height="${type === 'track' ? '152' : '352'}" 
                frameBorder="0" 
                allowfullscreen="" 
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
            ></iframe>
        `;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Close on backdrop click
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeSpotifyEmbed();
            }
        };
        
        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeSpotifyEmbed();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    // Close Spotify embed modal
    function closeSpotifyEmbed() {
        const modal = document.getElementById('spotify-embed-modal');
        const container = document.getElementById('spotify-embed-container');
        
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
        if (container) {
            container.innerHTML = ''; // Clear iframe to stop playback
        }
    }
    
    // Initialize Spotify embed modal close button
    function initializeSpotifyEmbedModal() {
        const closeBtn = document.querySelector('.spotify-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeSpotifyEmbed);
        }
    }

    async function loadBandsData() {
        const loadingBar = document.getElementById('loading-bar');
        const controls = document.querySelector('.controls');
        try {
            console.log('Loading bands data...');
            loadingBar.classList.add('active');
            controls.style.display = 'none';

            // Load chart data first for artist images
            try {
                const chartResponse = await fetch('chart-data.json');
                cachedChartData = await chartResponse.json();
                console.log('Loaded chart-data.json with', cachedChartData.releases?.length || 0, 'releases');
            } catch (chartError) {
                console.warn('Could not load chart-data.json:', chartError);
                cachedChartData = { releases: [] };
            }

            const response = await fetch('bands.json');
            const data = await response.json();
            
            // Initialize without Spotify data - load immediately
            cachedAutoLabels = { bands: {}, source: 'none' };
            
            // Helper to remove "Ново Издание" from manual labels (only use Spotify data)
            const CONTROLLED_LABELS = ['Ново Издание', '★', 'Ново'];
            
            function mergeComputedLabels(existingLabel, computedLabels) {
                const existing = (!existingLabel || existingLabel === 'недостигаат податоци')
                    ? []
                    : String(existingLabel).split(',').map(l => l.trim()).filter(Boolean);
                const merged = [...existing];
                computedLabels.forEach(l => { if (!merged.includes(l)) merged.push(l); });
                return merged.length ? merged.join(', ') : null;
            }

            function removeComputedLabels(existingLabel, labelsToRemove) {
                const existing = (!existingLabel || existingLabel === 'недостигаат податоци')
                    ? []
                    : String(existingLabel).split(',').map(l => l.trim()).filter(Boolean);
                const filtered = existing.filter(l => !labelsToRemove.includes(l));
                return filtered.length ? filtered.join(', ') : null;
            }

            bandsData = data.muzickaMasterLista.map((band) => {
                    let status;
                    if (band.isActive === true) {
                        status = 'Активен';
                    } else if (band.isActive === false) {
                        status = 'Неактивен';
                    } else {
                        status = band.isActive || 'Непознато';
                    }
                    
                    // Remove manual "Ново Издание" tags - only Spotify data will add them
                    let label = band.label || null;
                    label = removeComputedLabels(label, CONTROLLED_LABELS);
                    
                    return {
                        name: band.name || 'недостигаат податоци',
                        city: band.city || 'недостигаат податоци',
                        genre: band.genre || 'недостигаат податоци',
                        soundsLike: band.soundsLike || 'недостигаат податоци',
                        isActive: status,
                        links: Object.keys(band.links).length ? band.links : { none: 'недостигаат податоци' },
                        contact: band.contact || 'недостигаат податоци',
                        lastfmName: band.lastfmName || null,
                        label
                    };
                });
            bandsData.sort((a, b) => {
                const nameA = transliterateCyrillicToLatin(a.name);
                const nameB = transliterateCyrillicToLatin(b.name);
                return nameA.localeCompare(nameB, 'en');
            });
            document.getElementById('total-bands').textContent = bandsData.length;
            
            // Fetch last modified date from GitHub API
            try {
                const response = await fetch('https://api.github.com/repos/martinpetkovski/martinpetkovski.github.io/commits?path=masterlista/bands.json&per_page=1');
                if (response.ok) {
                    const commits = await response.json();
                    if (commits.length > 0) {
                        const lastCommit = commits[0];
                        const lastModified = new Date(lastCommit.commit.committer.date);
                        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
                        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
                        const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
                        const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
                        document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;
                    } else {
                        // Fallback to hardcoded date if no commits found
                        const lastModified = new Date('2025-05-24T00:00:00');
                        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
                        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
                        const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
                        const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
                        document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;
                    }
                } else {
                    throw new Error('GitHub API request failed');
                }
            } catch (error) {
                console.warn('Failed to fetch last modified date from GitHub:', error);
                // Fallback to hardcoded date
                const lastModified = new Date('2025-05-24T00:00:00');
                const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
                const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
                const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
                const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
                document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;
            }
            
            console.log(`Loaded ${bandsData.length} bands`);
            originalBandsData = JSON.parse(JSON.stringify(bandsData));
            populateFilters(bandsData);
            renderBands(bandsData);
            renderNewReleaseArtists(bandsData);
            initializeFilters();
            initializeModal();
            initializeSpotifyEmbedModal();
            initializeCopyData();
            initializeSubmitPR();
            updateSubmitButtonState();
            initScrollShadows();
            
            // Load Spotify data from static JSON (generated by GitHub Action)
            loadChartDataReleases(data.muzickaMasterLista, bandsData);
        } catch (error) {
            console.error('Error loading bands:', error);
            document.getElementById('band-table-body').innerHTML = '<tr><td colspan="8">Извинете, нешто тргна наопаку.</td></tr>';
        } finally {
            loadingBar.classList.remove('active');
            controls.style.display = '';
        }
    }

    const socialPlatforms = [
        { id: 'facebook', name: 'Facebook', icon: 'fa-brands fa-facebook' },
        { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram' },
        { id: 'twitter', name: 'Twitter', icon: 'fa-brands fa-twitter' },
        { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube' },
        { id: 'spotify', name: 'Spotify', icon: 'fa-brands fa-spotify' },
        { id: 'bandcamp', name: 'Bandcamp', icon: 'fa-brands fa-bandcamp' },
        { id: 'soundcloud', name: 'SoundCloud', icon: 'fa-brands fa-soundcloud' },
        { id: 'itunes', name: 'Apple Music', icon: 'fa-brands fa-itunes-note' },
        { id: 'deezer', name: 'Deezer', icon: 'fa-brands fa-deezer' },
        { id: 'lastfm', name: 'Last.fm', icon: 'fa-brands fa-lastfm' },
        { id: 'wikipedia', name: 'Wikipedia', icon: 'fa-brands fa-wikipedia-w' },
        { id: 'tiktok', name: 'TikTok', icon: 'fa-brands fa-tiktok' },
        { id: 'linkedin', name: 'LinkedIn', icon: 'fa-brands fa-linkedin' },
        { id: 'pinterest', name: 'Pinterest', icon: 'fa-brands fa-pinterest' },
        { id: 'twitch', name: 'Twitch', icon: 'fa-brands fa-twitch' },
        { id: 'vimeo', name: 'Vimeo', icon: 'fa-brands fa-vimeo' },
        { id: 'patreon', name: 'Patreon', icon: 'fa-brands fa-patreon' },
        { id: 'discord', name: 'Discord', icon: 'fa-brands fa-discord' },
        { id: 'website', name: 'Website', icon: 'fa-solid fa-globe' },
        { id: 'linktree', name: 'Linktree', icon: 'fa-solid fa-tree' },
        { id: 'generic', name: 'Друг линк', icon: 'fa-solid fa-link' }
    ];

    function initializeFilters() {
        console.log('Initializing filters');
        $('#filter-city').select2({
            placeholder: 'Сите градови',
            allowClear: true,
            width: '100%'
        }).val('').trigger('change');
        $('#filter-genre').select2({
            placeholder: 'Сите жанрови',
            allowClear: true,
            width: '100%'
        }).val('').trigger('change');
        $('#filter-sounds-like').select2({
            placeholder: 'Звучи како било кој',
            allowClear: true,
            width: '100%'
        }).val('').trigger('change');
        $('#filter-status').select2({
            placeholder: 'Сите статуси',
            allowClear: true,
            width: '100%'
        }).val('').trigger('change');
        $('#filter-label').select2({
            placeholder: 'Сите ознаки',
            allowClear: true,
            width: '100%'
        }).val('').trigger('change');
        document.getElementById('search-name').addEventListener('input', filterBands);
        $('#filter-city').on('change', filterBands);
        $('#filter-genre').on('change', filterBands);
        $('#filter-sounds-like').on('change', filterBands);
        $('#filter-status').on('change', filterBands);
        $('#filter-label').on('change', filterBands);
        document.getElementById('clear-filters').addEventListener('click', () => {
            console.log('Clear filters clicked');
            document.getElementById('search-name').value = '';
            $('#filter-city').val('').trigger('change');
            $('#filter-genre').val('').trigger('change');
            $('#filter-sounds-like').val('').trigger('change');
            $('#filter-status').val('').trigger('change');
            $('#filter-label').val('').trigger('change');
            filterBands();
        });
        document.getElementById('toggle-filters').addEventListener('click', () => {
            console.log('Toggle filters clicked');
            const controls = document.querySelector('.controls');
            controls.classList.toggle('active');
            const isActive = controls.classList.contains('active');
            document.getElementById('toggle-filters').innerHTML = `<i class="fas ${isActive ? 'fa-times' : 'fa-filter'}"></i>`;
        });
    }

    // Autocomplete data cache
    let autocompleteData = {
        cities: [],
        genres: [],
        soundsLike: [],
        labels: []
    };

    // Build autocomplete data from bands
    function buildAutocompleteData() {
        const cityCounts = {};
        const genreCounts = {};
        const soundsLikeCounts = {};
        const labelCounts = {};

        bandsData.forEach(band => {
            if (band.city && band.city !== 'недостигаат податоци') {
                band.city.split(',').map(c => c.trim()).filter(Boolean).forEach(city => {
                    cityCounts[city] = (cityCounts[city] || 0) + 1;
                });
            }
            if (band.genre && band.genre !== 'недостигаат податоци') {
                band.genre.split(',').map(g => g.trim()).filter(Boolean).forEach(genre => {
                    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                });
            }
            if (band.soundsLike && band.soundsLike !== 'недостигаат податоци') {
                band.soundsLike.split(',').map(s => s.trim()).filter(Boolean).forEach(sound => {
                    soundsLikeCounts[sound] = (soundsLikeCounts[sound] || 0) + 1;
                });
            }
            if (band.label && band.label !== 'недостигаат податоци') {
                band.label.split(',').map(l => l.trim()).filter(Boolean).forEach(label => {
                    labelCounts[label] = (labelCounts[label] || 0) + 1;
                });
            }
        });

        // Sort by count descending, then alphabetically
        const sortByCountThenAlpha = (counts) => {
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1] || transliterateCyrillicToLatin(a[0]).localeCompare(transliterateCyrillicToLatin(b[0]), 'en'))
                .map(([name, count]) => ({ name, count }));
        };

        autocompleteData.cities = sortByCountThenAlpha(cityCounts);
        autocompleteData.genres = sortByCountThenAlpha(genreCounts);
        autocompleteData.soundsLike = sortByCountThenAlpha(soundsLikeCounts);
        autocompleteData.labels = sortByCountThenAlpha(labelCounts);
    }

    // Initialize autocomplete for form fields
    function initializeAutocomplete() {
        buildAutocompleteData();

        const fields = [
            { inputId: 'band-city', dropdownId: 'band-city-autocomplete', data: () => autocompleteData.cities },
            { inputId: 'band-genre', dropdownId: 'band-genre-autocomplete', data: () => autocompleteData.genres },
            { inputId: 'band-sounds-like', dropdownId: 'band-sounds-like-autocomplete', data: () => autocompleteData.soundsLike },
            { inputId: 'band-label', dropdownId: 'band-label-autocomplete', data: () => autocompleteData.labels }
        ];

        fields.forEach(({ inputId, dropdownId, data }) => {
            const input = document.getElementById(inputId);
            const dropdown = document.getElementById(dropdownId);
            if (!input || !dropdown) return;

            let selectedIndex = -1;

            // Get the current partial term being typed (after last comma)
            const getCurrentTerm = () => {
                const value = input.value;
                const lastCommaIndex = value.lastIndexOf(',');
                return lastCommaIndex >= 0 ? value.substring(lastCommaIndex + 1).trim() : value.trim();
            };

            // Get already selected items
            const getSelectedItems = () => {
                const value = input.value;
                const lastCommaIndex = value.lastIndexOf(',');
                if (lastCommaIndex < 0) return [];
                return value.substring(0, lastCommaIndex).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            };

            // Filter and render suggestions
            const showSuggestions = () => {
                const term = getCurrentTerm().toLowerCase();
                const selectedItems = getSelectedItems();
                const allData = data();

                // Filter: match term and exclude already selected
                const filtered = allData.filter(item => {
                    const nameLower = item.name.toLowerCase();
                    const matchesTerm = term === '' || nameLower.includes(term);
                    const notAlreadySelected = !selectedItems.includes(nameLower);
                    return matchesTerm && notAlreadySelected;
                }).slice(0, 15); // Limit to 15 suggestions

                if (filtered.length === 0) {
                    dropdown.classList.remove('active');
                    dropdown.innerHTML = '';
                    return;
                }

                dropdown.innerHTML = filtered.map((item, idx) => 
                    `<div class="autocomplete-item${idx === selectedIndex ? ' selected' : ''}" data-value="${item.name}">${item.name}<span class="count">(${item.count})</span></div>`
                ).join('');

                dropdown.classList.add('active');
                selectedIndex = -1;
            };

            // Select an item
            const selectItem = (value) => {
                const currentValue = input.value;
                const lastCommaIndex = currentValue.lastIndexOf(',');
                const prefix = lastCommaIndex >= 0 ? currentValue.substring(0, lastCommaIndex + 1) + ' ' : '';
                input.value = prefix + value + ', ';
                dropdown.classList.remove('active');
                dropdown.innerHTML = '';
                input.focus();
                // Trigger tag update
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
            };

            // Input event
            input.addEventListener('input', () => {
                showSuggestions();
            });

            // Focus event
            input.addEventListener('focus', () => {
                showSuggestions();
            });

            // Blur event (delayed to allow click)
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    dropdown.classList.remove('active');
                }, 200);
            });

            // Keyboard navigation
            input.addEventListener('keydown', (e) => {
                const items = dropdown.querySelectorAll('.autocomplete-item');
                if (!items.length) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    items.forEach((item, idx) => item.classList.toggle('selected', idx === selectedIndex));
                    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    items.forEach((item, idx) => item.classList.toggle('selected', idx === selectedIndex));
                    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter' && selectedIndex >= 0) {
                    e.preventDefault();
                    const selectedItem = items[selectedIndex];
                    if (selectedItem) {
                        selectItem(selectedItem.dataset.value);
                    }
                } else if (e.key === 'Escape') {
                    dropdown.classList.remove('active');
                }
            });

            // Click on suggestion
            dropdown.addEventListener('click', (e) => {
                const item = e.target.closest('.autocomplete-item');
                if (item) {
                    selectItem(item.dataset.value);
                }
            });
        });
    }

    function initializeModal() {
        console.log('Initializing modal');
        const modal = document.getElementById('band-modal');
        const closeModal = document.querySelector('.modal-close');
        const form = document.getElementById('band-form');
        const addLinkBtn = document.getElementById('add-link-btn');
        const linksContainer = document.getElementById('links-container');

        if (!modal || !closeModal || !form || !addLinkBtn || !linksContainer) {
            console.error('Modal elements not found:', { modal, closeModal, form, addLinkBtn, linksContainer });
            showNotification('Грешка: елементите на модалот не се пронајдени.', 'error');
            return;
        }

        document.getElementById('add-band-btn').addEventListener('click', () => {
            console.log('Add band button clicked');
            openModal('add');
        });

        closeModal.addEventListener('click', () => {
            console.log('Close modal clicked');
            modal.style.display = 'none';
            clearErrors();
            clearTags();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Clicked outside modal');
                modal.style.display = 'none';
                clearErrors();
                clearTags();
            }
        });

        addLinkBtn.addEventListener('click', () => {
            console.log('Add link button clicked');
            addLinkInput();
        });

        // Initialize autocomplete for multi-value fields
        initializeAutocomplete();

        ['band-city', 'band-genre', 'band-sounds-like', 'band-label'].forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', () => updateTags(id));
        });

        function showError(input, message) {
            const formGroup = input.closest('.form-group');
            let error = formGroup.querySelector('.error-message');
            if (!error) {
                error = document.createElement('div');
                error.className = 'error-message';
                error.style.color = '#d32f2f';
                error.style.fontSize = '0.8rem';
                error.style.marginTop = '0.2rem';
                formGroup.appendChild(error);
            }
            error.textContent = message;
        }

        function clearErrors() {
            document.querySelectorAll('.error-message').forEach(error => error.remove());
        }

        function clearTags() {
            ['band-city-tags', 'band-genre-tags', 'band-sounds-like-tags', 'band-label-tags'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
        }

        function updateTags(inputId) {
            const input = document.getElementById(inputId);
            const tagContainer = document.getElementById(`${inputId}-tags`);
            if (!tagContainer) return;
            const value = input.value.trim();
            tagContainer.innerHTML = '';
            if (value && value !== 'недостигаат податоци') {
                const items = value.split(',').map(item => item.trim()).filter(item => item);
                const tagClass = inputId === 'band-city' ? 'city-tag' :
                                 inputId === 'band-genre' ? 'genre-tag' : 
                                 inputId === 'band-label' ? 'label-tag' : 'sounds-like-tag';
                items.forEach(item => {
                    const tag = document.createElement('span');
                    tag.className = `tag-item ${tagClass}`;
                    tag.textContent = item;
                    tagContainer.appendChild(tag);
                });
            }
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted');
            clearErrors();

            const name = document.getElementById('band-name').value.trim();
            const contact = document.getElementById('band-contact').value.trim();
            let hasError = false;

            if (!validateName(name)) {
                showError(document.getElementById('band-name'), 'Името мора да има барем 2 карактери.');
                hasError = true;
            }

            const nameLatin = transliterateCyrillicToLatin(name).toLowerCase();
            const editIndex = form.dataset.editIndex;
            const isDuplicate = bandsData.some((band, index) => {
                const bandNameLatin = transliterateCyrillicToLatin(band.name).toLowerCase();
                return bandNameLatin === nameLatin && (editIndex === undefined || parseInt(editIndex) !== index);
            });
            if (isDuplicate) {
                showError(document.getElementById('band-name'), 'Бенд со ова име веќе постои.');
                hasError = true;
            }

            if (contact && !validateEmail(contact)) {
                showError(document.getElementById('band-contact'), 'Внесете валидна е-пошта или оставете празно.');
                hasError = true;
            }

            const linkValidation = validateLinks(linksContainer);
            if (!linkValidation.valid) {
                const formGroup = linksContainer.closest('.form-group');
                let error = formGroup.querySelector('.error-message');
                if (!error) {
                    error = document.createElement('div');
                    error.className = 'error-message';
                    error.style.color = '#d32f2f';
                    error.style.fontSize = '0.8rem';
                    error.style.marginTop = '0.2rem';
                    formGroup.appendChild(error);
                }
                error.textContent = linkValidation.message;
                hasError = true;
            }

            if (hasError) {
                console.log('Form validation failed');
                return;
            }

            const band = {
                name,
                city: document.getElementById('band-city').value.trim() || 'недостигаат податоци',
                genre: document.getElementById('band-genre').value.trim() || 'недостигаат податоци',
                soundsLike: document.getElementById('band-sounds-like').value.trim() || 'недостигаат податоци',
                isActive: document.getElementById('band-status').value,
                label: document.getElementById('band-label').value.trim() || null,
                lastfmName: document.getElementById('band-lastfm').value.trim() || null,
                contact: contact || 'недостигаат податоци',
                links: {}
            };
            const linkSelects = linksContainer.querySelectorAll('select');
            const linkInputs = linksContainer.querySelectorAll('input[type="url"]');
            for (let i = 0; i < linkSelects.length; i++) {
                const platform = linkSelects[i].value;
                const url = linkInputs[i].value.trim();
                if (url && platform !== 'none') {
                    band.links[platform] = url;
                }
            }
            if (Object.keys(band.links).length === 0) {
                band.links = { none: 'недостигаат податоци' };
            }
            if (editIndex !== undefined && editIndex !== '') {
                console.log(`Updating band at index ${editIndex}`);
                bandsData[parseInt(editIndex)] = band;
            } else {
                console.log('Adding new band');
                bandsData.push(band);
            }
            bandsData.sort((a, b) => {
                const nameA = transliterateCyrillicToLatin(a.name);
                const nameB = transliterateCyrillicToLatin(b.name);
                return nameA.localeCompare(nameB, 'en');
            });
            document.getElementById('total-bands').textContent = bandsData.length;
            populateFilters(bandsData);
            filterBands();
            renderNewReleaseArtists(bandsData);
            modal.style.display = 'none';
            form.reset();
            linksContainer.innerHTML = '';
            clearTags();
            clearErrors();
            hasUnsavedChanges = true;
            updateSubmitButtonState();
            console.log('Form submission successful');
        });

        function addLinkInput(platform = 'none', url = '') {
            console.log('Adding link input:', { platform, url });
            const linkGroup = document.createElement('div');
            linkGroup.className = 'link-group';
            
            // Create wrapper for select with icon
            const selectWrapper = document.createElement('div');
            selectWrapper.className = 'platform-select-wrapper';
            
            // Create icon element
            const iconEl = document.createElement('i');
            const currentPlatform = socialPlatforms.find(p => p.id === platform);
            iconEl.className = (currentPlatform?.icon || 'fa-solid fa-link') + ' platform-icon';
            
            const select = document.createElement('select');
            select.innerHTML = '<option value="none">Избери платформа</option>' +
                socialPlatforms.map(p => `<option value="${p.id}" ${p.id === platform ? 'selected' : ''}>${p.name}</option>`).join('');
            
            // Update icon when platform changes
            select.addEventListener('change', () => {
                const selectedPlatform = socialPlatforms.find(p => p.id === select.value);
                iconEl.className = (selectedPlatform?.icon || 'fa-solid fa-link') + ' platform-icon';
            });
            
            selectWrapper.appendChild(iconEl);
            selectWrapper.appendChild(select);
            
            const input = document.createElement('input');
            input.type = 'url';
            input.placeholder = 'Внеси URL';
            input.value = url;
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
            removeBtn.addEventListener('click', () => {
                console.log('Remove link input clicked');
                linkGroup.remove();
            });
            linkGroup.appendChild(selectWrapper);
            linkGroup.appendChild(input);
            linkGroup.appendChild(removeBtn);
            linksContainer.appendChild(linkGroup);
        }

        function openModal(mode, band = null, index = null) {
            console.log(`Opening modal in ${mode} mode`, { band, index });
            const title = document.getElementById('modal-title');
            linksContainer.innerHTML = '';
            form.reset();
            clearErrors();
            clearTags();
            if (mode === 'add') {
                title.textContent = 'Додај артист';
                delete form.dataset.editIndex;
                addLinkInput();
            } else {
                title.textContent = 'Уреди артист';
                console.log('Pre-filling form with band data:', band);
                if (!band) {
                    console.error('No band data provided for edit mode');
                    showNotification('Грешка: нема податоци за артистот за уредување.', 'error');
                    return;
                }
                document.getElementById('band-name').value = band.name !== 'недостигаат податоци' ? band.name : '';
                document.getElementById('band-city').value = band.city !== 'недостигаат податоци' ? band.city : '';
                document.getElementById('band-genre').value = band.genre !== 'недостигаат податоци' ? band.genre : '';
                document.getElementById('band-sounds-like').value = band.soundsLike !== 'недостигаат податоци' ? band.soundsLike : '';
                document.getElementById('band-status').value = band.isActive || 'Непознато';
                document.getElementById('band-label').value = band.label !== 'недостигаат податоци' ? band.label : '';
                document.getElementById('band-lastfm').value = band.lastfmName || '';
                document.getElementById('band-contact').value = band.contact !== 'недостигаат податоци' ? band.contact : '';
                if (band.links && band.links.none !== 'недостигаат податоци') {
                    Object.entries(band.links).forEach(([platform, url]) => {
                        addLinkInput(platform, url);
                    });
                } else {
                    addLinkInput();
                }
                form.dataset.editIndex = index;
                ['band-city', 'band-genre', 'band-sounds-like', 'band-label'].forEach(id => updateTags(id));
            }
            modal.style.display = 'block';
            console.log('Modal opened successfully');
        }

        async function deleteBand(index) {
            console.log(`Delete band requested for index ${index}`);
            const confirmed = await showCustomDialog(
                'Потврда за бришење',
                'Дали сте сигурни дека сакате да го избришете овој бенд?'
            );
            if (confirmed) {
                console.log(`Deleting band at index ${index}`);
                bandsData.splice(index, 1);
                document.getElementById('total-bands').textContent = bandsData.length;
                populateFilters(bandsData);
                filterBands();
                renderNewReleaseArtists(bandsData);
                hasUnsavedChanges = true;
                updateSubmitButtonState();
            }
        }

        window.openModal = openModal;
        window.deleteBand = deleteBand;

        console.log('Modal initialization complete, window.openModal defined:', typeof window.openModal);
    }

    function initializeCopyData() {
        console.log('Initializing copy data');
        const copyButton = document.getElementById('copy-data-btn');
        if (!copyButton) {
            console.error('Copy data button not found in DOM');
            showNotification('Грешка: копчето за копирање податоци не е пронајдено.', 'error');
            return;
        }
        copyButton.addEventListener('click', () => {
            console.log('Copy data button clicked');
            try {
                const exportData = {
                    muzickaMasterLista: bandsData.map(band => ({
                        name: band.name,
                        city: band.city,
                        genre: band.genre,
                        soundsLike: band.soundsLike,
                        isActive: band.isActive === 'Активен' ? true : band.isActive === 'Неактивен' ? false : band.isActive,
                        links: band.links,
                        contact: band.contact,
                        lastfmName: band.lastfmName,
                        label: band.label
                    }))
                };
                const json = JSON.stringify(exportData, null, 2);
                navigator.clipboard.writeText(json).then(() => {
                    console.log('Data copied to clipboard successfully');
                    showNotification('Податоците се копирани во клипборд.', 'success');
                }).catch(err => {
                    console.error('Error copying data to clipboard:', err);
                    showNotification('Грешка при копирање на податоците во клипборд. Проверете ја конзолата за детали.', 'error');
                });
            } catch (error) {
                console.error('Error preparing data for copy:', error);
                showNotification('Грешка при подготовка на податоците за копирање. Проверете ја конзолата за детали.', 'error');
            }
        });
    }

    function initializeSubmitPR() {
        // Minimal init (debug logs removed for production cleanliness)
        const submitBtn = document.getElementById('submit-pr-btn');
        if (!submitBtn) {
            return;
        }

        const resolveEndpoint = () => {
            if (typeof window.MMM_PR_ENDPOINT === 'string' && window.MMM_PR_ENDPOINT.trim()) return window.MMM_PR_ENDPOINT.trim();
            const attr = submitBtn.getAttribute('data-endpoint');
            if (attr && attr.trim()) return attr.trim();
            const stored = localStorage.getItem('mmm_pr_endpoint');
            if (stored && stored.trim()) return stored.trim();
            return '';
        };

        // Inject status container after button (now used for notifications instead)
        let statusEl = document.getElementById('pr-submit-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'pr-submit-status';
            statusEl.style.display = 'none'; // Hide the old status element
            submitBtn.insertAdjacentElement('afterend', statusEl);
        }

        submitBtn.addEventListener('click', async () => {
            try {
                    // Edit mode no longer required; allow submission anytime
                if (!hasUnsavedChanges) {
                    showNotification('Нема промени за поднесување.', 'info');
                    return;
                }

                let endpoint = resolveEndpoint();
                if (!endpoint) {
                    endpoint = await showCustomDialog(
                        'Worker Endpoint',
                        'Внесете URL на worker endpoint за PR (ќе се зачува локално):',
                        'https://example.com/worker'
                    );
                    if (!endpoint) return;
                    localStorage.setItem('mmm_pr_endpoint', endpoint);
                }

                // Compute and prefill summary of changes
                const diff = computeChangesSummary(originalBandsData, bandsData);
                const diffText = summarizeChangesText(diff) || 'Без промени';

                const prFormPromise = showCustomDialog(
                    'Поднесување на промени',
                    'Пополнете ги информациите за поднесување на вашите промени:',
                    '',
                    '',
                    true
                );
                // Prefill the PR description with a summary of changes
                setTimeout(() => {
                    const desc = document.getElementById('pr-description');
                    if (desc) {
                        const header = 'Предлог промени од MMM формуларот\n\n';
                        desc.value = `${header}${diffText}\n`;
                    }
                }, 0);

                const formData = await prFormPromise;
                if (!formData) return; // User canceled

                const exportData = {
                    muzickaMasterLista: bandsData.map(band => ({
                        name: band.name,
                        city: band.city,
                        genre: band.genre,
                        soundsLike: band.soundsLike,
                        isActive: band.isActive === 'Активен' ? true : band.isActive === 'Неактивен' ? false : band.isActive,
                        links: band.links,
                        contact: band.contact,
                        lastfmName: band.lastfmName,
                        label: band.label
                    }))
                };

                const json = JSON.stringify(exportData, null, 2);

                submitBtn.disabled = true;
                const originalHtml = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Испраќање...';
                showNotification('Испраќање...', 'info');

                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bandsJson: json,
                        contributor: formData.contributor,
                        description: formData.description,
                        path: 'masterlista/bands.json'
                    })
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`Worker error (${resp.status}): ${text}`);
                }

                const result = await resp.json();
                const prUrl = result.pr_url || result.html_url || '';
                if (prUrl) {
                    showNotification('Успешно поднесено! Отворен е PR.', 'success');
                    window.open(prUrl, '_blank');
                } else {
                    showNotification('Успешно поднесено!', 'success');
                }

            } catch (err) {
                console.error('Submit PR failed:', err);
                showNotification('Грешка при поднесување: ' + (err?.message || err), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Побарај промена';
                // Reset change tracking after successful submission
                try {
                    originalBandsData = JSON.parse(JSON.stringify(bandsData));
                    hasUnsavedChanges = false;
                    updateSubmitButtonState();
                } catch (_) {}
            }
        });
    }

    function initializeMasterEdit() {
        console.log('Initializing master edit button');
        const masterEditBtn = document.getElementById('master-edit-btn');
        if (!masterEditBtn) {
            console.error('Master edit button not found in DOM');
            showNotification('Грешка: копчето за уредување не е пронајдено.', 'error');
            return;
        }
        masterEditBtn.addEventListener('click', () => {
            console.log('Master edit button clicked');
            isEditMode = !isEditMode;
            document.body.classList.toggle('edit-mode', isEditMode);
            masterEditBtn.innerHTML = isEditMode ?
                '<i class="fas fa-times"></i> Исклучи уредување' :
                '<i class="fas fa-edit"></i> Уреди';
            console.log('Edit mode:', isEditMode);
            renderBands(bandsData);
            renderNewReleaseArtists(bandsData);
        });
    }

    function populateFilters(data) {
        console.log('Populating filters');
        const citySelect = document.getElementById('filter-city');
        const genreSelect = document.getElementById('filter-genre');
        const soundsLikeSelect = document.getElementById('filter-sounds-like');
        const statusSelect = document.getElementById('filter-status');
        const labelSelect = document.getElementById('filter-label');
        if (citySelect.innerHTML === '') {
            const cityCounts = {};
            data.forEach(band => {
                if (band.city !== 'недостигаат податоци') {
                    band.city.split(',').map(c => c.trim()).forEach(city => {
                        cityCounts[city] = (cityCounts[city] || 0) + 1;
                    });
                }
            });
            const cities = [...new Set(
                data
                    .flatMap(band => band.city.split(',').map(c => c.trim()))
                    .filter(c => c !== 'недостигаат податоци')
                    .sort((a, b) => transliterateCyrillicToLatin(a).localeCompare(transliterateCyrillicToLatin(b), 'en'))
            )];
            citySelect.innerHTML = '<option value=""></option>' +
                cities.map(city => `<option value="${city}">${city} (${cityCounts[city] || 0})</option>`).join('');
        }
        if (genreSelect.innerHTML === '') {
            const genreCounts = {};
            data.forEach(band => {
                if (band.genre !== 'недостигаат податоци') {
                    band.genre.split(',').map(g => g.trim()).forEach(genre => {
                        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                    });
                }
            });
            const genres = [...new Set(
                data
                    .flatMap(band => band.genre.split(',').map(g => g.trim()))
                    .filter(g => g !== 'недостигаат податоци')
                    .sort((a, b) => transliterateCyrillicToLatin(a).localeCompare(transliterateCyrillicToLatin(b), 'en'))
            )];
            genreSelect.innerHTML = '<option value=""></option>' +
                genres.map(genre => `<option value="${genre}">${genre} (${genreCounts[genre] || 0})</option>`).join('');
        }
        if (soundsLikeSelect.innerHTML === '') {
            const soundsLikeCounts = {};
            data.forEach(band => {
                if (band.soundsLike !== 'недостигаат податоци') {
                    band.soundsLike.split(',').map(s => s.trim()).forEach(sound => {
                        soundsLikeCounts[sound] = (soundsLikeCounts[sound] || 0) + 1;
                    });
                }
            });
            const soundsLike = [...new Set(
                data
                    .flatMap(band => band.soundsLike.split(',').map(s => s.trim()))
                    .filter(s => s !== 'недостигаат податоци')
                    .sort((a, b) => transliterateCyrillicToLatin(a).localeCompare(transliterateCyrillicToLatin(b), 'en'))
            )];
            soundsLikeSelect.innerHTML = '<option value=""></option>' +
                soundsLike.map(sound => `<option value="${sound}">${sound} (${soundsLikeCounts[sound] || 0})</option>`).join('');
        }
        if (statusSelect.innerHTML === '') {
            const statusCounts = {};
            data.forEach(band => {
                const status = band.isActive;
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            const statuses = [...new Set(
                data
                    .map(band => band.isActive)
                    .filter(s => s !== undefined)
                    .sort((a, b) => transliterateCyrillicToLatin(a).localeCompare(transliterateCyrillicToLatin(b), 'en'))
            )];
            statusSelect.innerHTML = '<option value=""></option>' +
                statuses.map(status => `<option value="${status}">${status} (${statusCounts[status] || 0})</option>`).join('');
        }
        if (labelSelect.innerHTML === '') {
            const labelCounts = {};
            data.forEach(band => {
                if (band.label && band.label !== 'недостигаат податоци' && band.label !== null) {
                    String(band.label)
                        .split(',')
                        .map(l => l.trim())
                        .filter(Boolean)
                        .forEach(l => {
                            labelCounts[l] = (labelCounts[l] || 0) + 1;
                        });
                }
            });
            const labels = [...new Set(
                data
                    .flatMap(band => (band.label && band.label !== 'недостигаат податоци' && band.label !== null)
                        ? String(band.label).split(',').map(l => l.trim()).filter(Boolean)
                        : [])
                    .sort((a, b) => transliterateCyrillicToLatin(a).localeCompare(transliterateCyrillicToLatin(b), 'en'))
            )];
            labelSelect.innerHTML = '<option value=""></option>' +
                labels.map(label => `<option value="${label}">${label} (${labelCounts[label] || 0})</option>`).join('');
        }
    }

    function filterBands() {
        console.log('Filtering bands');
        const searchName = document.getElementById('search-name').value.toLowerCase();
        const filterCity = $('#filter-city').val() || '';
        const filterGenre = $('#filter-genre').val() || '';
        const filterSoundsLike = $('#filter-sounds-like').val() || '';
        const filterStatus = $('#filter-status').val() || '';
        const filterLabel = $('#filter-label').val() || '';
        const searchNameLatinFull = transliterateCyrillicToLatin(searchName).toLowerCase();
        const searchNameLatinShorthand = transliterateCyrillicToLatinShorthand(searchName).toLowerCase();
        const filteredBands = bandsData.filter(band => {
            const bandNameLatinFull = transliterateCyrillicToLatin(band.name).toLowerCase();
            const bandNameLatinShorthand = transliterateCyrillicToLatinShorthand(band.name).toLowerCase();
            const matchesName = (
                band.name.toLowerCase().includes(searchName) ||
                bandNameLatinFull.includes(searchNameLatinFull) ||
                bandNameLatinShorthand.includes(searchNameLatinShorthand) ||
                bandNameLatinFull.includes(searchNameLatinShorthand) ||
                bandNameLatinShorthand.includes(searchNameLatinFull)
            );
            const matchesCity = !filterCity ||
                band.city.split(',').map(c => c.trim()).includes(filterCity);
            const matchesGenre = !filterGenre ||
                band.genre.split(',').map(g => g.trim()).includes(filterGenre);
            const matchesSoundsLike = !filterSoundsLike ||
                band.soundsLike.split(',').map(s => s.trim()).includes(filterSoundsLike);
            const matchesStatus = !filterStatus || band.isActive === filterStatus;
            const matchesLabel = !filterLabel || (
                band.label && band.label !== 'недостигаат податоци' &&
                String(band.label).split(',').map(l => l.trim()).includes(filterLabel)
            );
            return matchesName && matchesCity && matchesGenre && matchesSoundsLike && matchesStatus && matchesLabel;
        });
        renderBands(filteredBands);
        renderNewReleaseArtists(bandsData);
    }

    function renderBands(bands) {
        console.log(`Rendering ${bands.length} bands`);
        const bandTableBody = document.getElementById('band-table-body');
        bandTableBody.innerHTML = '';
        bands.forEach((band, displayIndex) => {
            const originalIndex = bandsData.findIndex(b => b.name === band.name && b.city === band.city && b.genre === band.genre);
            const bandRow = document.createElement('tr');
            const linkPopularityOrder = [
                'youtube', 'spotify', 'itunes', 'deezer', 'instagram',
                'facebook', 'twitter', 'soundcloud', 'bandcamp', 'website', 'linktree',
                'tiktok', 'linkedin', 'pinterest', 'twitch', 'vimeo', 'patreon', 'discord', 'generic'
            ];
            const linkIcons = {
                facebook: 'fa-brands fa-facebook',
                instagram: 'fa-brands fa-instagram',
                twitter: 'fa-brands fa-twitter',
                youtube: 'fa-brands fa-youtube',
                spotify: 'fa-brands fa-spotify',
                bandcamp: 'fa-brands fa-bandcamp',
                soundcloud: 'fa-brands fa-soundcloud',
                itunes: 'fa-brands fa-itunes-note',
                deezer: 'fa-brands fa-deezer',
                lastfm: 'fa-brands fa-lastfm',
                wikipedia: 'fa-brands fa-wikipedia-w',
                tiktok: 'fa-brands fa-tiktok',
                linkedin: 'fa-brands fa-linkedin',
                pinterest: 'fa-brands fa-pinterest',
                twitch: 'fa-brands fa-twitch',
                vimeo: 'fa-brands fa-vimeo',
                patreon: 'fa-brands fa-patreon',
                discord: 'fa-brands fa-discord',
                website: 'fa-solid fa-globe',
                linktree: 'fa-solid fa-tree',
                generic: 'fa-solid fa-link'
            };
            let linksHtml = '';
            let playBtnHtml = '';
            const hasSpotifyLink = band.links?.spotify && band.links.spotify !== 'недостигаат податоци';
            if (band.links.none === 'недостигаат податоци' && band.contact === 'недостигаат податоци') {
                linksHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const sortedPlatforms = Object.keys(band.links).sort((a, b) => {
                    const indexA = linkPopularityOrder.indexOf(a);
                    const indexB = linkPopularityOrder.indexOf(b);
                    return indexA - indexB;
                });
                linksHtml = sortedPlatforms
                    .map(platform => {
                        let url = band.links[platform];
                        if (platform === 'spotify') {
                            url = convertSpotifyUrlToAppUri(url);
                        }
                        const iconClass = linkIcons[platform] || 'fa-solid fa-link';
                        return `<a href="${url}" target="_blank"><i class="${iconClass}"></i></a>`;
                    })
                    .join('');
                if (band.contact !== 'недостигаат податоци') {
                    linksHtml += `<a href="mailto:${band.contact}" class="contact-link"><i class="fa-solid fa-envelope"></i></a>`;
                }
            }
            // Play button in separate column
            if (hasSpotifyLink) {
                playBtnHtml = `<button class="artist-preview-btn" data-spotify-url="${band.links.spotify}" title="Преслушај"><i class="fas fa-play"></i></button>`;
            } else {
                playBtnHtml = `<button class="artist-preview-btn" disabled title="Нема преслушување"><i class="fas fa-play"></i></button>`;
            }
            let cityHtml = band.city === 'недостигаат податоци'
                ? '<span class="missing-data"><i class="fas fa-question-circle"></i></span>'
                : band.city.split(',').map(c => c.trim()).map(c => `<span class="city-item" data-filter="city" data-value="${c}" style="background: ${generateCityColor(c)}">${c}</span>`).join('');
            let genreHtml = band.genre === 'недостигаат податоци'
                ? '<span class="missing-data"><i class="fas fa-question-circle"></i></span>'
                : band.genre.split(',').map(g => g.trim()).map(g => `<span class="genre-item" data-filter="genre" data-value="${g}">${g}</span>`).join('');
            let soundsLikeHtml = band.soundsLike === 'недостигаат податоци'
                ? '<span class="missing-data"><i class="fas fa-question-circle"></i></span>'
                : band.soundsLike.split(',').map(s => s.trim()).map(s => `<span class="sounds-like-item" data-filter="sounds-like" data-value="${s}">${s}</span>`).join('');
            let nameHtml = band.name;
            if (band.label && band.label !== 'недостигаат податоци') {
                const labels = String(band.label).split(',').map(l => l.trim()).filter(Boolean);
                const labelSpans = labels.map(l => {
                    const isSingleChar = l.length === 1;
                    return `<span class="band-label ${isSingleChar ? 'single-char' : ''}" data-filter="label" data-value="${l}">${l}</span>`;
                }).join(' ');
                nameHtml += ` ${labelSpans}`;
            }
            const statusClass = band.isActive === 'Непознато' ? 'missing-data' : '';
            bandRow.innerHTML = `
                <td data-label="Име" class="name">${nameHtml}</td>
                <td data-label="Град">${cityHtml}</td>
                <td data-label="Жанр">${genreHtml}</td>
                <td data-label="Звучи како">${soundsLikeHtml}</td>
                <td data-label="Линкови" class="links">${linksHtml}</td>
                <td data-label="Преслушај" class="play-column">${playBtnHtml}</td>
                <td data-label="Статус" data-status="${band.isActive}" class="${statusClass}">
                    <span class="status-content" data-status-text="${band.isActive}">${band.isActive}</span>
                </td>
                <td data-label="Акции" class="action-buttons edit-hidden">
                    <button class="action-btn edit-btn" data-index="${originalIndex}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" onclick="window.deleteBand(${originalIndex})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            const statusSpan = bandRow.querySelector('.status-content');
            statusSpan.addEventListener('mouseover', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'status-tooltip';
                tooltip.textContent = band.isActive;
                document.body.appendChild(tooltip);
                const offsetX = 10;
                const offsetY = 10;
                tooltip.style.left = `${e.pageX + offsetX}px`;
                tooltip.style.top = `${e.pageY + offsetY}px`;
                statusSpan._tooltip = tooltip;
            });
            statusSpan.addEventListener('mousemove', (e) => {
                const tooltip = statusSpan._tooltip;
                if (tooltip) {
                    const offsetX = 10;
                    const offsetY = 10;
                    tooltip.style.left = `${e.pageX + offsetX}px`;
                    tooltip.style.top = `${e.pageY + offsetY}px`;
                }
            });
            statusSpan.addEventListener('mouseout', () => {
                const tooltip = statusSpan._tooltip;
                if (tooltip) {
                    tooltip.remove();
                    statusSpan._tooltip = null;
                }
            });
            bandRow.querySelectorAll('.city-item, .genre-item, .sounds-like-item, .band-label').forEach(item => {
                item.addEventListener('click', () => {
                    console.log('Filter item clicked:', item.getAttribute('data-filter'), item.getAttribute('data-value'));
                    const filterType = item.getAttribute('data-filter');
                    const filterValue = item.getAttribute('data-value');
                    if (filterType === 'city') {
                        $('#filter-city').val(filterValue).trigger('change');
                    } else if (filterType === 'genre') {
                        $('#filter-genre').val(filterValue).trigger('change');
                    } else if (filterType === 'sounds-like') {
                        $('#filter-sounds-like').val(filterValue).trigger('change');
                    } else if (filterType === 'label') {
                        $('#filter-label').val(filterValue).trigger('change');
                    }
                    document.querySelector('.controls').style.display = 'flex';
                });
            });
            const editBtn = bandRow.querySelector('.edit-btn');
            editBtn.addEventListener('click', () => {
                const idx = parseInt(editBtn.dataset.index);
                console.log(`Edit button clicked for band at original index ${idx}`);
                if (typeof window.openModal === 'function') {
                    window.openModal('edit', bandsData[idx], idx);
                } else {
                    console.error('window.openModal is not defined');
                    showNotification('Грешка: функцијата за уредување не е достапна.', 'error');
                }
            });
            
            // Add event listener for Spotify preview button
            const previewBtn = bandRow.querySelector('.artist-preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleArtistPreviewClick(previewBtn);
                });
            }
            
            bandTableBody.appendChild(bandRow);
        });
    }
    
    // Handle artist preview button clicks - shows Spotify embed player
    async function handleArtistPreviewClick(btn) {
        const spotifyUrl = btn.dataset.spotifyUrl;
        
        if (!spotifyUrl) return;
        
        // Parse the URL to get type and ID
        // Format: https://open.spotify.com/artist/XXXX
        const match = spotifyUrl.match(/spotify\.com\/(artist|album|track)\/([a-zA-Z0-9]+)/);
        if (match) {
            const spotifyType = match[1];
            const spotifyId = match[2];
            showSpotifyEmbed(spotifyId, spotifyType);
        } else {
            // Fallback: open in new tab
            window.open(spotifyUrl, '_blank');
        }
    }

    loadBandsData();
});