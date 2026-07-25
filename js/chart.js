// ============================================
// 仪表板图表管理 - 环形图 + 柱状图
// 功能：展示数据类型分布
// ============================================

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        // 配色方案
        colors: {
            pie: ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#EF4444', '#84CC16', '#6366F1'],
            bar: ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#EF4444', '#84CC16', '#6366F1']
        },
        // 数据类型显示名称映射
        nameMap: {
            '微博数据': '微博数据',
            'POI数据': 'POI数据',
            'AOI数据': 'AOI数据',
            '轨迹数据': '轨迹数据',
            'OD数据': 'OD数据',
            '建筑数据': '建筑足迹数据',
            '房价数据': '房价信息数据',
            '其他数据': '其他数据'
        },
        // JSON数据源配置
        dataSources: [
            { type: '微博数据', file: 'data/describe/weibo.json' },
            { type: 'POI数据', file: 'data/describe/poi.json' },
            { type: 'AOI数据', file: 'data/describe/aoi.json' },
            { type: '轨迹数据', file: 'data/describe/trajectory.json' },
            { type: 'OD数据', file: 'data/describe/od.json' },
            { type: '建筑数据', file: 'data/describe/building.json' },
            { type: '房价数据', file: 'data/describe/house.json' },
            { type: '其他数据', file: 'data/describe/other.json' }
        ]
    };

    // ==================== 图表管理器 ====================
    class ChartManager {
        constructor() {
            this.instances = {
                pie: null,  // 环形图
                bar: null   // 柱状图
            };
            this.refreshTimer = null;
            this.isInitialized = false;
        }

        /**
         * 初始化
         */
        async init() {
            if (this.isInitialized) return;
            
            const pieCanvas = document.getElementById('dataTypePieChart');
            const barCanvas = document.getElementById('dataTypeBarChart');
            
            if (!pieCanvas || !barCanvas) {
                console.warn('⚠️ 图表容器不存在');
                return;
            }

            await this.loadAndRender();
            this.bindEvents();
            this.isInitialized = true;
            console.log('📊 图表管理器初始化完成');
        }

        /**
         * 加载并渲染数据
         */
        async loadAndRender() {
            try {
                const data = await this.loadData();
                if (data && data.labels.length > 0) {
                    this.renderCharts(data.labels, data.counts);
                } else {
                    this.renderDefaultData();
                }
            } catch (error) {
                console.error('❌ 加载数据失败:', error);
                this.renderDefaultData();
            }
        }

        /**
         * 加载数据（多数据源降级）
         */
        async loadData() {
            // 1. 优先从 JSON 加载
            const jsonData = await this.loadFromJSON();
            if (jsonData) return jsonData;

            // 2. 从全局变量加载
            const globalData = this.loadFromGlobal();
            if (globalData) return globalData;

            // 3. 从 DOM 加载
            const domData = this.loadFromDOM();
            if (domData) return domData;

            return null;
        }

        /**
         * 从 JSON 文件加载
         */
        async loadFromJSON() {
            const results = [];

            for (const source of CONFIG.dataSources) {
                try {
                    const response = await fetch(source.file);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    results.push({
                        label: CONFIG.nameMap[source.type] || source.type,
                        count: data.length || 0
                    });
                } catch (error) {
                    console.warn(`⚠️ 加载 ${source.type} 失败:`, error.message);
                    results.push({
                        label: CONFIG.nameMap[source.type] || source.type,
                        count: 0
                    });
                }
            }

            const filtered = results.filter(item => item.count > 0);
            if (filtered.length === 0) return null;

            return {
                labels: filtered.map(item => item.label),
                counts: filtered.map(item => item.count)
            };
        }

        /**
         * 从全局变量加载
         */
        loadFromGlobal() {
            if (!window.allDatasets?.length) return null;

            const typeMap = new Map();
            window.allDatasets.forEach(ds => {
                const type = ds.dataType || ds.type || '其他';
                typeMap.set(type, (typeMap.get(type) || 0) + 1);
            });

            return {
                labels: Array.from(typeMap.keys()),
                counts: Array.from(typeMap.values())
            };
        }

        /**
         * 从 DOM 加载
         */
        loadFromDOM() {
            const cards = document.querySelectorAll('.dataset-card');
            if (cards.length === 0) return null;

            const typeMap = new Map();
            cards.forEach(card => {
                let type = card.getAttribute('data-type') || 
                          card.querySelector('.data-type')?.innerText || 
                          '数据集';
                type = type.trim();
                typeMap.set(type, (typeMap.get(type) || 0) + 1);
            });

            return {
                labels: Array.from(typeMap.keys()),
                counts: Array.from(typeMap.values())
            };
        }

        /**
         * 渲染默认数据
         */
        renderDefaultData() {
            const defaultData = {
                labels: ['微博数据', 'POI数据', 'AOI数据', '轨迹数据', 'OD数据', '建筑数据'],
                counts: [15, 22, 10, 8, 6, 12]
            };
            this.renderCharts(defaultData.labels, defaultData.counts);
            console.log('📊 使用默认数据渲染');
        }

        /**
         * 渲染图表
         */
        renderCharts(labels, data) {
            if (!labels?.length || !data?.length) {
                console.warn('⚠️ 数据为空，跳过渲染');
                return;
            }

            const pieColors = labels.map((_, i) => CONFIG.colors.pie[i % CONFIG.colors.pie.length]);
            const barColors = labels.map((_, i) => CONFIG.colors.bar[i % CONFIG.colors.bar.length]);

            this.renderPieChart(labels, data, pieColors);
            this.renderBarChart(labels, data, barColors);

            console.log(`✅ 图表渲染完成 (${labels.length} 种类型)`);
        }

        /**
         * 渲染环形图
         */
        renderPieChart(labels, data, colors) {
            const canvas = document.getElementById('dataTypePieChart');
            if (!canvas) return;

            this.destroyInstance('pie');

            this.instances.pie = new Chart(canvas, {
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
                            labels: {
                                boxWidth: 10,
                                padding: 12,
                                font: { size: 10 },
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                    return `${context.label}: ${context.parsed} 个 (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        /**
         * 渲染柱状图
         */
        renderBarChart(labels, data, colors) {
            const canvas = document.getElementById('dataTypeBarChart');
            if (!canvas) return;

            this.destroyInstance('bar');

            this.instances.bar = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '数据集数量',
                        data: data,
                        backgroundColor: colors,
                        borderRadius: 4,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: { size: 10 },
                                precision: 0,
                                stepSize: 1
                            },
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
         * 销毁单个图表实例
         */
        destroyInstance(key) {
            if (this.instances[key]) {
                this.instances[key].destroy();
                this.instances[key] = null;
            }
        }

        /**
         * 销毁所有图表
         */
        destroy() {
            Object.keys(this.instances).forEach(key => this.destroyInstance(key));
            clearTimeout(this.refreshTimer);
            this.isInitialized = false;
            console.log('🗑️ 图表已销毁');
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            // 数据更新事件
            window.addEventListener('datasetsUpdated', () => {
                this.refreshWithDebounce();
            });

            // 筛选按钮
            document.addEventListener('click', (e) => {
                if (e.target.closest('#filterButton')) {
                    this.refreshWithDebounce(300);
                }
            });

            // 窗口resize
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.instances.pie?.resize();
                    this.instances.bar?.resize();
                }, 250);
            });
        }

        /**
         * 防抖刷新
         */
        refreshWithDebounce(delay = 200) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => {
                this.loadAndRender();
            }, delay);
        }

        /**
         * 手动更新数据
         */
        updateData(labels, data) {
            if (labels && data) {
                this.renderCharts(labels, data);
            } else {
                this.refreshWithDebounce();
            }
        }

        /**
         * 刷新图表
         */
        refresh() {
            this.refreshWithDebounce(0);
        }
    }

    // ==================== 启动 ====================
    const chartManager = new ChartManager();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => chartManager.init());
    } else {
        chartManager.init();
    }

    // 暴露API
    window.chartManager = chartManager;
    window.barChart = {
        refresh: () => chartManager.refresh(),
        update: (labels, data) => chartManager.updateData(labels, data),
        destroy: () => chartManager.destroy()
    };

})();