// 获取所有需要操作的 DOM 元素
const downloadListContainer = document.getElementById('dynamic-download-list');
const dataTypeFilter = document.getElementById('dataTypeFilter');
const levelFilter = document.getElementById('levelFilter');
const cityFilter = document.getElementById('cityFilter');
const timeFilter = document.getElementById('timeFilter');
const filterButton = document.getElementById('filterButton');
const loadingOverlay = document.getElementById('loadingOverlay');

let currentPage = 1;
const itemsPerPage = 5;
let originalData = [];
let filteredData = [];

// 辅助函数：检查年份是否在范围内
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

/**
 * 根据数据中唯一的属性值填充给定的筛选器下拉菜单。
 * @param {HTMLElement} filterElement - 要填充的 select 元素。
 * @param {string} property - 从中提取唯一值的项目属性（例如，'type'，'level'）。
 * @param {string} allOptionText - “全部”选项的文本（例如，'全部类型'）。
 * @param {Array<Object>} dataSubset - 用于获取选项的数据数组。
 * @param {Function} [sortCallback] - 可选的自定义选项排序函数。
 * @param {Function} [optionTextFormatter] - 可选的用于格式化选项文本内容的函数。
 */
function populateFilterOptions(filterElement, property, allOptionText, dataSubset, sortCallback = null, optionTextFormatter = null) {
    const uniqueValues = new Set();
    dataSubset.forEach(item => {
        if (item[property]) {
            uniqueValues.add(item[property]);
        }
    });

    let sortedValues = Array.from(uniqueValues);
    if (sortCallback) {
        sortedValues.sort(sortCallback);
    } else {
        sortedValues.sort(); // 默认按字母顺序排序
    }

    filterElement.innerHTML = `<option value="">${allOptionText}</option>`;
    sortedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = optionTextFormatter ? optionTextFormatter(value) : value;
        filterElement.appendChild(option);
    });
}

/**
 * 根据当前选择协调从属筛选器的重新填充。
 * 此函数确保当更高级别的筛选器（例如，数据类型）更改时，
 * 后续筛选器（级别、城市、时间）中的选项会相应更新。
 * @param {string} changedFilterId - 刚刚更改的筛选器的 ID。
 */
function updateDependentFilters(changedFilterId) {
    const selectedDataType = dataTypeFilter.value;
    const selectedLevel = levelFilter.value;
    const selectedCity = cityFilter.value;

    let dataForLevel = originalData;
    let dataForCity = originalData;
    let dataForTime = originalData;

    // 根据选定的数据类型筛选“级别”数据
    if (selectedDataType) {
        dataForLevel = originalData.filter(item => item.type === selectedDataType);
    }
    
    // 根据选定的数据类型和级别筛选“城市”数据
    dataForCity = dataForLevel; // 从为级别筛选过的数据开始
    if (selectedLevel) {
        dataForCity = dataForCity.filter(item => item.level === selectedLevel);
    }

    // 根据选定的数据类型、级别和城市筛选“时间”数据
    dataForTime = dataForCity; // 从为城市筛选过的数据开始
    if (selectedCity) {
        dataForTime = dataForTime.filter(item => item.city === selectedCity);
    }

    // 确定需要重新填充和重置哪些筛选器
    if (changedFilterId === 'dataTypeFilter') {
        levelFilter.value = '';
        cityFilter.value = '';
        timeFilter.value = '';
        populateFilterOptions(levelFilter, 'level', '全部级别', dataForLevel, (a, b) => {
            const levelOrder = ['国家级', '省级', '市级'];
            const indexA = levelOrder.indexOf(a);
            const indexB = levelOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        populateFilterOptions(cityFilter, 'city', '全部区域', dataForCity);
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dataForTime, (a, b) => parseInt(b) - parseInt(a), year => `${year}年`);
    } else if (changedFilterId === 'levelFilter') {
        cityFilter.value = '';
        timeFilter.value = '';
        populateFilterOptions(cityFilter, 'city', '全部区域', dataForCity);
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dataForTime, (a, b) => parseInt(b) - parseInt(a), year => `${year}年`);
    } else if (changedFilterId === 'cityFilter') {
        timeFilter.value = '';
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dataForTime, (a, b) => parseInt(b) - parseInt(a), year => `${year}年`);
    }
    // 'timeFilter' 不需要进一步的从属筛选器，因此不需要操作
}

// 应用筛选器功能 - 包含加载动画逻辑
function applyFilters() {
    // 1. 显示加载状态
    const originalButtonContent = filterButton.innerHTML;
    filterButton.disabled = true;
    filterButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> 筛选中...';
    loadingOverlay.classList.remove('hidden');

    // 使用一个小超时，即使筛选很快，加载动画也能显示
    setTimeout(() => {
        const selectedDataType = dataTypeFilter.value;
        const selectedLevel = levelFilter.value;
        const selectedCity = cityFilter.value;
        const selectedTime = timeFilter.value;

        filteredData = originalData.filter(item => {
            const matchesDataType = selectedDataType === '' || (item.type && item.type === selectedDataType);
            const matchesLevel = selectedLevel === '' || (item.level && item.level === selectedLevel);
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
    }, 500); // 减少超时时间，因为筛选是同步且快速的
}

// 异步获取数据并渲染的函数
async function fetchDataAndRender() {
    try {
        const filePaths = [
            'data/describe/weibo.json',
            'data/describe/poi.json',
            'data/describe/aoi.json',
            'data/describe/trajectory.json',
            'data/describe/od.json',
            'data/describe/building.json'
        ];

        const responses = await Promise.all(filePaths.map(path => fetch(path)));
        
        const failedResponse = responses.find(res => !res.ok);
        if (failedResponse) {
            throw new Error(`HTTP error! status: ${failedResponse.status}`);
        }

        const jsonDataArray = await Promise.all(responses.map(res => res.json()));
        
        originalData = [].concat(...jsonDataArray);
        filteredData = [...originalData]; // 使用所有原始数据初始化 filteredData

        // 首次填充所有筛选器
        populateFilterOptions(dataTypeFilter, 'type', '全部类型', originalData);
        // 在 dataTypeFilter 填充后，首次填充从属筛选器
        updateDependentFilters('dataTypeFilter');

        // 首次渲染
        renderDownloadItems();
        setupPagination();
    } catch (error) {
        console.error('获取数据失败:', error);
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

    const maxPageButtons = 5; // 最多显示5个页码按钮
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
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

// --- 事件监听器 ---
filterButton.addEventListener('click', applyFilters);

// 整合筛选器更改的事件监听器
[dataTypeFilter, levelFilter, cityFilter, timeFilter].forEach(filter => {
    filter.addEventListener('change', (event) => {
        updateDependentFilters(event.target.id);
        applyFilters();
    });
});

// DOM 完全加载后，首次获取数据并渲染
document.addEventListener('DOMContentLoaded', fetchDataAndRender);