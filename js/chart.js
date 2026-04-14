// chart.js - 优化版，解决图表闪现消失问题

// 默认配色方案
const COLOR_PALETTE = [
    '#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899',
    '#F59E0B', '#06B6D4', '#EF4444', '#84CC16', '#6366F1'
];

let currentBarChart = null;
let isInitialized = false;
let initTimer = null;

// 销毁图表
function destroyChart() {
    if (currentBarChart) {
        try {
            currentBarChart.destroy();
        } catch(e) {
            console.warn('销毁图表失败:', e);
        }
        currentBarChart = null;
    }
}

/**
 * 渲染柱状图
 */
function renderBarChart(labels, data, containerId = 'dataTypeChart', yAxisLabel = '数据集数量 (个)') {
    if (!labels || !data || labels.length === 0) {
        console.log('无数据，跳过渲染');
        return false;
    }
    
    // 过滤掉数量为0的数据
    const validItems = [];
    for (let i = 0; i < labels.length; i++) {
        if (data[i] > 0) {
            validItems.push({ label: labels[i], count: data[i] });
        }
    }
    
    if (validItems.length === 0) {
        console.log('所有数据都为0，跳过渲染');
        return false;
    }
    
    const finalLabels = validItems.map(item => item.label);
    const finalData = validItems.map(item => item.count);
    const backgroundColors = finalLabels.map((_, idx) => COLOR_PALETTE[idx % COLOR_PALETTE.length]);
    
    // 获取canvas元素
    const canvas = document.getElementById(containerId);
    if (!canvas) {
        console.error('找不到canvas元素:', containerId);
        return false;
    }
    
    // 确保canvas可见
    canvas.style.display = 'block';
    
    // 隐藏空状态提示
    const emptyMsg = canvas.parentNode?.querySelector('.chart-empty-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
    
    const ctx = canvas.getContext('2d');
    
    // 销毁旧实例
    destroyChart();
    
    // 创建新图表
    try {
        currentBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: finalLabels,
                datasets: [{
                    label: '数据集数量',
                    data: finalData,
                    backgroundColor: backgroundColors,
                    borderRadius: 8,
                    barPercentage: 0.7,
                    categoryPercentage: 0.85,
                    borderSkipped: false,
                    hoverOffset: 4,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'center',
                        labels: {
                            boxWidth: 12,
                            font: { size: 12 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw} 个`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        title: {
                            display: true,
                            text: yAxisLabel,
                            font: { size: 12 },
                            color: '#475569'
                        },
                        ticks: { 
                            precision: 0,
                            stepSize: Math.ceil(Math.max(...finalData, 1) / 5) || 1
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 },
                            maxRotation: 25,
                            autoSkip: true
                        },
                        title: {
                            display: true,
                            text: '数据类型',
                            font: { size: 12 },
                            color: '#475569'
                        }
                    }
                },
                layout: {
                    padding: { top: 16, bottom: 8, left: 8, right: 8 }
                }
            }
        });
        return true;
    } catch(e) {
        console.error('创建图表失败:', e);
        return false;
    }
}

/**
 * 从全局获取统计数据
 */
function getStatisticsFromGlobal() {
    // 尝试从 window.allDatasets 获取
    if (window.allDatasets && Array.isArray(window.allDatasets) && window.allDatasets.length > 0) {
        const typeMap = new Map();
        window.allDatasets.forEach(ds => {
            const type = ds.dataType || ds.type || '其他';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        if (typeMap.size > 0) {
            return {
                labels: Array.from(typeMap.keys()),
                counts: Array.from(typeMap.values())
            };
        }
    }
    
    // 尝试从 DOM 获取
    const cards = document.querySelectorAll('#datasets-container .dataset-card, .dataset-card');
    if (cards.length > 0) {
        const typeMap = new Map();
        cards.forEach(card => {
            let type = card.getAttribute('data-type') || 
                       card.querySelector('.data-type')?.innerText ||
                       '数据集';
            type = type.trim();
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        if (typeMap.size > 0) {
            return {
                labels: Array.from(typeMap.keys()),
                counts: Array.from(typeMap.values())
            };
        }
    }
    
    // 返回默认演示数据（仅在完全没有数据时使用）
    return {
        labels: ['微博签到', 'POI', 'AOI', '轨迹数据', 'OD流', '建筑足迹'],
        counts: [12, 18, 8, 6, 5, 7]
    };
}

/**
 * 刷新图表（主入口）
 */
function refreshChart() {
    // 清除之前的定时器
    if (initTimer) clearTimeout(initTimer);
    
    // 延迟执行，避免与其他脚本冲突
    initTimer = setTimeout(() => {
        const stats = getStatisticsFromGlobal();
        if (stats && stats.labels && stats.labels.length > 0) {
            renderBarChart(stats.labels, stats.counts, 'dataTypeChart', '数据集数量 (个)');
        }
    }, 100);
}

/**
 * 强制刷新图表（忽略缓存）
 */
function forceRefreshChart() {
    const stats = getStatisticsFromGlobal();
    if (stats && stats.labels && stats.labels.length > 0) {
        renderBarChart(stats.labels, stats.counts, 'dataTypeChart', '数据集数量 (个)');
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // 等待数据集加载完成
        setTimeout(refreshChart, 500);
    });
} else {
    setTimeout(refreshChart, 500);
}

// 监听数据集更新事件
window.addEventListener('datasetsUpdated', () => {
    forceRefreshChart();
});

// 监听下载列表渲染完成
document.addEventListener('downloadListRendered', () => {
    forceRefreshChart();
});

// 监听筛选按钮点击
document.addEventListener('click', (e) => {
    if (e.target.id === 'filterButton' || e.target.closest('#filterButton')) {
        setTimeout(forceRefreshChart, 300);
    }
});

// 暴露全局方法
window.barChart = {
    render: renderBarChart,
    refresh: refreshChart,
    forceRefresh: forceRefreshChart,
    destroy: destroyChart
};

console.log('图表模块已加载');