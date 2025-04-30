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

    // Function to generate a color based on the ASCII sum of a string
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
                data.muzickaMasterLista.map(async (band, index) => {
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
                    let status;
                    if (band.isActive === true) {
                        status = 'Активен';
                    } else if (band.isActive === false) {
                        status = 'Неактивен';
                    } else {
                        status = band.isActive || 'Непознато';
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
                        lastfmName: band.lastfmName || null,
                        label: band.label || null,
                        index // Store index for editing
                    };
                })
            );

            bandsData.sort((a, b) => {
                const nameA = transliterateCyrillicToLatin(a.name);
                const nameB = transliterateCyrillicToLatin(b.name);
                return nameA.localeCompare(nameB, 'en');
            });

            document.getElementById('total-bands').textContent = bandsData.length;
            const lastModified = new Date('2025-04-20T14:30:00');
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
            const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
            document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;

            populateFilters(bandsData);
            renderBands(bandsData);

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
                document.getElementById('search-name').value = '';
                $('#filter-city').val('').trigger('change');
                $('#filter-genre').val('').trigger('change');
                $('#filter-sounds-like').val('').trigger('change');
                $('#filter-status').val('').trigger('change');
                $('#filter-label').val('').trigger('change');
                filterBands();
            });

            document.getElementById('toggle-filters').addEventListener('click', () => {
                const controls = document.querySelector('.controls');
                controls.classList.toggle('active');
                const isActive = controls.classList.contains('active');
                document.getElementById('toggle-filters').innerHTML = `<i class="fas ${isActive ? 'fa-times' : 'fa-filter'}"></i>`;
            });

            document.getElementById('mode-toggle-checkbox').addEventListener('change', (e) => {
                document.body.classList.toggle('compact', !e.target.checked);
                document.body.classList.toggle('expanded', e.target.checked);
                renderBands(bandsData);
            });

            // Modal handling
            const modal = document.getElementById('edit-modal');
            const closeModal = document.getElementById('close-modal');
            const editForm = document.getElementById('edit-form');
            const modalTitle = document.getElementById('modal-title');

            function openEditModal(band) {
                modalTitle.textContent = 'Уреди Бенд';
                editForm.dataset.type = 'edit';
                editForm.dataset.bandId = band.index;
                editForm.name.value = band.name;
                editForm.city.value = band.city === 'недостигаат податоци' ? '' : band.city;
                editForm.genre.value = band.genre === 'недостигаат податоци' ? '' : band.genre;
                editForm.soundsLike.value = band.soundsLike === 'недостигаат податоци' ? '' : band.soundsLike;
                editForm.isActive.value = band.isActive;
                editForm.links.value = JSON.stringify(band.links, null, 2);
                editForm.contact.value = band.contact === 'недостигаат податоци' ? '' : band.contact;
                editForm.image.value = band.image === defaultFallbackImage ? '' : band.image;
                editForm.lastfmName.value = band.lastfmName || '';
                editForm.label.value = band.label || '';
                modal.style.display = 'flex';
                hcaptcha.reset(); // Reset CAPTCHA
            }

            function openAddModal() {
                modalTitle.textContent = 'Додај Нов Бенд';
                editForm.dataset.type = 'add';
                editForm.dataset.bandId = '';
                editForm.reset();
                editForm.links.value = '{}';
                modal.style.display = 'flex';
                hcaptcha.reset(); // Reset CAPTCHA
            }

            closeModal.addEventListener('click', () => {
                modal.style.display = 'none';
            });

            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const captchaToken = hcaptcha.getResponse();
                if (!captchaToken) {
                    alert('Ве молиме потврдете дека не сте робот.');
                    return;
                }
                const type = editForm.dataset.type;
                const bandId = editForm.dataset.bandId;
                let links;
                try {
                    links = JSON.parse(editForm.links.value || '{}');
                } catch {
                    alert('Линковите мора да бидат во валиден JSON формат.');
                    return;
                }
                const data = {
                    name: editForm.name.value,
                    city: editForm.city.value || 'недостигаат податоци',
                    genre: editForm.genre.value || 'недостигаат податоци',
                    soundsLike: editForm.soundsLike.value || 'недостигаат податоци',
                    isActive: editForm.isActive.value,
                    links: Object.keys(links).length ? links : { none: 'недостигаат податоци' },
                    contact: editForm.contact.value || 'недостигаат податоци',
                    image: editForm.image.value || defaultFallbackImage,
                    lastfmName: editForm.lastfmName.value || null,
                    label: editForm.label.value || null
                };

                try {
                    const response = await fetch('/.netlify/functions/submit-edit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data, type, bandId, captchaToken })
                    });
                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || 'Поднесувањето не успеа.');
                    }
                    alert(result.message);
                    modal.style.display = 'none';
                    editForm.reset();
                } catch (error) {
                    alert('Грешка: ' + error.message);
                }
            });

            document.getElementById('add-band-btn').addEventListener('click', (e) => {
                e.preventDefault();
                openAddModal();
            });
        } catch (error) {
            console.error('Error loading bands:', error);
            document.getElementById('band-table-body').innerHTML = '<tr><td colspan="7">Извинете, нешто тргна наопаку.</td></tr>';
        }
    }

    // Populate city, genre, sounds like, status, and label dropdowns with counts
    function populateFilters(data) {
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

        if (labelSelect.innerHTML === '') {
            const labelCounts = {};
            data.forEach(band => {
                if (band.label && band.label !== 'недостигаат податоци' && band.label !== null) {
                    labelCounts[band.label] = (labelCounts[band.label] || 0) + 1;
                }
            });

            const labels = [...new Set(
                data
                    .map(band => band.label)
                    .filter(l => l !== null && l !== 'недостигаат податоци')
                    .sort((a, b) => {
                        const labelA = transliterateCyrillicToLatin(a);
                        const labelB = transliterateCyrillicToLatin(b);
                        return labelA.localeCompare(labelB, 'en');
                    })
            )];
            labels.forEach(label => {
                const option = document.createElement('option');
                option.value = label;
                option.textContent = `${label} (${labelCounts[label] || 0})`;
                labelSelect.appendChild(option);
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
            const matchesLabel = !filterLabel || band.label === filterLabel;

            return matchesName && matchesCity && matchesGenre && matchesSoundsLike && matchesStatus && matchesLabel;
        });

        renderBands(filteredBands);
    }

    // Render bands to table
    function renderBands(bands) {
        const bandTableBody = document.getElementById('band-table-body');
        bandTableBody.innerHTML = '';

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
            lastfm: 'fa-brands fa-lastfm',
            wikipedia: 'fa-brands fa-wikipedia-w',
            website: 'fa-solid fa-globe',
            linktree: 'fa-solid fa-tree'
        };

        bands.forEach(band => {
            const bandRow = document.createElement('tr');

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

                if (band.contact !== 'недостигаат податоци') {
                    linksHtml += `<a href="mailto:${band.contact}" class="contact-link"><i class="fa-solid fa-envelope"></i></a>`;
                }
            }

            let cityHtml = '';
            if (band.city === 'недостигаат податоци') {
                cityHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const cities = band.city.split(',').map(c => c.trim());
                cityHtml = cities.map(c => `<span class="city-item" data-filter="city" data-value="${c}" style="background: ${generateCityColor(c)}">${c}</span>`).join('');
            }

            let genreHtml = '';
            if (band.genre === 'недостигаат податоци') {
                genreHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const genres = band.genre.split(',').map(g => g.trim());
                genreHtml = genres.map(g => `<span class="genre-item" data-filter="genre" data-value="${g}">${g}</span>`).join('');
            }

            let soundsLikeHtml = '';
            if (band.soundsLike === 'недостигаат податоци') {
                soundsLikeHtml = '<span class="missing-data"><i class="fas fa-question-circle"></i></span>';
            } else {
                const soundsLike = band.soundsLike.split(',').map(s => s.trim());
                soundsLikeHtml = soundsLike.map(s => `<span class="sounds-like-item" data-filter="sounds-like" data-value="${s}">${s}</span>`).join('');
            }

            let nameHtml = band.name;
            if (band.label && band.label !== 'недостигаат податоци') {
                nameHtml += ` <span class="band-label" data-filter="label" data-value="${band.label}">${band.label}</span>`;
            }

            const statusClass = band.isActive === 'Непознато' ? 'missing-data' : '';

            bandRow.innerHTML = `
                <td data-label="Слика" class="band-image image-column"><img src="${band.image}" alt="${band.name}"></td>
                <td data-label="Име" class="name">${nameHtml}</td>
                <td data-label="Град">${cityHtml}</td>
                <td data-label="Жанр">${genreHtml}</td>
                <td data-label="Звучи като">${soundsLikeHtml}</td>
                <td data-label="Линкови" class="links">${linksHtml}</td>
                <td data-label="Статус" data-status="${band.isActive}" class="${statusClass}">
                    <span class="status-content" data-status-text="${band.isActive}">${band.isActive}</span>
                    <button class="edit-btn" data-index="${band.index}">Уреди</button>
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

            bandRow.querySelector('.edit-btn').addEventListener('click', () => openEditModal(band));

            bandTableBody.appendChild(bandRow);
        });
    }

    // Call the async function to load data
    loadBandsData();
});