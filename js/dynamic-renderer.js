/**
 * GeoDataHub - 动态渲染系统 (标准分页版)
 */
const downloadListContainer = document.getElementById('dynamic-download-list');
const dataTypeFilter = document.getElementById('dataTypeFilter');
const levelFilter = document.getElementById('levelFilter');
const cityFilter = document.getElementById('cityFilter');
const timeFilter = document.getElementById('timeFilter');
const filterButton = document.getElementById('filterButton');
const resetButton = document.getElementById('resetButton'); 
const loadingOverlay = document.getElementById('loadingOverlay');

window.currentPage = 1;
const itemsPerPage = 5;
window.allDatasets = [];      
window.filteredDatasets = []; 

// 辅助：年份范围
function isYearInRange(updateTime, rangeString) {
    if (!updateTime) return false;
    const updateYear = parseInt(updateTime.substring(0, 4));
    if (rangeString.includes('-')) {
        const parts = rangeString.split('-');
        return updateYear >= parseInt(parts[0]) && updateYear <= parseInt(parts[1]);
    }
    return updateYear === parseInt(rangeString);
}

// 辅助：下拉选项填充
function populateFilterOptions(filterElement, property, allOptionText, dataSubset, sortCallback = null, optionTextFormatter = null) {
    const uniqueValues = new Set();
    dataSubset.forEach(item => { if (item[property]) uniqueValues.add(item[property]); });
    let sortedValues = Array.from(uniqueValues);
    sortedValues.sort(sortCallback || ((a, b) => a.localeCompare(b)));

    filterElement.innerHTML = `<option value="">${allOptionText}</option>`;
    sortedValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = optionTextFormatter ? optionTextFormatter(value) : value;
        filterElement.appendChild(option);
    });
}

// 下拉级联更新
function updateDependentFilters(changedFilterId) {
    const sType = dataTypeFilter.value;
    const sLevel = levelFilter.value;
    const sCity = cityFilter.value;

    let dLevel = window.allDatasets;
    if (sType) dLevel = dLevel.filter(i => i.type === sType);
    let dCity = dLevel;
    if (sLevel) dCity = dCity.filter(i => i.level === sLevel);
    let dTime = dCity;
    if (sCity) dTime = dTime.filter(i => i.city === sCity);

    if (changedFilterId === 'dataTypeFilter') {
        levelFilter.value = ''; cityFilter.value = ''; timeFilter.value = '';
        populateFilterOptions(levelFilter, 'level', '全部级别', dLevel, (a, b) => ['国家级', '省级', '市级'].indexOf(a) - ['国家级', '省级', '市级'].indexOf(b));
        populateFilterOptions(cityFilter, 'city', '全部区域', dCity, (a, b) => (a === '全国' ? -1 : b === '全国' ? 1 : a.localeCompare(b)));
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dTime, (a, b) => parseInt(b) - parseInt(a), y => `${y}年`);
    } else if (changedFilterId === 'levelFilter') {
        cityFilter.value = ''; timeFilter.value = '';
        populateFilterOptions(cityFilter, 'city', '全部区域', dCity, (a, b) => (a === '全国' ? -1 : b === '全国' ? 1 : a.localeCompare(b)));
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dTime, (a, b) => parseInt(b) - parseInt(a), y => `${y}年`);
    } else if (changedFilterId === 'cityFilter') {
        timeFilter.value = '';
        populateFilterOptions(timeFilter, 'updateTime', '全部时间', dTime, (a, b) => parseInt(b) - parseInt(a), y => `${y}年`);
    }
}

// 自动滚动到数据区域
function scrollToDataSection() {
    const filterSection = document.querySelector('.bg-white.rounded-2xl.shadow-xl') || document.getElementById('datasets-section');
    if (filterSection) {
        const y = filterSection.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

window.applyFilters = function() {
    const btnIcon = filterButton.querySelector('i');
    filterButton.disabled = true;
    if (btnIcon) btnIcon.classList.add('fa-spin'); 
    loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        const sType = dataTypeFilter.value;
        const sLevel = levelFilter.value;
        const sCity = cityFilter.value;
        const sTime = timeFilter.value;
        const searchTerm = window.datasetSearchInstance ? window.datasetSearchInstance.currentSearchTerm : '';

        window.filteredDatasets = window.allDatasets.filter(item => {
            const mType = !sType || item.type === sType;
            const mLevel = !sLevel || item.level === sLevel;
            const mCity = !sCity || item.city === sCity;
            const mTime = !sTime || isYearInRange(item.updateTime, sTime);

            const mSearch = !searchTerm || (
                (item.title || "").toLowerCase().includes(searchTerm) || 
                (item.description || "").toLowerCase().includes(searchTerm) ||
                (item.city || "").toLowerCase().includes(searchTerm) ||
                (item.provider || "").toLowerCase().includes(searchTerm) ||
                (Array.isArray(item.tags) && item.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );

            return mType && mLevel && mCity && mTime && mSearch;
        });

        window.currentPage = 1;
        window.renderDatasets();
        
        // 恢复按钮和隐藏 loading
        filterButton.disabled = false;
        if (btnIcon) btnIcon.classList.remove('fa-spin');
        loadingOverlay.classList.add('hidden');
        
    }, 1000); 
};

// 深度重置
window.resetFilters = function() {
    dataTypeFilter.value = '';
    levelFilter.value = '';
    cityFilter.value = '';
    timeFilter.value = '';
    updateDependentFilters('dataTypeFilter');
    if (window.datasetSearchInstance) {
        window.datasetSearchInstance.searchInput.value = '';
        window.datasetSearchInstance.currentSearchTerm = '';
        if (window.datasetSearchInstance.clearBtn) window.datasetSearchInstance.clearBtn.classList.add('hidden');
    }
    window.filteredDatasets = [...window.allDatasets];
    window.currentPage = 1;
    window.renderDatasets();
    scrollToDataSection();
};

window.renderDatasets = function() {
    downloadListContainer.innerHTML = '';
    const start = (window.currentPage - 1) * itemsPerPage;
    const items = window.filteredDatasets.slice(start, start + itemsPerPage);

    if (items.length === 0) {
        downloadListContainer.innerHTML = '<div class="col-span-full text-center py-20 text-gray-400">未找到相关数据。</div>';
    } else {
        items.forEach(item => {
            const html = `
                <div class="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between card-hover mb-4 border border-gray-100">
                    <div class="md:w-2/3">
                        <h3 class="text-xl font-bold text-dark mb-2">${item.title}</h3>
                        <p class="text-gray-500 text-sm mb-4">${item.description}</p>
                        <div class="flex flex-wrap gap-4 text-xs text-gray-400">
                            <span><i class="fa-solid fa-cube mr-1"></i>${item.size}</span>
                            <span><i class="fa-solid fa-clock mr-1"></i>${item.updateTime}年</span>
                            <span><i class="fa-solid fa-building mr-1"></i>${item.provider}</span>
                        </div>
                    </div>
                    <div class="md:w-1/3 flex justify-end">
                        <button class="btn-primary px-6 py-2 rounded-lg" ${item.isDownloadable ? `onclick="window.open('${item.url}')"` : 'disabled'}>
                            ${item.isDownloadable ? '立即下载' : '暂不可用'}
                        </button>
                    </div>
                </div>`;
            downloadListContainer.insertAdjacentHTML('beforeend', html);
        });
    }
    setupPagination();
};

/**
 * 核心：标准分页逻辑 (1, 2, 3 ... max)
 */
function setupPagination() {
    const totalPages = Math.ceil(window.filteredDatasets.length / itemsPerPage);
    let nav = document.querySelector('.pagination-controls') || document.createElement('div');
    nav.className = 'pagination-controls flex justify-center items-center space-x-2 mt-8';
    if (!nav.parentNode) downloadListContainer.after(nav);
    nav.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (content, page, active = false, disabled = false) => {
        const b = document.createElement('button');
        b.innerHTML = content;
        b.className = `w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-all ${active ? 'bg-primary text-white' : disabled ? 'text-gray-300' : 'bg-white border text-gray-600 hover:text-primary hover:border-primary'}`;
        if (!active && !disabled) {
            b.onclick = () => { window.currentPage = page; window.renderDatasets(); scrollToDataSection(); };
        }
        nav.appendChild(b);
    };

    const addDots = () => {
        const span = document.createElement('span');
        span.className = 'px-2 text-gray-400 font-bold';
        span.textContent = '...';
        nav.appendChild(span);
    };

    // 1. 上一页
    addBtn('<i class="fa-solid fa-chevron-left"></i>', window.currentPage - 1, false, window.currentPage === 1);

    // 2. 分页展示算法
    if (totalPages <= 7) {
        // 如果总页数少，直接全显示
        for (let i = 1; i <= totalPages; i++) addBtn(i, i, i === window.currentPage);
    } else {
        // 复杂逻辑：始终显示第一页
        addBtn(1, 1, window.currentPage === 1);

        if (window.currentPage > 4) addDots();

        // 中间页码范围
        let start = Math.max(2, window.currentPage - 2);
        let end = Math.min(totalPages - 1, window.currentPage + 2);

        // 修正范围边界确保显示个数
        if (window.currentPage <= 4) end = 5;
        if (window.currentPage >= totalPages - 3) start = totalPages - 4;

        for (let i = start; i <= end; i++) {
            addBtn(i, i, i === window.currentPage);
        }

        if (window.currentPage < totalPages - 3) addDots();

        // 始终显示最后一页
        addBtn(totalPages, totalPages, window.currentPage === totalPages);
    }

    // 3. 下一页
    addBtn('<i class="fa-solid fa-chevron-right"></i>', window.currentPage + 1, false, window.currentPage === totalPages);
}

async function init() {
    const files = ['weibo', 'poi', 'aoi', 'trajectory', 'od', 'building', 'house', 'other'].map(f => `data/describe/${f}.json`);
    const res = await Promise.all(files.map(f => fetch(f).then(r => r.json())));
    window.allDatasets = [].concat(...res);
    window.filteredDatasets = [...window.allDatasets];
    populateFilterOptions(dataTypeFilter, 'type', '全部类型', window.allDatasets);
    updateDependentFilters('dataTypeFilter');
    window.renderDatasets();
}

filterButton.addEventListener('click', window.applyFilters);
if (resetButton) resetButton.addEventListener('click', window.resetFilters);
[dataTypeFilter, levelFilter, cityFilter, timeFilter].forEach(f => f.addEventListener('change', (e) => {
    updateDependentFilters(e.target.id);
    window.applyFilters();
}));

document.addEventListener('DOMContentLoaded', init);