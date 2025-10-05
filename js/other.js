// 导航栏滚动效果
class NavigationManager {
    constructor() {
        this.navbar = document.getElementById('navbar');
        this.menuBtn = document.getElementById('menuBtn');
        this.mobileMenu = document.getElementById('mobileMenu');
        this.init();
    }

    init() {
        this.bindScrollEvent();
        this.bindMenuEvents();
        this.bindSmoothScroll();
    }


    // 绑定滚动事件
    bindScrollEvent() {
        window.addEventListener('scroll', () => {
            const shouldShowBackground = window.scrollY > 50;
            
            if (shouldShowBackground) {
                this.navbar.classList.add('bg-white', 'shadow-md');
                this.navbar.classList.remove('bg-transparent');
            } else {
                this.navbar.classList.remove('bg-white', 'shadow-md');
                this.navbar.classList.add('bg-transparent');
            }
        });
    }

    // 绑定移动端菜单事件

    bindMenuEvents() {
        if (!this.menuBtn || !this.mobileMenu) return;

        this.menuBtn.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // 点击菜单外区域关闭菜单
        document.addEventListener('click', (e) => {
            if (!this.mobileMenu.classList.contains('hidden') && 
                !this.menuBtn.contains(e.target) && 
                !this.mobileMenu.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
    }

   // 切换移动端菜单
    toggleMobileMenu() {
        this.mobileMenu.classList.toggle('hidden');
        this.updateMenuButtonIcon();
    }

    // 关闭移动端菜单
    closeMobileMenu() {
        this.mobileMenu.classList.add('hidden');
        this.updateMenuButtonIcon();
    }

    // 更新菜单按钮图标
    updateMenuButtonIcon() {
        const isMenuOpen = !this.mobileMenu.classList.contains('hidden');
        this.menuBtn.innerHTML = isMenuOpen 
            ? '<i class="fa-solid fa-times text-xl"></i>'
            : '<i class="fa-solid fa-bars text-xl"></i>';
    }

    // 绑定平滑滚动
    bindSmoothScroll() {
        const anchors = document.querySelectorAll('a[href^="#"]');
        
        anchors.forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                this.handleSmoothScroll(e, anchor);
            });
        });
    }

    // 处理平滑滚动
    handleSmoothScroll(e, anchor) {
        e.preventDefault();

        const targetId = anchor.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            const offsetTop = targetElement.offsetTop - 80;
            
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });

            // 滚动后关闭移动端菜单
            if (this.mobileMenu && !this.mobileMenu.classList.contains('hidden')) {
                this.closeMobileMenu();
            }
        }
    }
}

// 数据类型图表管理器
class ChartManager {
    constructor() {
        this.dataTypes = [
            { type: '微博数据', file: 'data/describe/weibo.json' },
            { type: 'POI数据', file: 'data/describe/poi.json' },
            { type: 'AOI数据', file: 'data/describe/aoi.json' },
            { type: '轨迹数据', file: 'data/describe/trajectory.json' },
            { type: 'OD数据', file: 'data/describe/od.json' },
            { type: '建筑数据', file: 'data/describe/building.json' },
            { type: '其他数据', file: 'data/describe/other.json' }
        ];

        this.chartColors = [
            '#1E40AF', // 微博数据 - 深蓝
            '#3B82F6', // POI数据 - 蓝色
            '#93C5FD', // AOI数据 - 浅蓝
            '#F97316', // 轨迹数据 - 橙色
            '#FB923C', // OD数据 - 浅橙
            '#FDBA74', // 建筑数据 - 更浅橙
            '#CBD5E1'  // 其他数据 - 灰色
        ];

        this.nameMap = {
            '微博数据': '微博数据',
            'POI数据': 'POI数据',
            'AOI数据': 'AOI数据',
            '轨迹数据': '轨迹数据',
            'OD数据': 'OD数据',
            '建筑数据': '建筑足迹数据',
            '其他数据': '其他数据'
        };
    }

    // 初始化图表
    async init() {
        if (!document.getElementById('dataTypeChart')) return;

        try {
            const chartData = await this.loadChartData();
            this.renderChart(chartData);
        } catch (error) {
            console.error('初始化图表失败:', error);
        }
    }

    // 加载图表数据
    async loadChartData() {
        const datasetCounts = [];
        const labels = [];

        for (const dataType of this.dataTypes) {
            try {
                const response = await fetch(dataType.file);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                datasetCounts.push(data.length);
                labels.push(this.getDisplayName(dataType.type));
            } catch (error) {
                console.error(`加载 ${dataType.type} 数据失败:`, error);
                datasetCounts.push(0);
                labels.push(this.getDisplayName(dataType.type));
            }
        }

        return { labels, datasetCounts };
    }

    // 渲染图表
    renderChart(chartData) {
        const ctx = document.getElementById('dataTypeChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.datasetCounts,
                    backgroundColor: this.chartColors,
                    borderWidth: 0
                }]
            },
            options: this.getChartOptions()
        });
    }

    // 获取图表配置
    getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value}个数据集 (${percentage}%)`;
                        }
                    }
                }
            }
        };
    }

    // 获取显示名称
    getDisplayName(type) {
        return this.nameMap[type] || type;
    }
}

// 应用初始化
class App {
    constructor() {
        this.navigationManager = null;
        this.chartManager = null;
    }

    init() {
        this.initNavigation();
        this.initChart();
    }

    initNavigation() {
        this.navigationManager = new NavigationManager();
    }

    initChart() {
        this.chartManager = new ChartManager();
        this.chartManager.init();
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});