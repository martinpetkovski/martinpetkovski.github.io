document.addEventListener('DOMContentLoaded', () => {
    let bandsData = [];

    // Fetch bands data
    fetch('bands.json')
        .then(response => response.json())
        .then(data => {
            // Process missing data and sort bands
            bandsData = data.muzickaMasterLista.map(band => ({
                name: band.name || 'недостигаат податоци',
                city: band.city || 'недостигаат податоци',
                genre: band.genre || 'недостигаат податоци',
                soundsLike: band.soundsLike || 'недостигаат податоци',
                links: Object.keys(band.links).length ? band.links : { none: 'недостигаат податоци' },
                contact: band.contact || 'недостигаат податоци',
                image: band.image || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae', // Fallback image
                isActive: typeof band.isActive === 'boolean' ? band.isActive : false
            })).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

            populateFilters();
            renderBands(bandsData);

            // Initialize Select2 for city and genre
            $('#filter-city').select2({
                placeholder: 'Сите градови',
                allowClear: true,
                width: '100%'
            });
            $('#filter-genre').select2({
                placeholder: 'Сите жанрови',
                allowClear: true,
                width: '100%'
            });

            // Workaround for native select option hover (status filter)
            const statusSelect = document.getElementById('filter-status');
            statusSelect.addEventListener('mousemove', (e) => {
                const options = statusSelect.querySelectorAll('option');
                options.forEach(option => {
                    option.style.fontWeight = 'normal';
                });
                if (e.target.tagName === 'OPTION') {
                    e.target.style.fontWeight = '600';
                }
            });
            statusSelect.addEventListener('mouseout', () => {
                const options = statusSelect.querySelectorAll('option');
                options.forEach(option => {
                    option.style.fontWeight = 'normal';
                });
            });

            // Search and filter event listeners
            document.getElementById('search-name').addEventListener('input', filterBands);
            $('#filter-city').on('change', filterBands);
            $('#filter-genre').on('change', filterBands);
            statusSelect.addEventListener('change', filterBands);
        })
        .catch(error => {
            console.error('Error loading bands:', error);
            document.getElementById('band-table-body').innerHTML = '<tr><td colspan="8">Извинете, нешто тргна наопаку.</td></tr>';
        });

    // Populate city and genre dropdowns
    function populateFilters() {
        const citySelect = document.getElementById('filter-city');
        const genreSelect = document.getElementById('filter-genre');

        // Get unique cities (split by comma)
        const cities = [...new Set(
            bandsData
                .flatMap(band => band.city.split(',').map(c => c.trim()))
                .filter(c => c !== 'недостигаат податоци')
                .sort()
        )];
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        // Get unique genres (split by comma)
        const genres = [...new Set(
            bandsData
                .flatMap(band => band.genre.split(',').map(g => g.trim()))
                .filter(g => g !== 'недостигаат податоци')
                .sort()
        )];
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreSelect.appendChild(option);
        });
    }

    // Filter bands based on inputs
    function filterBands() {
        const searchName = document.getElementById('search-name').value.toLowerCase();
        const filterCity = $('#filter-city').val() || '';
        const filterGenre = $('#filter-genre').val() || '';
        const filterStatus = document.getElementById('filter-status').value;

        const filteredBands = bandsData.filter(band => {
            const matchesName = band.name.toLowerCase().includes(searchName);
            const matchesCity = !filterCity || 
                band.city.split(',').map(c => c.trim()).includes(filterCity);
            const matchesGenre = !filterGenre || 
                band.genre.split(',').map(g => g.trim()).includes(filterGenre);
            const matchesStatus = !filterStatus || 
                (filterStatus === 'active' && band.isActive) || 
                (filterStatus === 'inactive' && !band.isActive);
            return matchesName && matchesCity && matchesGenre && matchesStatus;
        });

        renderBands(filteredBands);
    }

    // Render bands to table
    function renderBands(bands) {
        const bandTableBody = document.getElementById('band-table-body');
        bandTableBody.innerHTML = '';

        bands.forEach(band => {
            const bandRow = document.createElement('tr');

            // Map social links to Font Awesome icons
            const linkIcons = {
                facebook: 'fa-brands fa-facebook',
                instagram: 'fa-brands fa-instagram',
                twitter: 'fa-brands fa-twitter',
                bandcamp: 'fa-brands fa-bandcamp',
                soundcloud: 'fa-brands fa-soundcloud',
                youtube: 'fa-brands fa-youtube'
            };

            // Handle links display
            let linksHtml = '';
            if (band.links.none === 'недостигаат податоци') {
                linksHtml = '<span class="missing-data">недостигаат податоци</span>';
            } else {
                linksHtml = Object.keys(band.links)
                    .map(platform => {
                        const url = band.links[platform];
                        const iconClass = linkIcons[platform] || 'fa-solid fa-link';
                        return `<a href="${url}" target="_blank"><i class="${iconClass}"></i></a>`;
                    })
                    .join('');
            }

            // Handle genre display, don't split by comma
            const genreHtml = band.genre === 'недостигаат податоци' 
                ? '<span class="missing-data">недостигаат податоци</span>' 
                : band.genre.split(',').map(g => `<span class="genre">${g.trim()}</span>`).join(', ');

            // Handle contact display
            const contactHtml = band.contact === 'недостигаат податоци' 
                ? '<span class="missing-data">недостигаат податоци</span>' 
                : `<a href="mailto:${band.contact}">${band.contact}</a>`;

            // Handle soundsLike display
            const soundsLikeHtml = band.soundsLike === 'недостигаат податоци' 
                ? '<span class="missing-data">недостигаат податоци</span>' 
                : band.soundsLike;

            bandRow.innerHTML = `
                <td data-label="Слика" class="band-image"><img src="${band.image}" alt="${band.name}"></td>
                <td data-label="Име" class="name">${band.name}</td>
                <td data-label="Град">${band.city}</td>
                <td data-label="Жанр">${genreHtml}</td>
                <td data-label="Звучи као">${soundsLikeHtml}</td>
                <td data-label="Линкови" class="links">${linksHtml}</td>
                <td data-label="Контакт" class="contact">${contactHtml}</td>
                <td data-label="Активен" class="status-${band.isActive ? 'active' : 'inactive'}">
                    <span>${band.isActive ? 'АКТИВЕН' : 'НЕАКТИВЕН'}</span>
                </td>
            `;

            bandTableBody.appendChild(bandRow);
        });
    }
});