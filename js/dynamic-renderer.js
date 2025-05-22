// 获取所有需要操作的 DOM 元素
const downloadListContainer = document.getElementById('dynamic-download-list');
const dataTypeFilter = document.getElementById('dataTypeFilter');
const levelFilter = document.getElementById('levelFilter'); // 对应 HTML 中 '行政级别' 的新 ID
const cityFilter = document.getElementById('cityFilter');   // 对应 HTML 中 '区域范围' 的新 ID
const timeFilter = document.getElementById('timeFilter');
const filterButton = document.getElementById('filterButton');
const loadingOverlay = document.getElementById('loadingOverlay'); // 确保这里能获取到 loadingOverlay

let currentPage = 1;
const itemsPerPage = 5;
let originalData = [];
let filteredData = [];

// Helper function: check if the year is within the range
function isYearInRange(updateTime, rangeString) {
    if (!updateTime) return false;
    const updateYear = parseInt(updateTime.substring(0, 4));

    if (rangeString.includes('-')) {
        const parts = rangeString.split('-');
        const startYear = parseInt(parts[0]);
        const endYear = parseInt(parts[1]);
        return updateYear >= startYear && updateYear <= endYear;
    } else {
        const year = parseInt(rangeString);
        return updateYear === year;
    }
}

// Function to dynamically populate "数据类型" filter options based on available data (from item.type)
function populateDataTypeFilterOptions() {
    const uniqueTypes = new Set();
    originalData.forEach(item => {
        if (item.type) {
            uniqueTypes.add(item.type);
        }
    });

    const sortedTypes = Array.from(uniqueTypes).sort(); // Alphabetical sort

    dataTypeFilter.innerHTML = '<option value="">全部类型</option>';
    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        dataTypeFilter.appendChild(option);
    });
}

// Function to dynamically populate "行政级别" filter options based on available data (from item.level)
function populateLevelFilterOptions() {
    const uniqueLevels = new Set();
    originalData.forEach(item => {
        if (item.level) {
            uniqueLevels.add(item.level);
        }
    });

    // Custom sort order for administrative levels for better UX (e.g., Provincial before Municipal)
    const levelOrder = ['国家级','省级', '市级'];
    const sortedLevels = Array.from(uniqueLevels).sort((a, b) => {
        const indexA = levelOrder.indexOf(a);
        const indexB = levelOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Fallback to alphabetical if not in custom order
        if (indexA === -1) return 1; // 'a' comes after 'b' if 'a' not in custom order
        if (indexB === -1) return -1; // 'b' comes after 'a' if 'b' not in custom order
        return indexA - indexB;
    });

    levelFilter.innerHTML = '<option value="">全部级别</option>';
    sortedLevels.forEach(level => {
        const option = document.createElement('option');
        option.value = level;
        option.textContent = level;
        levelFilter.appendChild(option);
    });
}

// Function to dynamically populate "区域范围" filter options based on selected level
function populateCityFilterOptions(selectedLevel) {
    const uniqueCities = new Set();
    // Filter originalData first by selectedLevel to get relevant cities
    const dataForCityFiltering = selectedLevel === '' ? originalData : originalData.filter(item => item.level === selectedLevel);

    dataForCityFiltering.forEach(item => {
        if (item.city) {
            uniqueCities.add(item.city);
        }
    });

    const sortedCities = Array.from(uniqueCities).sort(); // Alphabetical sort for cities

    cityFilter.innerHTML = '<option value="">全部区域</option>';
    sortedCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });
}

// Function to dynamically populate time filter options based on available data
function populateTimeFilterOptions() {
    const uniqueYears = new Set();
    originalData.forEach(item => {
        if (item.updateTime) {
            const year = item.updateTime.substring(0, 4);
            uniqueYears.add(year);
        }
    });

    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));

    timeFilter.innerHTML = '<option value="">全部时间</option>';

    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年`;
        timeFilter.appendChild(option);
    });
}

// Function to apply filters - 包含加载动画逻辑
function applyFilters() {
    // 1. 显示加载状态
    const originalButtonContent = filterButton.innerHTML;
    filterButton.disabled = true;
    filterButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> 筛选中...';
    loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        const selectedDataType = dataTypeFilter.value;
        const selectedLevel = levelFilter.value; // Get selected administrative level
        const selectedCity = cityFilter.value;   // Get selected city
        const selectedTime = timeFilter.value;

        filteredData = originalData.filter(item => {
            // Filter by 'type' for "数据类型"
            const matchesDataType = selectedDataType === '' || (item.type && item.type === selectedDataType);

            // Filter by 'level' for "行政级别"
            const matchesLevel = selectedLevel === '' || (item.level && item.level === selectedLevel);

            // Filter by 'city' for "区域范围"
            const matchesCity = selectedCity === '' || (item.city && item.city === selectedCity);

            const matchesTime = selectedTime === '' || isYearInRange(item.updateTime, selectedTime);

            return matchesDataType && matchesLevel && matchesCity && matchesTime;
        });

        currentPage = 1;
        renderDownloadItems();
        setupPagination();

        // 2. 隐藏加载状态并恢复按钮
        loadingOverlay.classList.add('hidden');
        filterButton.disabled = false;
        filterButton.innerHTML = originalButtonContent;
    }, 500); // 模拟 500 毫秒的加载时间
}


// Function to asynchronously fetch data and render
async function fetchDataAndRender() {
    try {
        // 定义六个数据文件的路径
        const filePaths = [
            'data/describe/weibo_describe.json',
            'data/describe/poi_describe.json',
            'data/describe/aoi_describe.json',
            'data/describe/trajectory_describe.json',
            'data/describe/od_describe.json',
            'data/describe/building_describe.json'
        ];

        // 并行加载所有数据文件
        const responses = await Promise.all(filePaths.map(path => fetch(path)));
        
        // 检查所有响应状态
        const failedResponse = responses.find(res => !res.ok);
        if (failedResponse) {
            throw new Error(`HTTP error! status: ${failedResponse.status}`);
        }

        // 解析所有JSON数据
        const jsonDataArray = await Promise.all(responses.map(res => res.json()));
        
        // 合并所有数据（假设为数组格式）
        originalData = [].concat(...jsonDataArray);

        // 初始化过滤器
        populateDataTypeFilterOptions();
        populateLevelFilterOptions();
        populateTimeFilterOptions();
        populateCityFilterOptions(''); // 为所有级别初始填充城市

        // 初始渲染
        applyFilters(); 
    } catch (error) {
        console.error('Error fetching data:', error);
        downloadListContainer.innerHTML = '<p class="text-center text-red-500 text-lg py-8">加载数据失败，请稍后再试或检查文件路径。</p>';
    }
}

function renderDownloadItems() {
    downloadListContainer.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsToRender = filteredData.slice(startIndex, endIndex);

    if (itemsToRender.length === 0) {
        downloadListContainer.innerHTML = '<p class="text-center text-gray-500 text-lg py-8">没有找到符合筛选条件的数据。</p>';
        return;
    }

    itemsToRender.forEach(item => {
        const statusClass = item.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        const downloadBtnClass = item.isDownloadable ? 'btn-primary' : 'bg-gray-300 text-gray-700 cursor-not-allowed';
        const downloadBtnText = item.isDownloadable ? '<i class="fa-solid fa-download mr-2"></i> 立即下载' : '<i class="fa-solid fa-hourglass-half mr-2"></i> 暂不可下载';

        const itemHTML = `
            <div class="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between card-hover">
                <div class="md:w-2/3 mb-4 md:mb-0">
                    <h3 class="text-xl font-bold text-dark mb-2">${item.title}</h3>
                    <h5 class="text-gray-500 mb-2"><i class="fa-solid fa-tag mr-1"></i> ${item.description}</h5>
                    <div class="flex flex-wrap items-center text-sm text-gray-500">
                        <span class="mr-4 mb-2"><i class="fa-solid fa-cube mr-1"></i> ${item.size}</span>
                        <span class="mr-4 mb-2"><i class="fa-solid fa-clock mr-1"></i> 最新记录${item.updateTime}年</span>
                        <span class="mr-4 mb-2"><i class="fa-solid fa-building mr-1"></i> ${item.provider}</span>
                        <span class="inline-block ${statusClass} text-xs font-medium px-2.5 py-0.5 rounded-full mb-2">${item.status}</span>
                    </div>
                    <div class="mt-3">
                        ${item.tags.map(tag => `<span class="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full mr-2 mb-2">${tag}</span>`).join('')}
                    </div>
                    <div class="mt-3 text-sm text-gray-500">
                        支持格式: ${item.formats.join(', ')}
                    </div>
                </div>
                <div class="md:w-1/3 flex justify-end">
                    <button class="${downloadBtnClass} px-6 py-3 download-button"
                                ${item.isDownloadable ? '' : 'disabled'}
                                data-download-url="${item.url || ''}">
                        ${downloadBtnText}
                    </button>
                </div>
            </div>
        `;
        downloadListContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    const allDownloadButtons = downloadListContainer.querySelectorAll('.download-button');
    allDownloadButtons.forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', (event) => {
                const downloadUrl = event.currentTarget.dataset.downloadUrl;
                if (downloadUrl) {
                    window.open(downloadUrl, '_blank');
                } else {
                    alert('下载链接不可用。');
                }
            });
        }
    });
}


function setupPagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    let paginationContainer = document.querySelector('.pagination-controls');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-controls flex justify-center items-center space-x-2 mt-8';
        downloadListContainer.parentNode.insertBefore(paginationContainer, downloadListContainer.nextSibling);
    }
    paginationContainer.innerHTML = '';

    if (totalPages <= 1 && filteredData.length > 0) {
        return;
    }
    if (filteredData.length === 0) {
        return;
    }

    const prevButton = document.createElement('button');
    prevButton.className = 'p-2 rounded-lg transition-colors duration-200 ' + (currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100 text-primary');
    prevButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderDownloadItems();
            setupPagination();
        }
    });
    paginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = 'w-10 h-10 flex items-center justify-center rounded-lg font-medium transition-colors duration-200 ' + (i === currentPage ? 'bg-primary text-white' : 'bg-white hover:bg-gray-100 text-gray-700');
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => {
            currentPage = i;
            renderDownloadItems();
            setupPagination();
        });
        paginationContainer.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.className = 'p-2 rounded-lg transition-colors duration-200 ' + (currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100 text-primary');
    nextButton.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderDownloadItems();
            setupPagination();
        }
    });
    paginationContainer.appendChild(nextButton);
}

// --- Event Listeners ---
// Click the main filter button to apply all filters
filterButton.addEventListener('click', applyFilters);

// Add change listeners to all filter selects to apply filters immediately
dataTypeFilter.addEventListener('change', applyFilters);
timeFilter.addEventListener('change', applyFilters);
cityFilter.addEventListener('change', applyFilters); // Now listening to the new cityFilter

// Cascading filter logic: When '行政级别' (levelFilter) changes,
// re-populate '区域范围' (cityFilter) options and then re-apply all filters.
levelFilter.addEventListener('change', () => {
    // Re-populate city options based on the newly selected level
    populateCityFilterOptions(levelFilter.value);
    // Reset city filter to '全部区域' to avoid holding a stale selection
    cityFilter.value = '';
    // Apply all filters with the updated city options
    applyFilters();
});


// Initial data fetch and render when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', fetchDataAndRender);