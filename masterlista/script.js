document.addEventListener('DOMContentLoaded', () => {
    let bandsData = [];
    const lastfmApiKey = 'd186251f2ae019335f832db01d96c2f9'; // Last.fm API key
    const defaultFallbackImage = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg'; // Last.fm default star image

    // Transliteration mapping for Macedonian Cyrillic to Latin (full form)
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

    // Transliteration mapping for Macedonian Cyrillic to Latin (shorthand form)
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

    // Function to transliterate Cyrillic to Latin (full form)
    function transliterateCyrillicToLatin(text) {
        return text.split('')
            .map(char => cyrillicToLatinMap[char] || char)
            .join('');
    }

    // Function to transliterate Cyrillic to Latin (shorthand form)
    function transliterateCyrillicToLatinShorthand(text) {
        return text.split('')
            .map(char => cyrillicToLatinShorthandMap[char] || char)
            .join('');
    }

    // Function to convert a Spotify web URL to an app URI
    function convertSpotifyUrlToAppUri(webUrl) {
        const match = webUrl.match(/open\.spotify\.com\/artist\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return `spotify:artist:${match[1]}`;
        }
        return webUrl;
    }

    // Function to fetch the latest album image from Last.fm
    async function getLastfmArtistImage(lastfmName, fallbackName) {
        const artistName = lastfmName || fallbackName;
        if (!artistName) {
            console.warn(`No artist name provided (neither lastfmName nor name)`);
            return null;
        }
        try {
            console.debug(`Fetching latest album image for artist: ${artistName}`);
            const albumsResponse = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artistName)}&api_key=${lastfmApiKey}&format=json`
            );
            const albumsData = await albumsResponse.json();

            if (albumsData.error) {
                console.warn(`No albums found for artist ${artistName} (Error: ${albumsData.message})`);
                return null;
            }

            if (
                albumsData.topalbums &&
                albumsData.topalbums.album &&
                albumsData.topalbums.album.length > 0
            ) {
                const topAlbum = albumsData.topalbums.album[0];
                if (topAlbum.image && topAlbum.image.length > 0) {
                    const sizeDimensions = {
                        small: 34,
                        medium: 64,
                        large: 174,
                        extralarge: 300,
                        mega: 300
                    };
                    const targetSize = 120;

                    let closestImage = null;
                    let minDifference = Infinity;

                    topAlbum.image.forEach(image => {
                        const size = image.size;
                        const dimension = sizeDimensions[size] || 300;
                        const difference = Math.abs(dimension - targetSize);
                        const isValidImage = image['#text'] && image['#text'].trim() !== '';
                        if (difference < minDifference && isValidImage) {
                            minDifference = difference;
                            closestImage = image['#text'];
                        }
                    });

                    if (closestImage) {
                        console.debug(`Found album image for "${topAlbum.name}" of artist ${artistName}: ${closestImage}`);
                        return closestImage;
                    } else {
                        console.warn(`No valid image found for top album "${topAlbum.name}" of artist ${artistName} (empty URLs)`);
                        return null;
                    }
                } else {
                    console.warn(`No images found for top album "${topAlbum.name}" of artist ${artistName}`);
                    return null;
                }
            } else {
                console.warn(`No top albums found for artist ${artistName}`);
                return null;
            }
        } catch (error) {
            console.error(`Error fetching Last.fm album image for ${artistName}:`, error);
            return null;
        }
    }

    // Fetch bands data and Last.fm images
    async function loadBandsData() {
        try {
            const response = await fetch('bands.json');
            const data = await response.json();

            bandsData = await Promise.all(
                data.muzickaMasterLista.map(async (band) => {
                    let image = band.image;
                    if (band.lastfmName || band.name) {
                        const lastfmImage = await getLastfmArtistImage(band.lastfmName, band.name);
                        if (lastfmImage) {
                            image = lastfmImage;
                        } else {
                            console.warn(`No Last.fm image found for ${band.name}, using JSON image: ${image}`);
                        }
                    }
                    if (!image || image.trim() === '') {
                        image = defaultFallbackImage;
                    }
                    // Map isActive values
                    let status;
                    if (band.isActive === true) {
                        status = 'Активен';
                    } else if (band.isActive === false) {
                        status = 'Неактивен';
                    } else {
                        status = band.isActive || 'Непознато'; // Handle string values or missing
                    }
                    return {
                        name: band.name || 'недостигаат податоци',
                        city: band.city || 'недостигаат податоци',
                        genre: band.genre || 'недостигаат податоци',
                        soundsLike: band.soundsLike || 'недостигаат податоци',
                        isActive: status,
                        links: Object.keys(band.links).length ? band.links : { none: 'недостигаат податоци' },
                        contact: band.contact || 'недостигаат податоци',
                        image,
                        lastfmName: band.lastfmName || null
                    };
                })
            );

            bandsData.sort((a, b) => {
                const nameA = transliterateCyrillicToLatin(a.name);
                const nameB = transliterateCyrillicToLatin(b.name);
                return nameA.localeCompare(nameB, 'en');
            });

            // Update footer with total bands and last modified date
            document.getElementById('total-bands').textContent = bandsData.length;
            const lastModified = new Date('2025-04-20T14:30:00'); // Hardcoded date and time
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
            const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
            document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;

            populateFilters(bandsData);
            renderBands(bandsData);

            // Initialize Select2 for city, genre, sounds like, and status with blank default
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

            // Search and filter event listeners
            document.getElementById('search-name').addEventListener('input', filterBands);
            $('#filter-city').on('change', filterBands);
            $('#filter-genre').on('change', filterBands);
            $('#filter-sounds-like').on('change', filterBands);
            $('#filter-status').on('change', filterBands);

            // Clear filters button
            document.getElementById('clear-filters').addEventListener('click', () => {
                document.getElementById('search-name').value = '';
                $('#filter-city').val('').trigger('change');
                $('#filter-genre').val('').trigger('change');
                $('#filter-sounds-like').val('').trigger('change');
                $('#filter-status').val('').trigger('change');
                filterBands();
            });

            // Toggle filters button
            document.getElementById('toggle-filters').addEventListener('click', () => {
                const controls = document.querySelector('.controls');
                const isHidden = controls.style.display === 'none' || controls.style.display === '';
                controls.style.display = isHidden ? 'flex' : 'none';
                document.getElementById('toggle-filters').innerHTML = isHidden 
                    ? '<i class="fas fa-filter"></i> Сокриј филтри' 
                    : '<i class="fas fa-filter"></i> Филтри';
            });
        } catch (error) {
            console.error('Error loading bands:', error);
            document.getElementById('band-table-body').innerHTML = '<tr><td colspan="7">Извинете, нешто тргна наопаку.</td></tr>';
        }
    }

    // Call the async function to load data
    loadBandsData();

    // Populate city, genre, sounds like, and status dropdowns with counts
    function populateFilters(data) {
        const citySelect = document.getElementById('filter-city');
        const genreSelect = document.getElementById('filter-genre');
        const soundsLikeSelect = document.getElementById('filter-sounds-like');
        const statusSelect = document.getElementById('filter-status');

        // Only populate if dropdowns are empty (initial load Hekler, 1);
        if (citySelect.innerHTML === '') {
            // Count cities
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
                    .sort((a, b) => {
                        const cityA = transliterateCyrillicToLatin(a);
                        const cityB = transliterateCyrillicToLatin(b);
                        return cityA.localeCompare(cityB, 'en');
                    })
            )];
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = `${city} (${cityCounts[city] || 0})`;
                citySelect.appendChild(option);
            });
        }

        if (genreSelect.innerHTML === '') {
            // Count genres
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
                    .sort((a, b) => {
                        const genreA = transliterateCyrillicToLatin(a);
                        const genreB = transliterateCyrillicToLatin(b);
                        return genreA.localeCompare(genreB, 'en');
                    })
            )];
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = `${genre} (${genreCounts[genre] || 0})`;
                genreSelect.appendChild(option);
            });
        }

        if (soundsLikeSelect.innerHTML === '') {
            // Count sounds like
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
                    .sort((a, b) => {
                        const soundA = transliterateCyrillicToLatin(a);
                        const soundB = transliterateCyrillicToLatin(b);
                        return soundA.localeCompare(soundB, 'en');
                    })
            )];
            soundsLike.forEach(sound => {
                const option = document.createElement('option');
                option.value = sound;
                option.textContent = `${sound} (${soundsLikeCounts[sound] || 0})`;
                soundsLikeSelect.appendChild(option);
            });
        }

        if (statusSelect.innerHTML === '') {
            // Count statuses
            const statusCounts = {};
            data.forEach(band => {
                const status = band.isActive;
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            const statuses = [...new Set(
                data
                    .map(band => band.isActive)
                    .filter(s => s !== undefined)
                    .sort((a, b) => {
                        const statusA = transliterateCyrillicToLatin(a);
                        const statusB = transliterateCyrillicToLatin(b);
                        return statusA.localeCompare(statusB, 'en');
                    })
            )];
            statuses.forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = `${status} (${statusCounts[status] || 0})`;
                statusSelect.appendChild(option);
            });
        }
    }

    // Filter bands based on inputs
    function filterBands() {
        const searchName = document.getElementById('search-name').value.toLowerCase();
        const filterCity = $('#filter-city').val() || '';
        const filterGenre = $('#filter-genre').val() || '';
        const filterSoundsLike = $('#filter-sounds-like').val() || '';
        const filterStatus = $('#filter-status').val() || '';

        // Transliterated versions of the search input
        const searchNameLatinFull = transliterateCyrillicToLatin(searchName).toLowerCase();
        const searchNameLatinShorthand = transliterateCyrillicToLatinShorthand(searchName).toLowerCase();

        const filteredBands = bandsData.filter(band => {
            // Transliterated versions of the band name
            const bandNameLatinFull = transliterateCyrillicToLatin(band.name).toLowerCase();
            const bandNameLatinShorthand = transliterateCyrillicToLatinShorthand(band.name).toLowerCase();

            // Check if the search matches either the original name (for non-Cyrillic searches),
            // the full transliterated name, or the shorthand transliterated name
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

            return matchesName && matchesCity && matchesGenre && matchesSoundsLike && matchesStatus;
        });

        renderBands(filteredBands);
    }

    // Render bands to table
    function renderBands(bands) {
        const bandTableBody = document.getElementById('band-table-body');
        bandTableBody.innerHTML = '';

        bands.forEach(band => {
            const bandRow = document.createElement('tr');

            const linkPopularityOrder = [
                'youtube', 'spotify', 'itunes', 'deezer', 'instagram',
                'facebook', 'twitter', 'soundcloud', 'bandcamp', 'website', 'linktree'
            ];

            const linkIcons = {
                facebook: 'fa-brands fa-facebook',
                instagram: 'fa-brands fa-instagram',
                twitter: 'fa-brands fa-twitter',
                bandcamp: 'fa-brands fa-bandcamp',
                soundcloud: 'fa-brands fa-soundcloud',
                youtube: 'fa-brands fa-youtube',
                spotify: 'fa-brands fa-spotify',
                itunes: 'fa-brands fa-itunes-note',
                deezer: 'fa-brands fa-deezer',
                website: 'fa-solid fa-globe',
                linktree: 'fa-solid fa-tree'
            };

            let linksHtml = '';
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

                // Add contact email as a link if available
                if (band.contact !== 'недостигаат податоци') {
                    linksHtml += `<a href="mailto:${band.contact}" class="contact-link">${band.contact}</a>`;
                }
            }

            // Handle genres
            let genreHtml = '';
            if (band.genre === 'недостигаат податоци') {
                genreHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const genres = band.genre.split(',').map(g => g.trim());
                genreHtml = genres.map(g => `<span class="genre-item">${g}</span>`).join('');
            }

            // Handle sounds like
            let soundsLikeHtml = '';
            if (band.soundsLike === 'недостигаат податоци') {
                soundsLikeHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const soundsLike = band.soundsLike.split(',').map(s => s.trim());
                soundsLikeHtml = soundsLike.map(s => `<span class="sounds-like-item">${s}</span>`).join('');
            }

            const statusClass = band.isActive === 'Непознато' ? 'missing-data' : '';

            bandRow.innerHTML = `
                <td data-label="Слика" class="band-image"><img src="${band.image}" alt="${band.name}"></td>
                <td data-label="Име" class="name">${band.name}</td>
                <td data-label="Град">${band.city}</td>
                <td data-label="Жанр">${genreHtml}</td>
                <td data-label="Звучи като">${soundsLikeHtml}</td>
                <td data-label="Линкови" class="links">${linksHtml}</td>
                <td data-label="Статус" data-status="${band.isActive}" class="${statusClass}">
                    <span class="status-content" data-status-text="${band.isActive}">${band.isActive}</span>
                </td>
            `;

            // Add tooltip functionality to the status circle
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

            bandTableBody.appendChild(bandRow);
        });
    }
});