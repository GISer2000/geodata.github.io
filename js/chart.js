// 默认配色方案
const COLOR_PALETTE = [
    '#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899',
    '#F59E0B', '#06B6D4', '#EF4444', '#84CC16', '#6366F1'
];

// 存储图表实例
let currentCharts = {
    bar: null,
    pie: null
};

/**
 * 销毁所有图表
 */
function destroyCharts() {
    Object.keys(currentCharts).forEach(key => {
        if (currentCharts[key]) {
            currentCharts[key].destroy();
            currentCharts[key] = null;
        }
    });
}

/**
 * 核心渲染函数：左环右柱
 */
function renderCharts(labels, data) {
    if (!labels || labels.length === 0) return;

    const pieCtx = document.getElementById('dataTypePieChart').getContext('2d');
    const barCtx = document.getElementById('dataTypeBarChart').getContext('2d');

    // 销毁旧实例防止内存溢出
    if (window.pieInstance) window.pieInstance.destroy();
    if (window.barInstance) window.barInstance.destroy();

    const colors = labels.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);

    // 1. 左侧环状图
    window.pieInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 10 }, usePointStyle: true }
                }
            }
        }
    });

    // 2. 右侧柱状图
    window.barInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '数据集数量',
                data: data,
                backgroundColor: colors, // 使用相同颜色序列保持对应
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // 柱状图不显示图例，避免拥挤
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 10 }, precision: 0 },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    ticks: { 
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45 
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * 逻辑适配（复用你原本的获取数据逻辑）
 */
function getStatisticsFromGlobal() {
    // 保持你原有的逻辑不变
    if (window.allDatasets?.length > 0) {
        const typeMap = new Map();
        window.allDatasets.forEach(ds => {
            const type = ds.dataType || ds.type || '其他';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        return { labels: Array.from(typeMap.keys()), counts: Array.from(typeMap.values()) };
    }
    
    const cards = document.querySelectorAll('.dataset-card');
    if (cards.length > 0) {
        const typeMap = new Map();
        cards.forEach(card => {
            let type = card.getAttribute('data-type') || card.querySelector('.data-type')?.innerText || '数据集';
            typeMap.set(type.trim(), (typeMap.get(type.trim()) || 0) + 1);
        });
        return { labels: Array.from(typeMap.keys()), counts: Array.from(typeMap.values()) };
    }

    return { labels: ['微博签到', 'POI', 'AOI', '轨迹', 'OD流'], counts: [12, 18, 8, 6, 5] };
}

// 刷新与事件监听
let initTimer = null;
function refreshChart() {
    if (initTimer) clearTimeout(initTimer);
    initTimer = setTimeout(() => {
        const stats = getStatisticsFromGlobal();
        renderCharts(stats.labels, stats.counts);
    }, 100);
}

// 初始化及监听
document.addEventListener('DOMContentLoaded', () => setTimeout(refreshChart, 500));
window.addEventListener('datasetsUpdated', refreshChart);
document.addEventListener('click', (e) => {
    if (e.target.closest('#filterButton')) setTimeout(refreshChart, 300);
});

// 暴露接口
window.barChart = {
    refresh: refreshChart,
    destroy: destroyCharts
};