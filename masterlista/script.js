document.addEventListener('DOMContentLoaded', () => {
    let bandsData = [];
    let isEditMode = false;
    const lastfmApiKey = 'd186251f2ae019335f832db01d96c2f9';
    const defaultFallbackImage = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg';

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

    async function getLastfmArtistImage(lastfmName, fallbackName) {
        const artistName = lastfmName || fallbackName;
        if (!artistName) {
            console.warn(`No artist name provided`);
            return null;
        }
        try {
            const albumsResponse = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artistName)}&api_key=${lastfmApiKey}&format=json`
            );
            const albumsData = await albumsResponse.json();
            if (albumsData.error) {
                console.warn(`No albums found for artist ${artistName} (Error: ${albumsData.message})`);
                return null;
            }
            if (albumsData.topalbums && albumsData.topalbums.album && albumsData.topalbums.album.length > 0) {
                const topAlbum = albumsData.topalbums.album[0];
                if (topAlbum.image && topAlbum.image.length > 0) {
                    const sizeDimensions = { small: 34, medium: 64, large: 174, extralarge: 300, mega: 300 };
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
                        console.warn(`No valid image found for top album "${topAlbum.name}" of artist ${artistName}`);
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

    async function loadBandsData() {
        const loadingBar = document.getElementById('loading-bar');
        const controls = document.querySelector('.controls');
        try {
            console.log('Loading bands data...');
            loadingBar.classList.add('active');
            controls.style.display = 'none';

            const response = await fetch('bands.json');
            const data = await response.json();
            const isCompactView = !document.getElementById('mode-toggle-checkbox').checked;

            bandsData = await Promise.all(
                data.muzickaMasterLista.map(async (band) => {
                    let image = band.image || defaultFallbackImage;
                    if (!isCompactView) {
                        const lastfmImage = await getLastfmArtistImage(band.lastfmName, band.name);
                        if (lastfmImage) {
                            image = lastfmImage;
                        } else {
                            console.warn(`No Last.fm image found for ${band.name}, using JSON image: ${image}`);
                        }
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
                        imageFetched: !isCompactView
                    };
                })
            );
            bandsData.sort((a, b) => {
                const nameA = transliterateCyrillicToLatin(a.name);
                const nameB = transliterateCyrillicToLatin(b.name);
                return nameA.localeCompare(nameB, 'en');
            });
            document.getElementById('total-bands').textContent = bandsData.length;
            const lastModified = new Date('2025-05-24T00:00:00');
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
            const formattedDate = lastModified.toLocaleDateString('mk-MK', dateOptions).replace(' г.', '');
            const formattedTime = lastModified.toLocaleTimeString('mk-MK', timeOptions);
            document.getElementById('last-modified').textContent = `${formattedDate} ${formattedTime}`;
            console.log(`Loaded ${bandsData.length} bands`);
            populateFilters(bandsData);
            renderBands(bandsData);
            initializeFilters();
            initializeModal();
            initializeCopyData();
            initializeMasterEdit();
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
        document.getElementById('mode-toggle-checkbox').addEventListener('change', async (e) => {
            console.log('Mode toggle changed:', e.target.checked);
            document.body.classList.toggle('compact', !e.target.checked);
            document.body.classList.toggle('expanded', e.target.checked);
            if (e.target.checked) {
                console.log('Fetching Last.fm images for expanded view');
                bandsData = await Promise.all(
                    bandsData.map(async (band) => {
                        if (!band.imageFetched) {
                            const lastfmImage = await getLastfmArtistImage(band.lastfmName, band.name);
                            return {
                                ...band,
                                image: lastfmImage || band.image || defaultFallbackImage,
                                imageFetched: true
                            };
                        }
                        return band;
                    })
                );
            }
            renderBands(bandsData);
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
            alert('Грешка: елементите на модалот не се пронајдени.');
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

        ['band-city', 'band-genre', 'band-sounds-like'].forEach(id => {
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
            ['band-city-tags', 'band-genre-tags', 'band-sounds-like-tags'].forEach(id => {
                document.getElementById(id).innerHTML = '';
            });
        }

        function updateTags(inputId) {
            const input = document.getElementById(inputId);
            const tagContainer = document.getElementById(`${inputId}-tags`);
            const value = input.value.trim();
            tagContainer.innerHTML = '';
            if (value && value !== 'недостигаат податоци') {
                const items = value.split(',').map(item => item.trim()).filter(item => item);
                const tagClass = inputId === 'band-city' ? 'city-tag' :
                                 inputId === 'band-genre' ? 'genre-tag' : 'sounds-like-tag';
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
            const image = await getLastfmArtistImage(band.lastfmName, band.name) || defaultFallbackImage;
            band.image = image;
            band.imageFetched = true;
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
            modal.style.display = 'none';
            form.reset();
            linksContainer.innerHTML = '';
            clearTags();
            clearErrors();
            console.log('Form submission successful');
        });

        function addLinkInput(platform = 'none', url = '') {
            console.log('Adding link input:', { platform, url });
            const linkGroup = document.createElement('div');
            linkGroup.className = 'link-group';
            const select = document.createElement('select');
            select.innerHTML = '<option value="none">Избери платформа</option>' +
                socialPlatforms.map(p => `<option value="${p.id}" ${p.id === platform ? 'selected' : ''}>${p.name}</option>`).join('');
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
            linkGroup.appendChild(select);
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
                    alert('Грешка: нема податоци за артистот за уредување.');
                    return;
                }
                document.getElementById('band-name').value = band.name !== 'недостигаат податоци' ? band.name : '';
                document.getElementById('band-city').value = band.city !== 'недостигаат податоци' ? band.city : '';
                document.getElementById('band-genre').value = band.genre !== 'недостигаат податоци' ? band.genre : '';
                document.getElementById('band-sounds-like').value = band.soundsLike !== 'недостигаат податоци' ? band.soundsLike : '';
                document.getElementById('band-status').value = band.isActive || 'Непознато';
                document.getElementById('band-label').value = band.label || '';
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
                ['band-city', 'band-genre', 'band-sounds-like'].forEach(id => updateTags(id));
            }
            modal.style.display = 'block';
            console.log('Modal opened successfully');
        }

        function deleteBand(index) {
            console.log(`Delete band requested for index ${index}`);
            if (confirm('Дали сте сигурни дека сакате да го избришете овој бенд?')) {
                console.log(`Deleting band at index ${index}`);
                bandsData.splice(index, 1);
                document.getElementById('total-bands').textContent = bandsData.length;
                populateFilters(bandsData);
                filterBands();
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
            alert('Грешка: копчето за копирање податоци не е пронајдено.');
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
                        label: band.label,
                        image: band.image
                    }))
                };
                const json = JSON.stringify(exportData, null, 2);
                navigator.clipboard.writeText(json).then(() => {
                    console.log('Data copied to clipboard successfully');
                    alert('Податоците се копирани во клипборд.');
                }).catch(err => {
                    console.error('Error copying data to clipboard:', err);
                    alert('Грешка при копирање на податоците во клипборд. Проверете ја конзолата за детали.');
                });
            } catch (error) {
                console.error('Error preparing data for copy:', error);
                alert('Грешка при подготовка на податоците за копирање. Проверете ја конзолата за детали.');
            }
        });
    }

    function initializeMasterEdit() {
        console.log('Initializing master edit button');
        const masterEditBtn = document.getElementById('master-edit-btn');
        if (!masterEditBtn) {
            console.error('Master edit button not found in DOM');
            alert('Грешка: копчето за уредување не е пронајдено.');
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
                    labelCounts[band.label] = (labelCounts[band.label] || 0) + 1;
                }
            });
            const labels = [...new Set(
                data
                    .map(band => band.label)
                    .filter(l => l !== null && l !== 'недостигаат податоци')
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
            const matchesLabel = !filterLabel || band.label === filterLabel;
            return matchesName && matchesCity && matchesGenre && matchesSoundsLike && matchesStatus && matchesLabel;
        });
        renderBands(filteredBands);
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
                nameHtml += ` <span class="band-label" data-filter="label" data-value="${band.label}">${band.label}</span>`;
            }
            const statusClass = band.isActive === 'Непознато' ? 'missing-data' : '';
            bandRow.innerHTML = `
                <td data-label="Слика" class="band-image image-column">${document.body.classList.contains('compact') ? '' : `<img src="${band.image}" alt="${band.name}">`}</td>
                <td data-label="Име" class="name">${nameHtml}</td>
                <td data-label="Град">${cityHtml}</td>
                <td data-label="Жанр">${genreHtml}</td>
                <td data-label="Звучи като">${soundsLikeHtml}</td>
                <td data-label="Линкови" class="links">${linksHtml}</td>
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
                    alert('Грешка: функцијата за уредување не е достапна.');
                }
            });
            bandTableBody.appendChild(bandRow);
        });
    }

    loadBandsData();
});